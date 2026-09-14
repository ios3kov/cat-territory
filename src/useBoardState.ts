import { useCallback, useState, type SetStateAction } from 'react';
import type { CellState } from './game';
import { getCatOrder, rememberCatOrder } from './catOrder';

export function useBoardState(initial: CellState[]) {
  const [board, update] = useState(() => rememberCatOrder(initial));
  const setBoard = useCallback((action: SetStateAction<CellState[]>) => {
    update((previous) => {
      const next = typeof action === 'function' ? action(previous) : action;
      return rememberCatOrder(next, getCatOrder(previous));
    });
  }, []);
  return [board, setBoard] as const;
}
