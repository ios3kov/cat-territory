import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { recordDailyCompletion, type Achievement } from './achievements';
import { playSound } from './audio';
import {
  getDailyKey,
  getDailyLevel,
  isDailyComplete,
  readDailyProgress,
  readDailyResult,
  recordDailyWin,
  saveDailyResult,
} from './daily';
import {
  boardsEqual,
  createInitialBoard,
  findConflicts,
  type CellState,
} from './game';
import { trapTabKey } from './GameDialogs';
import { haptic } from './haptics';
import { getSolveResult, type SolveResult } from './score';
import { clearLevelSession, loadLevelSession } from './session';
import { useBoardGestures } from './useBoardGestures';
import { useBoardState } from './useBoardState';
import { useCellFeedback } from './useCellFeedback';
import { useGameClock } from './useGameClock';
import { usePuzzleHints } from './usePuzzleHints';
import { useRestartConfirmation } from './useRestartConfirmation';
import { useSessionPersistence } from './useSessionPersistence';
export type DailyProps = {
  onClose: () => void;
  onAchievements: (items: Achievement[]) => void;
};
export function useDailyController({ onClose, onAchievements }: DailyProps) {
  const key = useMemo(() => getDailyKey(), []),
    level = useMemo(() => getDailyLevel(new Date(`${key}T12:00:00Z`)), [key]),
    saved = useMemo(
      () => loadLevelSession(level.id, level.size, level),
      [level.id, level.size],
    ),
    pristine = useMemo(() => createInitialBoard(level), [level]),
    fixedCells = useMemo(() => new Set<number>(), []),
    initialStreak = useMemo(() => readDailyProgress().currentStreak, []);
  const [board, setBoard] = useBoardState(saved?.board ?? pristine),
    [history, setHistory] = useState<CellState[][]>(saved?.history ?? []),
    [mistakes, setMistakes] = useState(saved?.mistakes ?? 0),
    [mistakeNotice, setMistakeNotice] = useState<string | null>(null),
    [mistakeCell, setMistakeCell] = useState<number | null>(null),
    [correctCell, setCorrectCell] = useState<number | null>(null),
    [summary, setSummary] = useState<SolveResult | null>(() => {
      const r = readDailyResult(key);
      if (!r) return null;
      return getSolveResult(r.size, r.seconds, r.mistakes, r.usedHint);
    }),
    [won, setWon] = useState(isDailyComplete(key)),
    [celebrating, setCelebrating] = useState(false),
    [streak, setStreak] = useState(initialStreak),
    [displayedStreak, setDisplayedStreak] = useState(initialStreak),
    [streakAnimating, setStreakAnimating] = useState(false),
    cellFeedback = useCellFeedback();
  const {
    armed: restartArmed,
    cancel: cancelRestart,
    confirm: confirmRestart,
  } = useRestartConfirmation();
  const {
    usedHint,
    getUsedHint,
    hintInfo,
    hintRevealed,
    dismissHint,
    resetHints,
    requestHint,
  } = usePuzzleHints(saved?.usedHint);
  const {
    seconds,
    started,
    start: startTimer,
    restore: restoreClock,
  } = useGameClock(saved, won || celebrating);
  const mistakesRef = useRef(mistakes),
    feedbackTimer = useRef<number | null>(null),
    noticeTimer = useRef<number | null>(null),
    correctTimer = useRef<number | null>(null),
    completionTimer = useRef<number | null>(null),
    streakStepTimer = useRef<number | null>(null),
    streakAnimationTimer = useRef<number | null>(null),
    dialogRef = useRef<HTMLElement>(null),
    backRef = useRef<HTMLButtonElement>(null),
    previousFocus = useRef<HTMLElement | null>(null),
    resetRef = useRef<() => void>(() => undefined);
  const conflicts = useMemo(() => findConflicts(board, level), [board, level]),
    catCount = useMemo(() => board.filter((v) => v === 2).length, [board]),
    solved = catCount === level.size && conflicts.size === 0,
    shouldPersist =
      !solved &&
      !won &&
      !celebrating &&
      mistakes < 3 &&
      (started || !boardsEqual(board, pristine));
  useSessionPersistence({
    levelId: level.id,
    board,
    seconds,
    history,
    started,
    mistakes,
    usedHint,
    persist: shouldPersist,
  });
  useEffect(() => {
    previousFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    backRef.current?.focus();
    return () => previousFocus.current?.focus();
  }, []);
  useEffect(() => {
    if (won) backRef.current?.focus();
  }, [won]);
  const keyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    trapTabKey(e, dialogRef.current);
  };
  const registerCorrect = (idx: number) => {
      if (correctTimer.current !== null) clearTimeout(correctTimer.current);
      setCorrectCell(idx);
      playSound('correct');
      correctTimer.current = window.setTimeout(() => setCorrectCell(null), 500);
    },
    registerMistake = (idx: number, restore: () => void) => {
      if (mistakeCell !== null || won || celebrating) return;
      const next = Math.min(3, mistakesRef.current + 1);
      mistakesRef.current = next;
      setMistakes(next);
      setMistakeCell(idx);
      setMistakeNotice(
        next === 3
          ? '3 mistakes · Restarting…'
          : `Wrong cat · Mistake ${next}/3`,
      );
      if (noticeTimer.current !== null) clearTimeout(noticeTimer.current);
      noticeTimer.current = window.setTimeout(
        () => setMistakeNotice(null),
        next === 3 ? 1600 : 1400,
      );
      playSound(next === 3 ? 'strikeout' : 'mistake');
      haptic(next === 3 ? 'strikeout' : 'mistake');
      if (feedbackTimer.current !== null) clearTimeout(feedbackTimer.current);
      feedbackTimer.current = window.setTimeout(() => {
        if (next === 3) resetRef.current();
        else {
          restore();
          setMistakeCell(null);
        }
      }, 520);
    };
  const gestures = useBoardGestures({
    board,
    level,
    setBoard,
    setHistory,
    disabled: won || celebrating || mistakeCell !== null,
    fixedCells,
    onBoardInteraction: dismissHint,
    onFirstInteraction: startTimer,
    onCellChange: (idx, mode, source) => {
      cellFeedback.flashCell(
        idx,
        source === 'swipe'
          ? mode === 'erase'
            ? 'swipe-erase'
            : 'swipe-paint'
          : mode,
      );
      if (source !== 'auto') playSound(mode === 'erase' ? 'erase' : 'mark');
    },
    onCatRemoved: () => {
      playSound('catRemove');
    },
    onCorrectCat: registerCorrect,
    onMistake: registerMistake,
  });
  const reset = () => {
    [feedbackTimer, noticeTimer, correctTimer, completionTimer].forEach((r) => {
      if (r.current !== null) clearTimeout(r.current);
      r.current = null;
    });
    setMistakeNotice(null);
    cancelRestart();
    gestures.resetInteraction();
    cellFeedback.clear();
    clearLevelSession(level.id);
    setBoard(pristine);
    setHistory([]);
    restoreClock();
    mistakesRef.current = 0;
    setMistakes(0);
    resetHints();
    setMistakeCell(null);
    setCorrectCell(null);
    setSummary(null);
    setCelebrating(false);
  };
  resetRef.current = reset;
  const requestRestart = () => {
    if (celebrating || mistakeCell !== null) return;
    const has = !boardsEqual(board, pristine) || mistakes > 0 || usedHint;
    if (!has) return;
    if (!confirmRestart()) return;
    playSound('restart');
    haptic('restart');
    reset();
  };
  useEffect(() => {
    if (!solved || won || celebrating) return;
    setCelebrating(true);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    completionTimer.current = window.setTimeout(
      () => {
        clearLevelSession(level.id);
        playSound('win');
        haptic('win');
        setSummary(
          getSolveResult(level.size, seconds, mistakes, getUsedHint()),
        );
        saveDailyResult({
          key,
          size: level.size,
          seconds,
          mistakes,
          usedHint: getUsedHint(),
        });
        const p = recordDailyWin(key),
          next = p.currentStreak;
        if (next !== streak) {
          playSound('streak');
          haptic('milestone');
          setStreakAnimating(true);
          streakStepTimer.current = window.setTimeout(
            () => setDisplayedStreak(next),
            120,
          );
          streakAnimationTimer.current = window.setTimeout(
            () => setStreakAnimating(false),
            700,
          );
        } else setDisplayedStreak(next);
        setStreak(next);
        onAchievements(recordDailyCompletion(next));
        setWon(true);
        setCelebrating(false);
      },
      reduced ? 0 : 700,
    );
  }, [
    celebrating,
    key,
    level.id,
    level.size,
    mistakes,
    onAchievements,
    seconds,
    solved,
    streak,
    won,
  ]);
  useEffect(
    () => () => {
      [
        feedbackTimer,
        noticeTimer,
        correctTimer,
        completionTimer,
        streakStepTimer,
        streakAnimationTimer,
      ].forEach((r) => {
        if (r.current !== null) clearTimeout(r.current);
      });
    },
    [],
  );
  const undo = () => {
      const previous = history.at(-1);
      if (!previous || won || celebrating || mistakeCell !== null) return;
      gestures.resetInteraction();
      cellFeedback.flashDiff(board, previous);
      setBoard(previous);
      setHistory((h) => h.slice(0, -1));
      playSound('rollback');
      haptic('undo');
    },
    hint = () => {
      if (won || celebrating || mistakeCell !== null) return;
      startTimer();
      gestures.resetInteraction();
      requestHint(
        level,
        board,
        'Recheck uncertain marks and look for the row, column or territory with the fewest candidates.',
      );
    },
    hintCanReveal = Boolean(hintInfo && !hintRevealed && hintInfo.cell >= 0),
    hintText = hintInfo
      ? hintRevealed
        ? hintInfo.reason
        : hintInfo.prompt
      : '',
    hintTitle = !hintRevealed
      ? 'Think here'
      : hintInfo?.kind === 'place'
        ? 'Place cat'
        : hintInfo?.kind === 'eliminate'
          ? 'Mark X'
          : 'Check this',
    milestone = [3, 7, 30].find((v) => displayedStreak < v) ?? null;
  return {
    dialogRef,
    keyDown,
    won,
    backRef,
    key,
    level,
    streakAnimating,
    displayedStreak,
    summary,
    milestone,
    board,
    mistakes,
    mistakeCell,
    correctCell,
    hintInfo,
    hintRevealed,
    cellFeedback,
    celebrating,
    gestures,
    mistakeNotice,
    hintTitle,
    hintText,
    hintCanReveal,
    hint,
    dismissHint,
    undo,
    history,
    restartArmed,
    requestRestart,
  };
}
