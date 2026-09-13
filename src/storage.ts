export function storageGet(key: string) { try { return localStorage.getItem(key); } catch { return null; } }
export function storageSet(key: string, value: string) { try { localStorage.setItem(key, value); return true; } catch { return false; } }
export function storageRemove(key: string) { try { localStorage.removeItem(key); } catch { /* Storage can be unavailable in strict/private browser contexts. */ } }
