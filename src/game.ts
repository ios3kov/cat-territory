import { rememberCatOrder } from './catOrder';
import type { CatalogLevel } from './levelCatalog';
export {
  CURATED_LEVEL_COUNT,
  getDailyLevel,
  getLevel,
  levelSizeAt,
  prewarmLevel,
  prepareLevel,
} from './levelResource';
export type CellState = 0 | 1 | 2;
export type Level = CatalogLevel;
export const HISTORY_LIMIT = 40;
export const DOUBLE_TAP_MS = 280;
export const TOUCH_DOUBLE_TAP_MS = 240;
export const DRAG_THRESHOLD_PX = 8;
export const TOUCH_DRAG_THRESHOLD_PX = 14;
export const REGION_COLORS = [
  '#efabb2',
  '#f1cd72',
  '#92cf9f',
  '#8fc3e2',
  '#b99bd8',
  '#e9a3cc',
  '#9bcfcb',
  '#efb78f',
  '#a9b9eb',
  '#c3d789',
] as const;
const COLOR_LAB = [
  [76.6, 26.8, 8.5],
  [83.5, 4.5, 48.5],
  [77.4, -29.1, 18.4],
  [75.7, -10.4, -21.6],
  [68.6, 22.9, -27.1],
  [75.1, 29.7, -10.7],
  [78.5, -20, -4.4],
  [79, 15.4, 27],
  [75.1, 5.8, -26.4],
  [82.4, -17, 36.1],
] as const;
function colorDistance(a: number, b: number) {
  const x = COLOR_LAB[a],
    y = COLOR_LAB[b];
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}
export function getRegionColorMap(regions: number[][]) {
  const ids = [...new Set(regions.flat())].sort((a, b) => a - b);
  if (ids.length > REGION_COLORS.length)
    throw new Error(
      `Need ${ids.length} unique territory colors; palette has ${REGION_COLORS.length}.`,
    );
  const neighbors = new Map(ids.map((id) => [id, new Set<number>()]));
  for (let row = 0; row < regions.length; row++)
    for (let col = 0; col < regions[row].length; col++)
      for (const [nextRow, nextCol] of [
        [row + 1, col],
        [row, col + 1],
      ]) {
        if (nextRow >= regions.length || nextCol >= regions[nextRow].length)
          continue;
        const a = regions[row][col],
          b = regions[nextRow][nextCol];
        if (a !== b) {
          neighbors.get(a)?.add(b);
          neighbors.get(b)?.add(a);
        }
      }
  const assigned = new Map<number, number>();
  const unused = new Set(REGION_COLORS.map((_, index) => index));
  while (assigned.size < ids.length) {
    const saturation = (id: number) =>
      new Set(
        [...neighbors.get(id)!]
          .map((n) => assigned.get(n))
          .filter((v): v is number => v !== undefined),
      ).size;
    const region = ids
      .filter((id) => !assigned.has(id))
      .sort(
        (a, b) =>
          saturation(b) - saturation(a) ||
          neighbors.get(b)!.size - neighbors.get(a)!.size ||
          a - b,
      )[0];
    const used = [...assigned.values()];
    const adjacent = [...neighbors.get(region)!]
      .map((n) => assigned.get(n))
      .filter((v): v is number => v !== undefined);
    let best = -1,
      bestScore = -Infinity;
    for (const color of unused) {
      const globalMin = used.length
        ? Math.min(...used.map((other) => colorDistance(color, other)))
        : 100;
      const adjacentMin = adjacent.length
        ? Math.min(...adjacent.map((other) => colorDistance(color, other)))
        : 100;
      const score = adjacentMin * 2 + globalMin;
      if (score > bestScore) {
        bestScore = score;
        best = color;
      }
    }
    assigned.set(region, best);
    unused.delete(best);
  }
  const result = Array(Math.max(...ids, 0) + 1).fill(
    REGION_COLORS[0],
  ) as string[];
  for (const id of ids) result[id] = REGION_COLORS[assigned.get(id)!];
  return result;
}
export const emptyBoard = (size: number): CellState[] =>
  Array(size * size).fill(0) as CellState[];
export const indexOf = (row: number, col: number, size: number) =>
  row * size + col;
export function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60),
    seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
export function isBlockedByCat(
  level: Level,
  catIndex: number,
  cellIndex: number,
) {
  if (catIndex === cellIndex) return false;
  const size = level.size,
    catRow = Math.floor(catIndex / size),
    catCol = catIndex % size,
    row = Math.floor(cellIndex / size),
    col = cellIndex % size;
  const sameRegion = level.regions[catRow][catCol] === level.regions[row][col];
  const touching = Math.abs(catRow - row) <= 1 && Math.abs(catCol - col) <= 1;
  return catRow === row || catCol === col || sameRegion || touching;
}
export function applySmartMarks(
  level: Level,
  board: CellState[],
  catIndex: number,
) {
  const next = [...board] as CellState[];
  next[catIndex] = 2;
  for (let cell = 0; cell < next.length; cell++)
    if (next[cell] === 0 && isBlockedByCat(level, catIndex, cell))
      next[cell] = 1;
  return next;
}
export function createInitialBoard(level: Level) {
  let board = emptyBoard(level.size);
  for (const catIndex of level.starterCats)
    board = applySmartMarks(level, board, catIndex);
  return rememberCatOrder(board);
}
export function boardsEqual(first: CellState[], second: CellState[]) {
  return (
    first.length === second.length &&
    first.every((value, index) => value === second[index])
  );
}
export function findConflicts(board: CellState[], level: Level) {
  const conflicts = new Set<number>();
  const cats = board.flatMap((value, index) => (value === 2 ? [index] : []));
  for (let a = 0; a < cats.length; a++)
    for (let b = a + 1; b < cats.length; b++)
      if (isBlockedByCat(level, cats[a], cats[b])) {
        conflicts.add(cats[a]);
        conflicts.add(cats[b]);
      }
  return conflicts;
}
