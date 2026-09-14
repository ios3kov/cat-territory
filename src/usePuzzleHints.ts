import { useCallback, useRef, useState } from 'react';
import { playSound } from './audio';
import type { CellState, Level } from './game';
import { haptic } from './haptics';
import { getLogicalHint, type LogicalHint } from './logicalEngine';

export function usePuzzleHints(initialUsed = false) {
  const [usedHint, setUsedHint] = useState(initialUsed);
  const used = useRef(initialUsed);
  const [hintInfo, setHintInfo] = useState<LogicalHint | null>(null);
  const [hintRevealed, setHintRevealed] = useState(false);
  const dismissHint = useCallback(() => {
    setHintInfo(null);
    setHintRevealed(false);
  }, []);
  const resetHints = useCallback(
    (restoredUsed = false) => {
      used.current = restoredUsed;
      setUsedHint(restoredUsed);
      dismissHint();
    },
    [dismissHint],
  );
  const getUsedHint = useCallback(() => used.current, []);
  const requestHint = (
    level: Level,
    board: CellState[],
    fallbackReason: string,
  ) => {
    if (!used.current) {
      used.current = true;
      setUsedHint(true);
    }
    if (hintInfo) {
      if (!hintRevealed && hintInfo.cell >= 0) {
        playSound('reveal');
        haptic('reveal');
        setHintRevealed(true);
        return 'reveal';
      }
      return null;
    }
    playSound('hint');
    haptic('hint');
    const next =
      getLogicalHint(level.regions, board) ??
      ({
        kind: 'repair',
        cell: -1,
        highlight: [],
        prompt: 'No forced move is visible from the current marks.',
        reason: fallbackReason,
        technique: 'repair',
      } satisfies LogicalHint);
    setHintInfo(next);
    if (next.cell < 0) setHintRevealed(true);
    return 'open';
  };
  return {
    usedHint,
    getUsedHint,
    hintInfo,
    hintRevealed,
    dismissHint,
    resetHints,
    requestHint,
  };
}
