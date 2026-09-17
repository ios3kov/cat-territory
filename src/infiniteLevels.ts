import type { CatalogLevel } from './levelCatalog';
import { analyzePuzzle } from './puzzleEngine';
import { isMoonRun } from './progression';
import { storageGet, storageSet } from './storage';

/** @deprecated All levels are generated now. Kept temporarily for API compatibility. */
export const CURATED_LEVEL_COUNT = 0;
const RUN_START_INDEX = 24,
  generatedCache = new Map<number, CatalogLevel>(),
  GENERATED_CACHE_LIMIT = 12,
  PERSISTED_LEVEL_PREFIX = 'cat-territory-generated-v5-';

const adjectives = [
    'Moonlit',
    'Velvet',
    'Quiet',
    'Silver',
    'Cozy',
    'Secret',
    'Midnight',
    'Amber',
    'Rainy',
    'Soft',
    'Neon',
    'Sleepy',
  ],
  nouns = [
    'Rooftop',
    'Nook',
    'Balcony',
    'Hall',
    'Loft',
    'Window',
    'Hideout',
    'Garden',
    'Landing',
    'Attic',
    'Passage',
    'Terrace',
  ];

function normalizeIndex(index: number) {
  return Math.max(0, Math.floor(index));
}

function makeRng(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], random: () => number) {
  for (let i = items.length - 1; i > 0; i--) {
    const t = Math.floor(random() * (i + 1));
    [items[i], items[t]] = [items[t], items[i]];
  }
  return items;
}

type LevelPlan = {
  size: number;
  chapter: number;
  chapterName: string;
  source: 'curated' | 'generated';
};

function levelPlan(levelIndex: number): LevelPlan {
  const i = normalizeIndex(levelIndex);
  if (i < 4)
    return {
      size: 5,
      chapter: 1,
      chapterName: 'Kitten Steps',
      source: 'curated',
    };
  if (i < 10)
    return {
      size: 6,
      chapter: 2,
      chapterName: 'House Rules',
      source: 'curated',
    };
  if (i < 16)
    return {
      size: 7,
      chapter: 3,
      chapterName: 'Long Hallways',
      source: 'curated',
    };
  if (i < RUN_START_INDEX)
    return {
      size: 8,
      chapter: 4,
      chapterName: 'Night Shift',
      source: 'curated',
    };

  const offset = i - RUN_START_INDEX;
  let size: number;
  if (offset < 4) size = 8;
  else if (offset < 9) size = 9;
  else if (isMoonRun(i)) size = 10;
  else {
    const wave = [9, 10, 10, 9, 10, 10] as const;
    size = wave[(offset - 9) % wave.length];
  }
  return {
    size,
    chapter: 5,
    chapterName: isMoonRun(i) ? 'Moon Run' : 'Endless',
    source: 'generated',
  };
}

export function levelSizeAt(index: number) {
  return levelPlan(index).size;
}

function createSolution(size: number, random: () => number) {
  const solution = Array(size).fill(-1) as number[],
    used = Array(size).fill(false);
  const search = (row: number): boolean => {
    if (row === size) return true;
    for (const col of shuffle(
      Array.from({ length: size }, (_, c) => c),
      random,
    )) {
      if (used[col] || (row > 0 && Math.abs(col - solution[row - 1]) <= 1))
        continue;
      solution[row] = col;
      used[col] = true;
      if (search(row + 1)) return true;
      used[col] = false;
    }
    return false;
  };
  return search(0) ? solution : null;
}

function countSolutions(
  regions: number[][],
  limit = 2,
): { count: number; first: number[] | null } {
  const size = regions.length,
    all = (1 << size) - 1,
    placement = Array<number>(size).fill(-1);
  let count = 0,
    first: number[] | null = null;
  const search = (
    row: number,
    columns: number,
    usedRegions: number,
    previous: number,
  ) => {
    if (row === size) {
      count++;
      if (!first) first = [...placement];
      return;
    }
    let available =
      all & ~(columns | previous | (previous << 1) | (previous >>> 1));
    while (available && count < limit) {
      const bit = available & -available;
      available ^= bit;
      const col = 31 - Math.clz32(bit),
        region = 1 << regions[row][col];
      if (usedRegions & region) continue;
      placement[row] = col;
      search(row + 1, columns | bit, usedRegions | region, bit);
    }
  };
  search(0, 0, 0, 0);
  return { count, first };
}

function regionConnected(
  regions: number[][],
  region: number,
  removed?: [number, number],
) {
  const size = regions.length,
    cells: Array<[number, number]> = [];
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++)
      if (
        regions[r][c] === region &&
        (!removed || removed[0] !== r || removed[1] !== c)
      )
        cells.push([r, c]);
  if (!cells.length) return false;
  const key = (r: number, c: number) => r * size + c,
    seen = new Set<number>(),
    stack = [cells[0]];
  while (stack.length) {
    const [r, c] = stack.pop()!,
      id = key(r, c);
    if (seen.has(id)) continue;
    seen.add(id);
    for (const [nr, nc] of [
      [r - 1, c],
      [r + 1, c],
      [r, c - 1],
      [r, c + 1],
    ]) {
      if (
        nr < 0 ||
        nr >= size ||
        nc < 0 ||
        nc >= size ||
        (removed && removed[0] === nr && removed[1] === nc)
      )
        continue;
      if (regions[nr][nc] === region && !seen.has(key(nr, nc)))
        stack.push([nr, nc]);
    }
  }
  return seen.size === cells.length;
}

