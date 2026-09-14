import { useEffect, useRef, useState } from 'react';
import type { CellState } from './game';
export type CellFeedbackKind =
  'paint' | 'erase' | 'swipe-paint' | 'swipe-erase' | 'undo';
export type CellFeedbackEntry = { kind: CellFeedbackKind; token: number };
export type CellFeedbackMap = Record<number, CellFeedbackEntry>;
export function useCellFeedback() {
  const [effects, setEffects] = useState<CellFeedbackMap>({}),
    sequence = useRef(0),
    timers = useRef(new Map<number, number>());
  const flashCell = (idx: number, kind: CellFeedbackKind, duration = 260) => {
    sequence.current += 1;
    const token = sequence.current,
      existing = timers.current.get(idx);
    if (existing !== undefined) clearTimeout(existing);
    setEffects((c) => ({ ...c, [idx]: { kind, token } }));
    const timer = window.setTimeout(() => {
      setEffects((c) => {
        if (c[idx]?.token !== token) return c;
        const n = { ...c };
        delete n[idx];
        return n;
      });
      timers.current.delete(idx);
    }, duration);
    timers.current.set(idx, timer);
  };
  const flashDiff = (
    from: CellState[],
    to: CellState[],
    kind: CellFeedbackKind = 'undo',
  ) => {
    for (let idx = 0; idx < Math.min(from.length, to.length); idx += 1)
      if (from[idx] !== to[idx]) flashCell(idx, kind, 180);
  };
  const clear = () => {
    for (const timer of timers.current.values()) clearTimeout(timer);
    timers.current.clear();
    setEffects({});
  };
  useEffect(
    () => () => {
      for (const timer of timers.current.values()) clearTimeout(timer);
    },
    [],
  );
  return { effects, flashCell, flashDiff, clear };
}
