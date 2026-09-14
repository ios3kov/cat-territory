import { useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import {
  DOUBLE_TAP_MS,
  DRAG_THRESHOLD_PX,
  HISTORY_LIMIT,
  TOUCH_DOUBLE_TAP_MS,
  TOUCH_DRAG_THRESHOLD_PX,
  applySmartMarks,
  type CellState,
  type Level,
} from './game';
import { haptic } from './haptics';
type DragMode = 'paint' | 'erase';
type InputSource = 'tap' | 'swipe' | 'auto';
type DragState = {
  startIdx: number;
  startX: number;
  startY: number;
  pointerType: string;
  moved: boolean;
  historySaved: boolean;
  mode: DragMode;
  visited: Set<number>;
  snapshot: CellState[];
};
type Options = {
  board: CellState[];
  level: Level;
  setBoard: Dispatch<SetStateAction<CellState[]>>;
  setHistory: Dispatch<SetStateAction<CellState[][]>>;
  disabled: boolean;
  fixedCells: Set<number>;
  onFirstInteraction?: () => void;
  onBoardInteraction?: () => void;
  onCellChange?: (idx: number, mode: DragMode, source: InputSource) => void;
  onCatRemoved?: () => void;
  onCorrectCat?: (idx: number) => void;
  onMistake?: (idx: number, restore: () => void) => void;
};
export function useBoardGestures({
  board,
  level,
  setBoard,
  setHistory,
  disabled,
  fixedCells,
  onFirstInteraction,
  onBoardInteraction,
  onCellChange,
  onCatRemoved,
  onCorrectCat,
  onMistake,
}: Options) {
  const boardRef = useRef(board),
    lastTap = useRef<{
      idx: number;
      time: number;
      original: CellState;
      pointerType: string;
    } | null>(null),
    dragRef = useRef<DragState | null>(null),
    feedbackLocked = useRef(false),
    moveFrameRef = useRef<number | null>(null),
    pendingMoveRef = useRef<{ x: number; y: number } | null>(null),
    smartMarkTimersRef = useRef<number[]>([]),
    smartFinalRef = useRef<CellState[] | null>(null);
  useEffect(() => {
    boardRef.current = board;
  }, [board]);
  const clearSmartMarkTimers = () => {
    for (const timer of smartMarkTimersRef.current) clearTimeout(timer);
    smartMarkTimersRef.current = [];
    smartFinalRef.current = null;
    feedbackLocked.current = false;
  };
  useEffect(
    () => () => {
      if (moveFrameRef.current !== null)
        cancelAnimationFrame(moveFrameRef.current);
      moveFrameRef.current = null;
      pendingMoveRef.current = null;
      clearSmartMarkTimers();
    },
    [],
  );
  const isSolutionCell = (idx: number) =>
    level.solution[Math.floor(idx / level.size)] === idx % level.size;
  const commitBoard = (next: CellState[]) => {
    const previous = boardRef.current;
    setHistory((current) => [...current.slice(-(HISTORY_LIMIT - 1)), previous]);
    boardRef.current = next;
    setBoard(next);
  };
  const clearPendingTap = () => {
    lastTap.current = null;
  };
  const placeCorrectCat = (
    idx: number,
    current: CellState[],
    saveHistory: boolean,
  ) => {
    clearSmartMarkTimers();
    const finalBoard = applySmartMarks(level, current, idx),
      firstFrame = [...current] as CellState[];
    firstFrame[idx] = 2;
    const catRow = Math.floor(idx / level.size),
      catCol = idx % level.size;
    const smartMarks = finalBoard
      .flatMap((value, cell) =>
        value === 1 && firstFrame[cell] === 0 ? [cell] : [],
      )
      .sort((a, b) => {
        const ar = Math.floor(a / level.size),
          ac = a % level.size,
          br = Math.floor(b / level.size),
          bc = b % level.size;
        return (
          Math.hypot(ar - catRow, ac - catCol) -
            Math.hypot(br - catRow, bc - catCol) || a - b
        );
      });
    if (saveHistory)
      setHistory((history) => [
        ...history.slice(-(HISTORY_LIMIT - 1)),
        current,
      ]);
    boardRef.current = firstFrame;
    setBoard(firstFrame);
    onCorrectCat?.(idx);
    haptic('cat');
    if (
      !smartMarks.length ||
      matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      boardRef.current = finalBoard;
      setBoard(finalBoard);
      return;
    }
    feedbackLocked.current = true;
    smartFinalRef.current = finalBoard;
    const stepMs = Math.min(34, 360 / smartMarks.length);
    smartMarks.forEach((cell, order) => {
      const timer = setTimeout(
        () => {
          const frame = [...boardRef.current] as CellState[];
          if (frame[idx] !== 2) {
            clearSmartMarkTimers();
            return;
          }
          frame[cell] = 1;
          boardRef.current = frame;
          setBoard(frame);
          onCellChange?.(cell, 'paint', 'auto');
          if (order === smartMarks.length - 1) {
            boardRef.current = finalBoard;
            setBoard(finalBoard);
            feedbackLocked.current = false;
            smartFinalRef.current = null;
            smartMarkTimersRef.current = [];
          }
        },
        28 + order * stepMs,
      );
      smartMarkTimersRef.current.push(timer);
    });
  };
  const handleTap = (idx: number, pointerType = 'mouse') => {
    if (disabled || feedbackLocked.current || fixedCells.has(idx)) return;
    const now = Date.now(),
      previousTap = lastTap.current,
      current = boardRef.current,
      tapGap = previousTap ? now - previousTap.time : Infinity,
      doubleTapWindow =
        pointerType === 'touch' || previousTap?.pointerType === 'touch'
          ? TOUCH_DOUBLE_TAP_MS
          : DOUBLE_TAP_MS;
    if (
      previousTap &&
      previousTap.idx === idx &&
      tapGap >= 70 &&
      tapGap <= doubleTapWindow
    ) {
      clearPendingTap();
      onFirstInteraction?.();
      if (previousTap.original === 2) {
        const next = [...current] as CellState[];
        next[idx] = 0;
        commitBoard(next);
        onCatRemoved?.();
        haptic('remove');
      } else if (!isSolutionCell(idx)) {
        const restored = [...current] as CellState[];
        restored[idx] = previousTap.original;
        const preview = [...restored] as CellState[];
        preview[idx] = 2;
        feedbackLocked.current = true;
        boardRef.current = preview;
        setBoard(preview);
        const restore = () => {
          boardRef.current = restored;
          setBoard(restored);
          setHistory((items) => items.slice(0, -1));
          feedbackLocked.current = false;
        };
        if (onMistake) onMistake(idx, restore);
        else restore();
        return;
      } else placeCorrectCat(idx, current, false);
      return;
    }
    lastTap.current = { idx, time: now, original: current[idx], pointerType };
    if (current[idx] === 2) return;
    onFirstInteraction?.();
    const mode: DragMode = current[idx] === 1 ? 'erase' : 'paint',
      next = [...current] as CellState[];
    next[idx] = mode === 'erase' ? 0 : 1;
    commitBoard(next);
    onCellChange?.(idx, mode, 'tap');
    haptic(mode);
  };
  const keyboardMark = (idx: number) => {
    if (disabled || feedbackLocked.current || fixedCells.has(idx)) return;
    onBoardInteraction?.();
    clearPendingTap();
    onFirstInteraction?.();
    const current = boardRef.current;
    if (current[idx] === 2) return;
    const mode: DragMode = current[idx] === 1 ? 'erase' : 'paint',
      next = [...current] as CellState[];
    next[idx] = mode === 'erase' ? 0 : 1;
    commitBoard(next);
    onCellChange?.(idx, mode, 'tap');
    haptic(mode);
  };
  const toggleCat = (idx: number) => {
    if (disabled || feedbackLocked.current) return;
    onBoardInteraction?.();
    if (fixedCells.has(idx)) return;
    clearPendingTap();
    onFirstInteraction?.();
    const current = boardRef.current;
    if (current[idx] === 2) {
      const next = [...current] as CellState[];
      next[idx] = 0;
      commitBoard(next);
      onCatRemoved?.();
    } else if (!isSolutionCell(idx)) {
      const restored = current,
        preview = [...current] as CellState[];
      preview[idx] = 2;
      feedbackLocked.current = true;
      boardRef.current = preview;
      setBoard(preview);
      const restore = () => {
        boardRef.current = restored;
        setBoard(restored);
        feedbackLocked.current = false;
      };
      if (onMistake) onMistake(idx, restore);
      else restore();
    } else placeCorrectCat(idx, current, true);
  };
  const applyDragCell = (idx: number) => {
    const drag = dragRef.current;
    if (!drag || drag.visited.has(idx) || fixedCells.has(idx)) return false;
    drag.visited.add(idx);
    const current = boardRef.current,
      sourceState: CellState = drag.mode === 'erase' ? 1 : 0,
      targetState: CellState = drag.mode === 'erase' ? 0 : 1;
    if (current[idx] !== sourceState) return false;
    if (!drag.historySaved) {
      setHistory((history) => [
        ...history.slice(-(HISTORY_LIMIT - 1)),
        drag.snapshot,
      ]);
      drag.historySaved = true;
      onFirstInteraction?.();
    }
    const next = [...current] as CellState[];
    next[idx] = targetState;
    boardRef.current = next;
    setBoard(next);
    onCellChange?.(idx, drag.mode, 'swipe');
    haptic(drag.mode);
    return true;
  };
  const pointerDown = (
    idx: number,
    clientX: number,
    clientY: number,
    pointerType = 'mouse',
  ) => {
    if (disabled || feedbackLocked.current) return;
    onBoardInteraction?.();
    if (fixedCells.has(idx)) return;
    dragRef.current = {
      startIdx: idx,
      startX: clientX,
      startY: clientY,
      pointerType,
      moved: false,
      historySaved: false,
      mode: boardRef.current[idx] === 1 ? 'erase' : 'paint',
      visited: new Set(),
      snapshot: boardRef.current,
    };
  };
  const processPointerMove = (clientX: number, clientY: number) => {
    const drag = dragRef.current;
    if (!drag || disabled) return;
    const distance = Math.hypot(clientX - drag.startX, clientY - drag.startY),
      touchThreshold =
        level.size >= 9 ? TOUCH_DRAG_THRESHOLD_PX + 2 : TOUCH_DRAG_THRESHOLD_PX,
      dragThreshold =
        drag.pointerType === 'touch'
          ? Math.max(DRAG_THRESHOLD_PX, touchThreshold)
          : DRAG_THRESHOLD_PX;
    if (!drag.moved && distance < dragThreshold) return;
    if (!drag.moved) {
      drag.moved = true;
      clearPendingTap();
      applyDragCell(drag.startIdx);
    }
    const element = document.elementFromPoint(
        clientX,
        clientY,
      ) as HTMLElement | null,
      cell = element?.closest<HTMLElement>('[data-cell-index]'),
      rawIndex = cell?.dataset.cellIndex;
    if (rawIndex !== undefined) applyDragCell(Number(rawIndex));
  };
  const flushPendingPointerMove = () => {
    if (moveFrameRef.current !== null) {
      cancelAnimationFrame(moveFrameRef.current);
      moveFrameRef.current = null;
    }
    const pending = pendingMoveRef.current;
    pendingMoveRef.current = null;
    if (pending) processPointerMove(pending.x, pending.y);
  };
  const pointerMove = (clientX: number, clientY: number) => {
    if (!dragRef.current || disabled) return;
    pendingMoveRef.current = { x: clientX, y: clientY };
    if (moveFrameRef.current !== null) return;
    moveFrameRef.current = requestAnimationFrame(() => {
      moveFrameRef.current = null;
      const pending = pendingMoveRef.current;
      pendingMoveRef.current = null;
      if (pending) processPointerMove(pending.x, pending.y);
    });
  };
  const pointerEnd = () => {
    flushPendingPointerMove();
    const drag = dragRef.current;
    if (!drag) return;
    if (!drag.moved) handleTap(drag.startIdx, drag.pointerType);
    dragRef.current = null;
  };
  const resetInteraction = () => {
    if (moveFrameRef.current !== null)
      cancelAnimationFrame(moveFrameRef.current);
    moveFrameRef.current = null;
    pendingMoveRef.current = null;
    lastTap.current = null;
    dragRef.current = null;
    const final = smartFinalRef.current;
    clearSmartMarkTimers();
    if (final) {
      boardRef.current = final;
      setBoard(final);
    }
  };
  const pointerCancel = () => {
    const drag = dragRef.current;
    if (drag?.historySaved) {
      boardRef.current = drag.snapshot;
      setBoard(drag.snapshot);
      setHistory((current) => current.slice(0, -1));
    }
    resetInteraction();
  };
  const finishMouseDragOnLeave = () => {
    if (dragRef.current?.moved) pointerEnd();
  };
  return {
    handleTap,
    keyboardMark,
    toggleCat,
    pointerDown,
    pointerMove,
    pointerEnd,
    pointerCancel,
    finishMouseDragOnLeave,
    resetInteraction,
  };
}