function initialRegions(size: number, solution: number[]) {
  const finalRegion = size - 1,
    regions = Array.from({ length: size }, () => Array(size).fill(finalRegion));
  for (let r = 0; r < size - 1; r++) regions[r][solution[r]] = r;
  return regions;
}

function expandRegions(
  regions: number[][],
  solution: number[],
  random: () => number,
) {
  const size = regions.length,
    finalRegion = size - 1,
    anchors = new Set(solution.map((c, r) => r * size + c)),
    sizes = Array(size).fill(0);
  for (const row of regions) for (const group of row) sizes[group]++;
  const target = Math.max(3, size - 1);
  for (let attempt = 0; attempt < size * size * 7; attempt++) {
    const recipients = shuffle(
      Array.from({ length: size - 1 }, (_, group) => group),
      random,
    ).sort((a, b) => sizes[a] - sizes[b]);
    let moved = false;
    for (const recipient of recipients) {
      if (sizes[recipient] >= target) continue;
      const frontier: Array<[number, number]> = [];
      for (let r = 0; r < size; r++)
        for (let c = 0; c < size; c++)
          if (regions[r][c] === recipient)
            for (const [nr, nc] of [
              [r - 1, c],
              [r + 1, c],
              [r, c - 1],
              [r, c + 1],
            ])
              if (
                nr >= 0 &&
                nr < size &&
                nc >= 0 &&
                nc < size &&
                regions[nr][nc] === finalRegion &&
                !anchors.has(nr * size + nc)
              )
                frontier.push([nr, nc]);
      shuffle(frontier, random);
      for (const [r, c] of frontier.slice(0, 14)) {
        if (!regionConnected(regions, finalRegion, [r, c])) continue;
        regions[r][c] = recipient;
        const result = countSolutions(regions),
          same = Boolean(
            result.first && result.first.every((v, i) => v === solution[i]),
          );
        if (result.count === 1 && same) {
          sizes[recipient]++;
          sizes[finalRegion]--;
          moved = true;
          break;
        }
        regions[r][c] = finalRegion;
      }
      if (moved) break;
    }
    if (!moved) break;
  }
  return regions;
}

const CURVE = [
    0.72, 0.8, 0.9, 1.01, 1.12, 0.84, 0.95, 1.07, 1.18, 1.28,
  ] as const,
  BASE_TARGET: Record<number, number> = {
    5: 7,
    6: 18,
    7: 45,
    8: 140,
    9: 260,
    10: 430,
  };

function target(size: number, special: boolean, phase = 5) {
  if (special) return 900;
  return Math.round(
    (BASE_TARGET[size] ?? 430) * CURVE[Math.max(0, Math.min(9, phase))],
  );
}

function penalty(level: CatalogLevel) {
  const counts = Array(level.size).fill(0) as number[];
  for (const row of level.regions) for (const group of row) counts[group]++;
  const imbalance =
      counts.reduce((sum, count) => sum + Math.abs(count - level.size), 0) /
      (level.size * level.size),
    dominant = Math.max(...counts) / (level.size * level.size);
  return imbalance * 0.34 + Math.max(0, dominant - 0.28) * 1.4;
}

function candidateScore(level: CatalogLevel, special: boolean, phase: number) {
  const desired = target(level.size, special, phase);
  return (
    Math.abs(level.logicalScore - desired) / Math.max(1, desired) +
    penalty(level)
  );
}

function valid(level: CatalogLevel, size: number, source: LevelPlan['source']) {
  if (
    level.source !== source ||
    !Array.isArray(level.starterCats) ||
    level.starterCats.length !== 0 ||
    !Number.isFinite(level.logicalScore) ||
    level.logicalScore < 0
  )
    return false;
  if (
    !Array.isArray(level.solution) ||
    level.solution.length !== size ||
    !level.solution.every((c) => Number.isInteger(c) && c >= 0 && c < size) ||
    new Set(level.solution).size !== size ||
    level.solution.some(
      (c, r) => r > 0 && Math.abs(c - level.solution[r - 1]) <= 1,
    )
  )
    return false;
  if (
    !Array.isArray(level.regions) ||
    level.regions.length !== size ||
    !level.regions.every(
      (row) =>
        Array.isArray(row) &&
        row.length === size &&
        row.every(
          (group) => Number.isInteger(group) && group >= 0 && group < size,
        ),
    )
  )
    return false;
  const groups = level.solution.map((c, r) => level.regions[r][c]);
  return (
    new Set(groups).size === size &&
    Array.from({ length: size }, (_, group) => group).every((group) =>
      regionConnected(level.regions, group),
    )
  );
}

function expectedId(index: number, size: number) {
  return index < RUN_START_INDEX
    ? `generated-v1-${index}-${size}`
    : `endless-v5-${index}-${size}`;
}

