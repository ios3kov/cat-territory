import { storageGet, storageSet } from './storage';

const AUTO_MARKS_KEY = 'cat-territory-auto-x-v1';

export function readAutoMarksEnabled() {
  return storageGet(AUTO_MARKS_KEY) !== 'off';
}

export function writeAutoMarksEnabled(enabled: boolean) {
  storageSet(AUTO_MARKS_KEY, enabled ? 'on' : 'off');
}
