/** Remove retired-mode saves without touching the endless journey or preferences. */
export function removeRetiredModeSaves() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (
        key.startsWith('cat-territory-daily-') ||
        key.startsWith('cat-territory-session-v3-daily-')
      )
        localStorage.removeItem(key);
    }
  } catch {
    // Storage is optional in restricted browsing contexts.
  }
}
