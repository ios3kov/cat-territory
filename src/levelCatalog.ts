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