export function readGenerated(levelIndex: number) {
  const index = normalizeIndex(levelIndex),
    plan = levelPlan(index),
    key = `${PERSISTED_LEVEL_PREFIX}${index}`,
    raw = storageGet(key);
  if (!raw) return null;
  try {
    const level = JSON.parse(raw) as CatalogLevel;
    if (
      level.id !== expectedId(index, plan.size) ||
      level.size !== plan.size ||
      !valid(level, plan.size, plan.source)
    )
      return null;
    return level;
  } catch {
    return null;
  }
}

export function rememberGenerated(levelIndex: number, level: CatalogLevel) {
  const index = normalizeIndex(levelIndex);
  generatedCache.set(index, level);
  storageSet(`${PERSISTED_LEVEL_PREFIX}${index}`, JSON.stringify(level));
  while (generatedCache.size > GENERATED_CACHE_LIMIT)
    generatedCache.delete(generatedCache.keys().next().value!);
}

function candidate(
  seed: number,
  size: number,
  variant: number,
  meta: {
    id: string;
    chapter: number;
    chapterName: string;
    source: LevelPlan['source'];
    name?: string;
    special?: 'moon-run';
  },
): CatalogLevel | null {
  const random = makeRng(seed + variant * 2246822519),
    solution = createSolution(size, random);
  if (!solution) return null;
  const regions = initialRegions(size, solution);
  if (!regionConnected(regions, size - 1)) return null;
  expandRegions(regions, solution, random);
  const analysis = analyzePuzzle(regions),
    matches = Boolean(
      analysis.firstSolution &&
      analysis.firstSolution.every((col, row) => col === solution[row]),
    );
  if (analysis.solutionCount !== 1 || !analysis.logicalSolved || !matches)
    return null;
  return {
    id: meta.id,
    name:
      meta.name ??
      `${adjectives[Math.floor(random() * adjectives.length)]} ${nouns[Math.floor(random() * nouns.length)]}`,
    size,
    regions,
    solution,
    difficulty: analysis.difficulty,
    searchNodes: analysis.searchNodes,
    logicalScore: analysis.logicalScore,
    source: meta.source,
    chapter: meta.chapter,
    chapterName: meta.chapterName,
    starterCats: [],
    special: meta.special,
  };
}

export function minimumDifficulty(
  size: number,
  special: boolean,
  phase: number,
) {
  return special
    ? 900
    : size >= 10
      ? 430
      : size === 9
        ? Math.round(260 * CURVE[phase])
        : 0;
}

export function chooseCandidate(
  candidates: CatalogLevel[],
  floor: number,
  special: boolean,
  phase: number,
) {
  const qualified = candidates.filter(
    (candidate) => candidate.logicalScore >= floor,
  );
  if (!qualified.length)
    return candidates.reduce<CatalogLevel | null>(
      (best, candidate) =>
        !best || candidate.logicalScore > best.logicalScore ? candidate : best,
      null,
    );
  return qualified.reduce((best, candidate) =>
    candidateScore(candidate, special, phase) <
    candidateScore(best, special, phase)
      ? candidate
      : best,
  );
}

function select(
  seed: number,
  size: number,
  meta: Parameters<typeof candidate>[3],
  special: boolean,
  phase: number,
) {
  const floor = minimumDifficulty(size, special, phase),
    budget = special ? 96 : floor > 0 ? 72 : 48,
    candidates: CatalogLevel[] = [];
  for (let variant = 0; variant < budget; variant++) {
    const next = candidate(seed, size, variant, meta);
    if (next) candidates.push(next);
  }
  return chooseCandidate(candidates, floor, special, phase);
}

function progressionPhase(index: number) {
  if (index >= RUN_START_INDEX) return (index - RUN_START_INDEX) % 10;
  const plan = levelPlan(index),
    start =
      plan.size === 5 ? 0 : plan.size === 6 ? 4 : plan.size === 7 ? 10 : 16,
    count = plan.size === 5 ? 4 : plan.size === 8 ? 8 : 6,
    local = index - start;
  return count <= 1 ? 0 : Math.round((local / (count - 1)) * 9);
}

function generate(levelIndex: number) {
  const index = normalizeIndex(levelIndex),
    plan = levelPlan(index),
    special = isMoonRun(index),
    seed = (index + 1) * 2654435761,
    phase = progressionPhase(index),
    best = select(
      seed,
      plan.size,
      {
        id: expectedId(index, plan.size),
        chapter: plan.chapter,
        chapterName: plan.chapterName,
        source: plan.source,
        special: special ? 'moon-run' : undefined,
      },
      special,
      phase,
    );
  if (best) return best;
  throw new Error(`Unable to generate level ${index + 1}.`);
}

export function getLevel(levelIndex: number) {
  const index = normalizeIndex(levelIndex),
    cached = generatedCache.get(index);
  if (cached) return cached;
  const persisted = readGenerated(index);
  if (persisted) {
    generatedCache.set(index, persisted);
    return persisted;
  }
  const generated = generate(index);
  rememberGenerated(index, generated);
  return generated;
}
