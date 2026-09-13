export type TimerRef = { current: number | null };
export function clearTimer(ref: TimerRef) { if (ref.current !== null) window.clearTimeout(ref.current); ref.current = null; }
export function scheduleTimer(ref: TimerRef, callback: () => void, delay: number) { clearTimer(ref); ref.current = window.setTimeout(() => { ref.current = null; callback(); }, delay); }
export function runWhenIdle(callback: () => void, timeout = 5000, fallbackDelay = 2000) { if ('requestIdleCallback' in window) { window.requestIdleCallback(callback, { timeout }); return; } window.setTimeout(callback, fallbackDelay); }
