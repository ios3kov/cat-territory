import { buildLevelCatalog, type CatalogLevel } from './levelCatalog';
import { analyzePuzzle } from './puzzleEngine';
import { isMoonRun } from './progression';
import { runWhenIdle } from './scheduler';
import { storageGet, storageSet } from './storage';
export const CURATED_LEVEL_COUNT = 24;
const curatedLevels = buildLevelCatalog(),
  generatedCache = new Map<number, CatalogLevel>(),
  dailyCache = new Map<string, CatalogLevel>(),
  GENERATED_CACHE_LIMIT = 12,
  DAILY_CACHE_LIMIT = 7,
  PERSISTED_LEVEL_PREFIX = 'cat-territory-generated-v5-',
  PERSISTED_DAILY_PREFIX = 'cat-territory-daily-level-v2-';
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
function generatedSize(levelIndex: number) {
  const o = levelIndex - CURATED_LEVEL_COUNT;
  if (o < 4) return 8;
  if (o < 9) return 9;
  if (isMoonRun(levelIndex)) return 10;
  const wave = [9, 10, 10, 9, 10, 10] as const;
  return wave[(o - 9) % wave.length];
}
export function levelSizeAt(i: number) {
  return i < CURATED_LEVEL_COUNT ? curatedLevels[i].size : generatedSize(i);
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
// Boards have at most ten columns. Bit masks avoid allocating and scanning
// unavailable columns at every node of the uniqueness search.
function countSolutions(regions: number[][], limit = 2) {
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
  const f = size - 1,
    regions = Array.from({ length: size }, () => Array(size).fill(f));
  for (let r = 0; r < size - 1; r++) regions[r][solution[r]] = r;
  return regions;
}
function expandRegions(
  regions: number[][],
  solution: number[],
  random: () => number,
) {
  const size = regions.length,
    f = size - 1,
    anchors = new Set(solution.map((c, r) => r * size + c)),
    sizes = Array(size).fill(0);
  for (const row of regions) for (const g of row) sizes[g]++;
  const target = Math.max(3, size - 1);
  for (let attempt = 0; attempt < size * size * 7; attempt++) {
    const recipients = shuffle(
      Array.from({ length: size - 1 }, (_, g) => g),
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
                regions[nr][nc] === f &&
                !anchors.has(nr * size + nc)
              )
                frontier.push([nr, nc]);
      shuffle(frontier, random);
      for (const [r, c] of frontier.slice(0, 14)) {
        if (!regionConnected(regions, f, [r, c])) continue;
        regions[r][c] = recipient;
        const result = countSolutions(regions),
          same = Boolean(
            result.first && result.first.every((v, i) => v === solution[i]),
          );
        if (result.count === 1 && same) {
          sizes[recipient]++;
          sizes[f]--;
          moved = true;
          break;
        }
        regions[r][c] = f;
      }
      if (moved) break;
    }
    if (!moved) break;
  }
  return regions;
}
const CURVE = [
  0.72, 0.8, 0.9, 1.01, 1.12, 0.84, 0.95, 1.07, 1.18, 1.28,
] as const;
function target(size: number, special: boolean, phase = 5) {
  if (special) return 900;
  return Math.round(
    (size === 8 ? 140 : size === 9 ? 260 : 430) *
      CURVE[Math.max(0, Math.min(9, phase))],
  );
}
function penalty(level: CatalogLevel) {
  const counts = Array(level.size).fill(0) as number[];
  for (const row of level.regions) for (const g of row) counts[g]++;
  const imbalance =
      counts.reduce((s, c) => s + Math.abs(c - level.size), 0) /
      (level.size * level.size),
    dominant = Math.max(...counts) / (level.size * level.size);
  return imbalance * 0.34 + Math.max(0, dominant - 0.28) * 1.4;
}
function candidateScore(level: CatalogLevel, special: boolean, phase: number) {
  const t = target(level.size, special, phase);
  return Math.abs(level.logicalScore - t) / Math.max(1, t) + penalty(level);
}
function valid(level: CatalogLevel, size: number) {
  if (
    !Array.isArray(level.starterCats) ||
    !level.starterCats.every(
      (i) =>
        Number.isInteger(i) &&
        i >= 0 &&
        i < size * size &&
        level.solution?.[Math.floor(i / size)] === i % size,
    ) ||
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
        row.every((g) => Number.isInteger(g) && g >= 0 && g < size),
    )
  )
    return false;
  const gs = level.solution.map((c, r) => level.regions[r][c]);
  return (
    new Set(gs).size === size &&
    Array.from({ length: size }, (_, g) => g).every((g) =>
      regionConnected(level.regions, g),
    )
  );
}
export function readGenerated(i: number) {
  const raw = storageGet(`${PERSISTED_LEVEL_PREFIX}${i}`);
  if (!raw) return null;
  try {
    const l = JSON.parse(raw) as CatalogLevel,
      size = generatedSize(i);
    return l.id === `endless-v5-${i}-${size}` &&
      l.source === 'generated' &&
      l.size === size &&
      valid(l, size)
      ? l
      : null;
  } catch {
    return null;
  }
}
export function rememberGenerated(i: number, l: CatalogLevel) {
  generatedCache.set(i, l);
  storageSet(`${PERSISTED_LEVEL_PREFIX}${i}`, JSON.stringify(l));
  while (generatedCache.size > GENERATED_CACHE_LIMIT)
    generatedCache.delete(generatedCache.keys().next().value!);
}
export function rememberDaily(k: string, l: CatalogLevel) {
  dailyCache.set(k, l);
  storageSet(`${PERSISTED_DAILY_PREFIX}${k}`, JSON.stringify(l));
  while (dailyCache.size > DAILY_CACHE_LIMIT)
    dailyCache.delete(dailyCache.keys().next().value!);
}
function readDaily(k: string, size: number) {
  const raw = storageGet(`${PERSISTED_DAILY_PREFIX}${k}`);
  if (!raw) return null;
  try {
    const l = JSON.parse(raw) as CatalogLevel;
    return l.id === `daily-v2-${k}-${size}` &&
      l.source === 'generated' &&
      l.size === size &&
      valid(l, size)
      ? l
      : null;
  } catch {
    return null;
  }
}
function candidate(
  seed: number,
  size: number,
  variant: number,
  meta: {
    id: string;
    name?: string;
    chapterName: string;
    starter: boolean;
    special?: 'moon-run';
  },
): CatalogLevel | null {
  const random = makeRng(seed + variant * 2246822519),
    solution = createSolution(size, random);
  if (!solution) return null;
  const regions = initialRegions(size, solution);
  if (!regionConnected(regions, size - 1)) return null;
  expandRegions(regions, solution, random);
  const a = analyzePuzzle(regions),
    matches = Boolean(
      a.firstSolution && a.firstSolution.every((c, r) => c === solution[r]),
    );
  if (a.solutionCount !== 1 || !a.logicalSolved || !matches) return null;
  return {
    id: meta.id,
    name:
      meta.name ??
      `${adjectives[Math.floor(random() * adjectives.length)]} ${nouns[Math.floor(random() * nouns.length)]}`,
    size,
    regions,
    solution,
    difficulty: a.difficulty,
    searchNodes: a.searchNodes,
    logicalScore: a.logicalScore,
    source: 'generated',
    chapter: 5,
    chapterName: meta.chapterName,
    starterCats: meta.starter ? [solution[0]] : [],
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
  const qualified = candidates.filter((c) => c.logicalScore >= floor);
  if (!qualified.length)
    return candidates.reduce<CatalogLevel | null>(
      (best, c) => (!best || c.logicalScore > best.logicalScore ? c : best),
      null,
    );
  return qualified.reduce((best, c) =>
    candidateScore(c, special, phase) < candidateScore(best, special, phase)
      ? c
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
  const floor =
      meta.chapterName === 'Daily'
        ? 0
        : minimumDifficulty(size, special, phase),
    budget = special ? 96 : floor > 0 ? 72 : 48,
    candidates: CatalogLevel[] = [];
  for (let v = 0; v < budget; v++) {
    const c = candidate(seed, size, v, meta);
    if (c) candidates.push(c);
  }
  return chooseCandidate(candidates, floor, special, phase);
}
function generate(i: number) {
  const size = generatedSize(i),
    special = isMoonRun(i),
    previousSize = levelSizeAt(i - 1),
    seed = (i + 1) * 2654435761,
    phase = Math.max(0, (i - CURATED_LEVEL_COUNT) % 10),
    best = select(
      seed,
      size,
      {
        id: `endless-v5-${i}-${size}`,
        chapterName: special ? 'Moon Run' : 'Endless',
        starter: !special && previousSize !== size,
        special: special ? 'moon-run' : undefined,
      },
      special,
      phase,
    );
  if (best) return best;
  throw new Error(`Unable to generate endless level ${i + 1}.`);
}
function hash(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
export function getDailyLevel(dateKey: string) {
  const key = /^\d{4}-\d{2}-\d{2}$/.test(dateKey) ? dateKey : '1970-01-01',
    cached = dailyCache.get(key);
  if (cached) return cached;
  const seed = hash(`cat-territory-daily-v1-${key}`),
    sizes = [6, 7, 7, 8, 8, 9, 9] as const,
    size = sizes[seed % sizes.length],
    persisted = readDaily(key, size);
  if (persisted) {
    dailyCache.set(key, persisted);
    return persisted;
  }
  const best = select(
    seed,
    size,
    {
      id: `daily-v2-${key}-${size}`,
      name: 'Daily Territory',
      chapterName: 'Daily',
      starter: false,
    },
    false,
    4,
  );
  if (!best) throw new Error(`Unable to generate Daily Territory ${key}.`);
  rememberDaily(key, best);
  return best;
}
export function getLevel(levelIndex: number) {
  const i = Math.max(0, Math.floor(levelIndex));
  if (i < CURATED_LEVEL_COUNT) return curatedLevels[i];
  const cached = generatedCache.get(i);
  if (cached) return cached;
  const persisted = readGenerated(i);
  if (persisted) {
    generatedCache.set(i, persisted);
    return persisted;
  }
  const generated = generate(i);
  rememberGenerated(i, generated);
  return generated;
}
export function prewarmLevel(i: number) {
  if (generatedCache.has(i) || i < CURATED_LEVEL_COUNT) return;
  runWhenIdle(
    () => {
      try {
        getLevel(i);
      } catch {}
    },
    1200,
    500,
  );
}

export function readPersistedDaily(key: string) {
  const seed = hash(`cat-territory-daily-v1-${key}`),
    sizes = [6, 7, 7, 8, 8, 9, 9];
  return readDaily(key, sizes[seed % sizes.length]);
}
