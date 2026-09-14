import { analyzeLogicalPuzzle, type Difficulty } from './logicalEngine';
export type { Difficulty } from './logicalEngine';
export type PuzzleAnalysis = {
  solutionCount: number;
  firstSolution: number[] | null;
  searchNodes: number;
  difficulty: Difficulty;
  logicalScore: number;
  logicalSolved: boolean;
};
export function analyzePuzzle(
  regions: number[][],
  solutionLimit = 2,
): PuzzleAnalysis {
  const size = regions.length;
  let solutionCount = 0,
    firstSolution: number[] | null = null,
    searchNodes = 0;
  const usedColumns = new Set<number>(),
    usedRegions = new Set<number>(),
    placement: number[] = [];
  const search = (row: number, previousCol: number | null) => {
    if (solutionCount >= solutionLimit) return;
    if (row === size) {
      solutionCount += 1;
      if (!firstSolution) firstSolution = [...placement];
      return;
    }
    for (let col = 0; col < size; col += 1) {
      const region = regions[row][col];
      if (usedColumns.has(col) || usedRegions.has(region)) continue;
      if (previousCol !== null && Math.abs(col - previousCol) <= 1) continue;
      searchNodes += 1;
      placement[row] = col;
      usedColumns.add(col);
      usedRegions.add(region);
      search(row + 1, col);
      usedColumns.delete(col);
      usedRegions.delete(region);
      if (solutionCount >= solutionLimit) return;
    }
  };
  search(0, null);
  const logical = analyzeLogicalPuzzle(regions);
  return {
    solutionCount,
    firstSolution,
    searchNodes,
    difficulty: logical.difficulty,
    logicalScore: logical.score,
    logicalSolved: logical.solved,
  };
}
