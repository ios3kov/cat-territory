import { getLevel } from './infiniteLevels';
import type { Difficulty } from './puzzleEngine';

export type CatalogLevel = {
  id: string;
  name: string;
  size: number;
  regions: number[][];
  solution: number[];
  difficulty: Difficulty;
  searchNodes: number;
  logicalScore: number;
  source: 'curated' | 'generated';
  chapter: number;
  chapterName: string;
  starterCats: number[];
  special?: 'moon-run';
};

/**
 * Compatibility view for older callers. The catalog is no longer baked into
 * the bundle: these 24 entries come from the same generator as every later level.
 */
export function buildLevelCatalog() {
  return Array.from({ length: 24 }, (_, index) => getLevel(index));
}
