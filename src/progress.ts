import { storageGet, storageSet } from './storage';
const CURRENT_LEVEL_KEY = 'cat-territory-current-level-v3';
const MIGRATION_KEY = 'cat-territory-progress-migrated-v3';
const V2_CURRENT_LEVEL_KEY = 'cat-territory-current-level-v2';
const V2_COMPLETE_KEY = 'cat-territory-campaign-complete-v2';
const V2_MIGRATION_KEY = 'cat-territory-progress-migrated-v2';
const LEGACY_UNLOCKED_KEY = 'cat-territory-unlocked-level-v1';
function migrateProgress() {
  if (storageGet(MIGRATION_KEY) === '1') return;
  let current: number;
  if (storageGet(V2_MIGRATION_KEY) === '1') {
    const v2Current = Number(storageGet(V2_CURRENT_LEVEL_KEY) ?? '0');
    current = Number.isInteger(v2Current) ? Math.max(0, v2Current) : 0;
    if (storageGet(V2_COMPLETE_KEY) === '1') current = Math.max(current, 24);
  } else {
    const legacy = Number(storageGet(LEGACY_UNLOCKED_KEY) ?? '0');
    current = Number.isInteger(legacy) ? Math.max(0, legacy) : 0;
  }
  storageSet(CURRENT_LEVEL_KEY, String(current));
  storageSet(MIGRATION_KEY, '1');
}
export function readUnlockedLevel() {
  migrateProgress();
  const current = Number(storageGet(CURRENT_LEVEL_KEY) ?? '0');
  return Number.isSafeInteger(current) && current >= 0 ? current : 0;
}
export function isLevelCompleted(levelIndex: number) {
  return levelIndex < readUnlockedLevel();
}
export function completeLevel(levelIndex: number) {
  const current = readUnlockedLevel();
  const unlockedIndex = Math.max(current, levelIndex + 1);
  storageSet(CURRENT_LEVEL_KEY, String(unlockedIndex));
  return { unlockedIndex };
}
