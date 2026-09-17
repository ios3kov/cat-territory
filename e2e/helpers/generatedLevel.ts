import { applySmartMarks, createInitialBoard } from '../../src/game';
import { getLevel } from '../../src/infiniteLevels';

export function levelData(index = 0) {
  const level = getLevel(index),
    solutionCells = level.solution.map((col, row) => row * level.size + col),
    solution = new Set(solutionCells),
    wrongCell = Array.from({ length: level.size * level.size }, (_, cell) => cell).find(
      (cell) => !solution.has(cell),
    )!;
  return {
    level,
    solutionCells,
    wrongCell,
    sessionKey: `cat-territory-session-v3-${level.id}`,
    cacheKey: `cat-territory-generated-v5-${index}`,
  };
}

export function smartMarkCells(index: number, cats: number[]) {
  const { level } = levelData(index);
  let board = createInitialBoard(level);
  for (const cat of cats) board = applySmartMarks(level, board, cat);
  return board.flatMap((value, cell) => (value === 1 ? [cell] : []));
}
