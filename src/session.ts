import { getCatOrder, rememberCatOrder } from './catOrder';
import { HISTORY_LIMIT, type Level, type CellState } from './game';
import { storageGet, storageRemove, storageSet } from './storage';
type LevelSession = {
  board: CellState[];
  catOrder?: unknown;
  historyCatOrders?: unknown;
  history: CellState[][];
  seconds: number;
  started: boolean;
  mistakes: number;
  usedHint: boolean;
  savedAtMs?: number;
};
const sessionKey = (id: string) => `cat-territory-session-v3-${id}`;
const isCell = (v: unknown): v is CellState => v === 0 || v === 1 || v === 2;
const isBoard = (v: unknown, size: number): v is CellState[] =>
  Array.isArray(v) && v.length === size * size && v.every(isCell);
const isHistory = (v: unknown, size: number): v is CellState[][] =>
  Array.isArray(v) &&
  v.length <= HISTORY_LIMIT &&
  v.every((b) => isBoard(b, size));
function parseSession(raw: string | null, size: number): LevelSession | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Partial<LevelSession>;
    if (
      !p ||
      typeof p !== 'object' ||
      (p.savedAtMs !== undefined &&
        (!Number.isFinite(p.savedAtMs) || p.savedAtMs < 0)) ||
      !isBoard(p.board, size) ||
      (p.history !== undefined && !isHistory(p.history, size)) ||
      !Number.isFinite(p.seconds) ||
      Number(p.seconds) < 0 ||
      (p.started !== undefined && typeof p.started !== 'boolean') ||
      (p.mistakes !== undefined &&
        (!Number.isInteger(p.mistakes) || p.mistakes < 0 || p.mistakes > 2)) ||
      (p.usedHint !== undefined && typeof p.usedHint !== 'boolean')
    )
      return null;
    const started = p.started ?? false,
      savedAt = p.savedAtMs,
      elapsed =
        started && savedAt !== undefined
          ? Math.max(0, Math.floor((Date.now() - savedAt) / 1000))
          : 0;
    const snapshots = p.history ?? [];
    snapshots.forEach((board, index) =>
      rememberCatOrder(
        board,
        Array.isArray(p.historyCatOrders)
          ? p.historyCatOrders[index]
          : undefined,
      ),
    );
    rememberCatOrder(p.board, p.catOrder);
    return {
      board: p.board,
      history: p.history ?? [],
      seconds: Math.floor(Number(p.seconds)) + elapsed,
      started,
      mistakes: p.mistakes ?? 0,
      usedHint: p.usedHint ?? false,
      savedAtMs: savedAt,
    };
  } catch {
    return null;
  }
}
export function loadLevelSession(id: string, size: number, level?: Level) {
  const key = sessionKey(id),
    raw = storageGet(key),
    parsed = parseSession(raw, size);
  const validBoard = (board: CellState[]) =>
    !level ||
    (level.starterCats.every((i) => board[i] === 2) &&
      board.every(
        (value, i) =>
          value !== 2 || level.solution[Math.floor(i / size)] === i % size,
      ));
  const session =
    parsed && validBoard(parsed.board) && parsed.history.every(validBoard)
      ? parsed
      : null;
  if (raw && !session) storageRemove(key);
  return session;
}
export function saveLevelSession(
  id: string,
  board: CellState[],
  seconds: number,
  history: CellState[][],
  started: boolean,
  mistakes: number,
  usedHint = false,
) {
  storageSet(
    sessionKey(id),
    JSON.stringify({
      board,
      history: history.slice(-HISTORY_LIMIT),
      catOrder: getCatOrder(board),
      historyCatOrders: history.slice(-HISTORY_LIMIT).map(getCatOrder),
      seconds: Math.max(0, Math.floor(seconds)),
      started,
      mistakes: Math.min(Math.max(Math.floor(mistakes), 0), 2),
      usedHint,
      savedAtMs: Date.now(),
    }),
  );
}
export function clearLevelSession(id: string) {
  storageRemove(sessionKey(id));
}
