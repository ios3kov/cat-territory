export type Difficulty = 'Easy' | 'Medium' | 'Hard';
export type BoardCell = 0 | 1 | 2;
export type HintTechnique =
  'single' | 'intersection' | 'contradiction' | 'repair';
export type LogicalHint = {
  kind: 'place' | 'eliminate' | 'repair';
  cell: number;
  highlight: number[];
  focus?: number[];
  eliminate?: number[];
  prompt: string;
  reason: string;
  technique: HintTechnique;
};
export type LogicalAnalysis = {
  solved: boolean;
  difficulty: Difficulty;
  score: number;
  singles: number;
  intersections: number;
  contradictions: number;
};
type State = { cats: Set<number>; candidates: Set<number> };
function context(regions: number[][]) {
  const size = regions.length,
    count = size * size,
    row = (c: number) => Math.floor(c / size),
    col = (c: number) => c % size,
    region = (c: number) => regions[row(c)][col(c)],
    rows = (r: number) => Array.from({ length: size }, (_, c) => r * size + c),
    cols = (c: number) => Array.from({ length: size }, (_, r) => r * size + c),
    regs = (g: number) =>
      Array.from({ length: count }, (_, c) => c).filter((c) => region(c) === g),
    conflict = (a: number, b: number) =>
      row(a) === row(b) ||
      col(a) === col(b) ||
      region(a) === region(b) ||
      (Math.abs(row(a) - row(b)) <= 1 && Math.abs(col(a) - col(b)) <= 1);
  return { size, count, row, col, region, rows, cols, regs, conflict };
}
type C = ReturnType<typeof context>;
function state(
  c: C,
  board?: BoardCell[],
  trustPlayerMarks = true,
): State | null {
  const cats = new Set<number>(),
    candidates = new Set<number>();
  for (let cell = 0; cell < c.count; cell++) {
    if (board?.[cell] === 2) cats.add(cell);
    if (!trustPlayerMarks || board?.[cell] !== 1) candidates.add(cell);
  }
  const placed = [...cats];
  for (let a = 0; a < placed.length; a++)
    for (let b = a + 1; b < placed.length; b++)
      if (c.conflict(placed[a], placed[b])) return null;
  for (const cat of cats) {
    for (const candidate of [...candidates])
      if (candidate !== cat && c.conflict(cat, candidate))
        candidates.delete(candidate);
    candidates.add(cat);
  }
  return { cats, candidates };
}
const hasCat = (cells: number[], cats: Set<number>) =>
  cells.some((c) => cats.has(c));
const candidates = (cells: number[], set: Set<number>) =>
  cells.filter((c) => set.has(c));
