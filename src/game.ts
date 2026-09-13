import type { CatalogLevel } from './levelCatalog';
export { CURATED_LEVEL_COUNT, getDailyLevel, getLevel, levelSizeAt, prewarmLevel } from './infiniteLevels';

export type CellState = 0 | 1 | 2;
export type Level = CatalogLevel;

export const HISTORY_LIMIT = 40;
export const DOUBLE_TAP_MS = 280;
export const TOUCH_DOUBLE_TAP_MS = 240;
export const DRAG_THRESHOLD_PX = 8;
export const TOUCH_DRAG_THRESHOLD_PX = 14;

export const REGION_COLORS = ['#efabb2','#f1cd72','#92cf9f','#8fc3e2','#b99bd8','#e9a3cc','#9bcfcb','#efb78f','#a9b9eb','#c3d789'] as const;

const COLOR_LAB = [
  [76.6, 26.8, 8.5], [83.5, 4.5, 48.5], [77.4, -29.1, 18.4], [75.7, -10.4, -21.6], [68.6, 22.9, -27.1],
  [75.1, 29.7, -10.7], [78.5, -20.0, -4.4], [79.0, 15.4, 27.0], [75.1, 5.8, -26.4], [82.4, -17.0, 36.1],
] as const;

function colorDistance(first: number, second: number) {
  const a = COLOR_LAB[first];
  const b = COLOR_LAB[second];
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

export function getRegionColorMap(regions: number[][]) {
  const size = regions.length;
  const regionCount = Math.max(0, ...regions.flat()) + 1;
  const neighbors = Array.from({ length: regionCount }, () => new Set<number>());
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const region = regions[row][col];
      for (const [nextRow, nextCol] of [[row + 1, col], [row, col + 1]]) {
        if (nextRow >= size || nextCol >= size) continue;
        const other = regions[nextRow][nextCol];
        if (other !== region) { neighbors[region].add(other); neighbors[other].add(region); }
      }
    }
  }
  const assigned = Array(regionCount).fill(-1) as number[];
  const remaining = new Set(Array.from({ length: regionCount }, (_, index) => index));
  while (remaining.size) {
    const region = [...remaining].sort((a, b) => {
      const saturationA = [...neighbors[a]].filter(n => assigned[n] >= 0).length;
      const saturationB = [...neighbors[b]].filter(n => assigned[n] >= 0).length;
      return saturationB - saturationA || neighbors[b].size - neighbors[a].size || a - b;
    })[0];
    const neighborColors = [...neighbors[region]].map(n => assigned[n]).filter(color => color >= 0);
    let bestColor = 0;
    let bestScore = -1;
    for (let color = 0; color < REGION_COLORS.length; color += 1) {
      const minDistance = neighborColors.length ? Math.min(...neighborColors.map(other => colorDistance(color, other))) : 100;
      const reusePenalty = assigned.filter(value => value === color).length * 0.25;
      const score = minDistance - reusePenalty;
      if (score > bestScore) { bestScore = score; bestColor = color; }
    }
    assigned[region] = bestColor;
    remaining.delete(region);
  }
  return assigned.map(color => REGION_COLORS[color]);
}

export const emptyBoard = (size: number): CellState[] => Array(size * size).fill(0) as CellState[];
export const indexOf = (row: number, col: number, size: number) => row * size + col;
export function formatTime(totalSeconds: number) { const minutes = Math.floor(totalSeconds / 60); const seconds = totalSeconds % 60; return `${minutes}:${seconds.toString().padStart(2, '0')}`; }
export function isBlockedByCat(level: Level, catIndex: number, cellIndex: number) { if (catIndex === cellIndex) return false; const size=level.size, catRow=Math.floor(catIndex/size), catCol=catIndex%size, row=Math.floor(cellIndex/size), col=cellIndex%size; const sameRegion=level.regions[catRow][catCol]===level.regions[row][col]; const touching=Math.abs(catRow-row)<=1&&Math.abs(catCol-col)<=1; return catRow===row||catCol===col||sameRegion||touching; }
export function applySmartMarks(level: Level, board: CellState[], catIndex: number) { const next=[...board] as CellState[]; next[catIndex]=2; for(let cell=0;cell<next.length;cell+=1) if(next[cell]===0&&isBlockedByCat(level,catIndex,cell)) next[cell]=1; return next; }
export function createInitialBoard(level: Level) { let board=emptyBoard(level.size); for(const catIndex of level.starterCats) board=applySmartMarks(level,board,catIndex); return board; }
export function boardsEqual(first: CellState[], second: CellState[]) { return first.length===second.length&&first.every((value,index)=>value===second[index]); }
export function findConflicts(board: CellState[], level: Level) { const conflicts=new Set<number>(); const cats=board.flatMap((value,index)=>(value===2?[index]:[])); for(let a=0;a<cats.length;a+=1) for(let b=a+1;b<cats.length;b+=1) if(isBlockedByCat(level,cats[a],cats[b])) { conflicts.add(cats[a]); conflicts.add(cats[b]); } return conflicts; }
