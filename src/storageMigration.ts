/** Retire old modes and reset pre-starter-free sessions once, preserving progression and preferences. */
export function removeRetiredModeSaves() {
  try {
    const starterMigrationKey = 'cat-territory-starter-free-v1';
    const removeLegacySessions = !localStorage.getItem(starterMigrationKey);
    for (const key of Object.keys(localStorage)) {
      if (
        key.startsWith('cat-territory-daily-') ||
        key.startsWith('cat-territory-session-v3-daily-') ||
        (removeLegacySessions && key.startsWith('cat-territory-session-v3-'))
      )
        localStorage.removeItem(key);
    }
    if (removeLegacySessions) localStorage.setItem(starterMigrationKey, '1');
  } catch {
    // Storage is optional in restricted browsing contexts.
  }
}