function single(c: C, s: State): LogicalHint | null {
  for (let r = 0; r < c.size; r++) {
    const cells = c.rows(r);
    if (hasCat(cells, s.cats)) continue;
    const x = candidates(cells, s.candidates);
    if (x.length === 1)
      return {
        kind: 'place',
        cell: x[0],
        highlight: cells,
        focus: cells,
        prompt: `Row ${r + 1} has only one open possibility.`,
        reason: `Row ${r + 1} has only one possible cell left for its cat.`,
        technique: 'single',
      };
  }
  for (let k = 0; k < c.size; k++) {
    const cells = c.cols(k);
    if (hasCat(cells, s.cats)) continue;
    const x = candidates(cells, s.candidates);
    if (x.length === 1)
      return {
        kind: 'place',
        cell: x[0],
        highlight: cells,
        focus: cells,
        prompt: `Column ${k + 1} has only one open possibility.`,
        reason: `Column ${k + 1} has only one possible cell left for its cat.`,
        technique: 'single',
      };
  }
  for (let g = 0; g < c.size; g++) {
    const cells = c.regs(g);
    if (hasCat(cells, s.cats)) continue;
    const x = candidates(cells, s.candidates);
    if (x.length === 1)
      return {
        kind: 'place',
        cell: x[0],
        highlight: cells,
        focus: cells,
        prompt: 'This territory has only one open possibility.',
        reason: 'This territory has only one possible cell left for its cat.',
        technique: 'single',
      };
  }
  return null;
}
function intersection(c: C, s: State): LogicalHint | null {
  for (let g = 0; g < c.size; g++) {
    const source = candidates(c.regs(g), s.candidates).filter(
      (x) => !s.cats.has(x),
    );
    if (source.length < 2) continue;
    const rows = new Set(source.map(c.row));
    if (rows.size === 1) {
      const r = c.row(source[0]),
        targets = candidates(c.rows(r), s.candidates).filter(
          (x) => c.region(x) !== g && !s.cats.has(x),
        );
      if (targets.length)
        return {
          kind: 'eliminate',
          cell: targets[0],
          highlight: [...source, ...targets],
          focus: source,
          eliminate: targets,
          prompt: `Every candidate in this territory sits in row ${r + 1}.`,
          reason: `This territory can place its cat only in row ${r + 1}, so other cells in that row are impossible.`,
          technique: 'intersection',
        };
    }
    const cols = new Set(source.map(c.col));
    if (cols.size === 1) {
      const k = c.col(source[0]),
        targets = candidates(c.cols(k), s.candidates).filter(
          (x) => c.region(x) !== g && !s.cats.has(x),
        );
      if (targets.length)
        return {
          kind: 'eliminate',
          cell: targets[0],
          highlight: [...source, ...targets],
          focus: source,
          eliminate: targets,
          prompt: `Every candidate in this territory sits in column ${k + 1}.`,
          reason: `This territory can place its cat only in column ${k + 1}, so other cells in that column are impossible.`,
          technique: 'intersection',
        };
    }
  }
  for (let r = 0; r < c.size; r++) {
    const source = candidates(c.rows(r), s.candidates).filter(
      (x) => !s.cats.has(x),
    );
    if (source.length < 2) continue;
    const gs = new Set(source.map(c.region));
    if (gs.size === 1) {
      const g = c.region(source[0]),
        targets = candidates(c.regs(g), s.candidates).filter(
          (x) => c.row(x) !== r && !s.cats.has(x),
        );
      if (targets.length)
        return {
          kind: 'eliminate',
          cell: targets[0],
          highlight: [...source, ...targets],
          focus: source,
          eliminate: targets,
          prompt: `Row ${r + 1} can place its cat only inside this territory.`,
          reason: `Row ${r + 1} can place its cat only in this territory, so the other cells of that territory are impossible.`,
          technique: 'intersection',
        };
    }
  }
  for (let k = 0; k < c.size; k++) {
    const source = candidates(c.cols(k), s.candidates).filter(
      (x) => !s.cats.has(x),
    );
    if (source.length < 2) continue;
    const gs = new Set(source.map(c.region));
    if (gs.size === 1) {
      const g = c.region(source[0]),
        targets = candidates(c.regs(g), s.candidates).filter(
          (x) => c.col(x) !== k && !s.cats.has(x),
        );
      if (targets.length)
        return {
          kind: 'eliminate',
          cell: targets[0],
          highlight: [...source, ...targets],
          focus: source,
          eliminate: targets,
          prompt: `Column ${k + 1} can place its cat only inside this territory.`,
          reason: `Column ${k + 1} can place its cat only in this territory, so the other cells of that territory are impossible.`,
          technique: 'intersection',
        };
    }
  }
  return null;
}
function solvable(c: C, s: State, assumed?: number) {
  const required = new Set(s.cats);
  if (assumed !== undefined) required.add(assumed);
  const req = [...required];
  for (let a = 0; a < req.length; a++)
    for (let b = a + 1; b < req.length; b++)
      if (c.conflict(req[a], req[b])) return false;
  const usedC = new Set<number>(),
    usedR = new Set<number>(),
    chosen: number[] = [];
  const search = (r: number): boolean => {
    if (r === c.size) return true;
    const forced = req.find((x) => c.row(x) === r),
      choices =
        forced !== undefined
          ? [forced]
          : c.rows(r).filter((x) => s.candidates.has(x));
    for (const cell of choices) {
      const col = c.col(cell),
        reg = c.region(cell);
      if (
        usedC.has(col) ||
        usedR.has(reg) ||
        (r > 0 && Math.abs(col - c.col(chosen[r - 1])) <= 1)
      )
        continue;
      chosen[r] = cell;
      usedC.add(col);
      usedR.add(reg);
      if (search(r + 1)) return true;
      usedC.delete(col);
      usedR.delete(reg);
    }
    return false;
  };
  return search(0);
}
function contradiction(c: C, s: State): LogicalHint | null {
  for (const cell of s.candidates)
    if (!s.cats.has(cell) && !solvable(c, s, cell))
      return {
        kind: 'eliminate',
        cell,
        highlight: [cell],
        focus: c.rows(c.row(cell)),
        eliminate: [cell],
        prompt:
          'Test the highlighted candidate: placing a cat there breaks the puzzle.',
        reason:
          'A cat here would leave no valid solution, so this cell can be marked X.',
        technique: 'contradiction',
      };
  return null;
}
function apply(c: C, s: State, h: LogicalHint) {
  if (h.kind === 'place') {
    s.cats.add(h.cell);
    for (const x of [...s.candidates])
      if (x !== h.cell && c.conflict(h.cell, x)) s.candidates.delete(x);
    s.candidates.add(h.cell);
  } else if (h.kind === 'eliminate')
    for (const x of h.eliminate ?? [h.cell]) s.candidates.delete(x);
}
function userHint(c: C, board: BoardCell[]): LogicalHint | null {
  const visible = state(c, board, false);
  if (!visible) return null;
  for (let step = 0; step < c.count * 20; step++) {
    const next =
      single(c, visible) ??
      intersection(c, visible) ??
      contradiction(c, visible);
    if (!next) return null;
    if (next.kind === 'place') {
      if (board[next.cell] === 1)
        return {
          kind: 'repair',
          cell: next.cell,
          highlight: [next.cell],
          focus: next.focus,
          prompt: 'This X conflicts with a forced cat.',
          reason: `${next.reason} Remove the X here before continuing.`,
          technique: 'repair',
        };
      if (board[next.cell] !== 2) return next;
      apply(c, visible, next);
      continue;
    }
    const targets = (next.eliminate ?? [next.cell]).filter(
      (cell) => !visible.cats.has(cell),
    );
    const remaining = targets.filter((cell) => board[cell] !== 1);
    if (remaining.length)
      return {
        ...next,
        cell: remaining[0],
        eliminate: remaining,
        highlight: [...(next.focus ?? []), ...remaining],
      };
    apply(c, visible, next);
  }
  return null;
}
function boardSolvable(c: C, b: BoardCell[]) {
  const s = state(c, b);
  return Boolean(s && solvable(c, s));
}
function repair(c: C, b: BoardCell[]): LogicalHint | null {
  const moves = Array.from({ length: c.count }, (_, x) => x).filter(
      (x) => b[x] !== 0,
    ),
    bad = moves.filter((x) => {
      const one = Array(c.count).fill(0) as BoardCell[];
      one[x] = b[x];
      return !boardSolvable(c, one);
    });
  if (bad.length)
    return {
      kind: 'repair',
      cell: bad[0],
      highlight: bad,
      focus: bad,
      prompt:
        'One or more highlighted moves cannot belong to any valid solution.',
      reason:
        'These highlighted moves cannot appear in any valid solution. Reconsider them.',
      technique: 'repair',
    };
  for (const cell of moves) {
    const without = [...b] as BoardCell[];
    without[cell] = 0;
    if (boardSolvable(c, without))
      return {
        kind: 'repair',
        cell,
        highlight: [cell],
        focus: [cell],
        prompt: 'The highlighted move is blocking every remaining valid path.',
        reason:
          'Removing this move restores a valid path. Reconsider it before continuing.',
        technique: 'repair',
      };
  }
  return null;
}
export function getLogicalHint(regions: number[][], board: BoardCell[]) {
  const c = context(regions),
    asserted = state(c, board);
  if (!asserted || !solvable(c, asserted)) return repair(c, board);
  return userHint(c, board);
}
export function analyzeLogicalPuzzle(regions: number[][]): LogicalAnalysis {
  const c = context(regions),
    s = state(c)!;
  let singles = 0,
    intersections = 0,
    contradictions = 0;
  for (let step = 0; step < c.count * 20 && s.cats.size < c.size; step++) {
    const a = single(c, s);
    if (a) {
      singles++;
      apply(c, s, a);
      continue;
    }
    const b = intersection(c, s);
    if (b) {
      intersections++;
      apply(c, s, b);
      continue;
    }
    const d = contradiction(c, s);
    if (d) {
      contradictions++;
      apply(c, s, d);
      continue;
    }
    break;
  }
  const solved = s.cats.size === c.size,
    score = singles + intersections * 10 + contradictions * 100,
    difficulty: Difficulty =
      contradictions === 0 && intersections <= 2
        ? 'Easy'
        : contradictions <= 2
          ? 'Medium'
          : 'Hard';
  return { solved, difficulty, score, singles, intersections, contradictions };
}
