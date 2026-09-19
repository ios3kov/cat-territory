import { useCallback, useEffect, useRef } from 'react';
import type { CellState } from './game';
import { saveLevelSession } from './session';
import { BEFORE_UPDATE_EVENT } from './serviceWorkerUpdates';
type Snapshot = {
  levelId: string;
  board: CellState[];
  seconds: number;
  history: CellState[][];
  started: boolean;
  mistakes: number;
  usedHint?: boolean;
  persist: boolean;
};
const SAVE_DELAY_MS = 280;
export function useSessionPersistence(snapshot: Snapshot) {
  const latest = useRef(snapshot),
    timer = useRef<number | null>(null);
  latest.current = snapshot;
  const flush = useCallback(() => {
    const c = latest.current;
    if (c.persist)
      saveLevelSession(
        c.levelId,
        c.board,
        c.seconds,
        c.history,
        c.started,
        c.mistakes,
        c.usedHint ?? false,
      );
  }, []);
  useEffect(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    if (!snapshot.persist) return;
    timer.current = window.setTimeout(() => {
      flush();
      timer.current = null;
    }, SAVE_DELAY_MS);
    return () => {
      if (timer.current !== null) {
        clearTimeout(timer.current);
        timer.current = null;
      }
    };
  }, [
    flush,
    snapshot.board,
    snapshot.history,
    snapshot.levelId,
    snapshot.mistakes,
    snapshot.persist,
    snapshot.started,
    snapshot.usedHint,
  ]);
  useEffect(() => {
    if (snapshot.persist) return;
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, [snapshot.persist]);
  useEffect(() => {
    const visibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    window.addEventListener(BEFORE_UPDATE_EVENT, flush);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('pagehide', flush);
      window.removeEventListener(BEFORE_UPDATE_EVENT, flush);
      document.removeEventListener('visibilitychange', visibility);
      flush();
    };
  }, [flush]);
}
