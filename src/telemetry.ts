import { storageGet, storageSet } from './storage';
const KEY = 'cat-territory-telemetry-v1',
  MAX = 240,
  SESSION = 'cat-territory-session-id-v1';
export type TelemetryEventName =
  | 'level_start'
  | 'first_move'
  | 'hint_open'
  | 'hint_reveal'
  | 'undo'
  | 'restart_arm'
  | 'restart_confirm'
  | 'mistake'
  | 'mistake_restart'
  | 'level_complete';
type Event = {
  name: TelemetryEventName;
  sessionId: string;
  levelId: string;
  levelIndex: number;
  elapsed: number;
  at: number;
};
function read(): Event[] {
  const raw = storageGet(KEY);
  if (!raw) return [];
  try {
    const p = JSON.parse(raw);
    return Array.isArray(p)
      ? p.filter(
          (i) => i && typeof i === 'object' && 'name' in i && 'levelId' in i,
        )
      : [];
  } catch {
    return [];
  }
}
let cached: string | null = null;
function sessionId() {
  if (cached) return cached;
  try {
    const existing = sessionStorage.getItem(SESSION);
    if (existing) {
      cached = existing;
      return existing;
    }
  } catch {
    /* Session storage may be disabled; keep the in-memory session ID. */
  }
  const next =
    crypto.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  cached = next;
  try {
    sessionStorage.setItem(SESSION, next);
  } catch {
    /* Session storage may be disabled; keep the in-memory session ID. */
  }
  return next;
}
export function trackGameplayEvent(
  name: TelemetryEventName,
  levelId: string,
  levelIndex: number,
  elapsed: number,
) {
  const events = read();
  events.push({
    name,
    sessionId: sessionId(),
    levelId,
    levelIndex,
    elapsed,
    at: Date.now(),
  });
  storageSet(KEY, JSON.stringify(events.slice(-MAX)));
}
