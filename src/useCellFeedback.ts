import { useEffect, useRef, useState } from 'react';
import type { CellState } from './game';
export type CellFeedbackKind =
  | 'paint'
  | 'erase'
  | 'swipe-paint'
  | 'swipe-erase'
  | 'undo';
export type CellFeedbackEntry = {
  kind: CellFeedbackKind;
  token: number;
  delayMs?: number;
};
export type CellFeedbackMap = Record<number, CellFeedbackEntry>;
export function useCellFeedback() {
  const [effects, setEffects] = useState<CellFeedbackMap>({}),
    sequence = useRef(0),
    timers = useRef(new Set<number>());
  const flashCells = (
    indices: number[],
    kind: CellFeedbackKind,
    duration = 260,
    delays?: ReadonlyMap<number, number>,
  ) => {
    const unique = [...new Set(indices)];
    if (!unique.length) return;
    sequence.current += 1;
    const token = sequence.current,
      maxDelay = unique.reduce(
        (maximum, idx) => Math.max(maximum, delays?.get(idx) ?? 0),
        0,
      );
    setEffects((current) => {
      const next = { ...current };
      for (const idx of unique)
        next[idx] = { kind, token, delayMs: delays?.get(idx) ?? 0 };
      return next;
    });
    const timer = window.setTimeout(() => {
      setEffects((current) => {
        let changed = false;
        const next = { ...current };
        for (const idx of unique)
          if (next[idx]?.token === token) {
            delete next[idx];
            changed = true;
          }
        return changed ? next : current;
      });
      timers.current.delete(timer);
    }, duration + maxDelay);
    timers.current.add(timer);
  };
  const flashCell = (idx: number, kind: CellFeedbackKind, duration = 260) =>
    flashCells([idx], kind, duration);
  const flashDiff = (
    from: CellState[],
    to: CellState[],
    kind: CellFeedbackKind = 'undo',
  ) => {
    const changed: number[] = [];
    for (let idx = 0; idx < Math.min(from.length, to.length); idx += 1)
      if (from[idx] !== to[idx]) changed.push(idx);
    flashCells(changed, kind, 180);
  };
  const clear = () => {
    for (const timer of timers.current) clearTimeout(timer);
    timers.current.clear();
    setEffects({});
  };
  useEffect(
    () => () => {
      for (const timer of timers.current) clearTimeout(timer);
    },
    [],
  );
  return { effects, flashCell, flashCells, flashDiff, clear };
}
