import { useRestartConfirmation } from './useRestartConfirmation';
import { usePuzzleHints } from './usePuzzleHints';
import { useGameClock } from './useGameClock';
import { useBoardState } from './useBoardState';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getAchievementSnapshot,
  getBestTimeForSize,
  recordLevelCompletion,
  syncAchievementProgress,
  type Achievement,
} from './achievements';
import { playSound } from './audio';
import {
  boardsEqual,
  createInitialBoard,
  findConflicts,
  getLevel,
  prewarmLevel,
  prepareLevel,
  type CellState,
} from './game';
import { haptic } from './haptics';
import { completeLevel, readUnlockedLevel } from './progress';
import { getSolveResult, type SolveResult } from './score';
import { clearTimer, runWhenIdle, scheduleTimer } from './scheduler';
import { clearLevelSession, loadLevelSession } from './session';
import { useBoardGestures } from './useBoardGestures';
import { useCellFeedback } from './useCellFeedback';
import { useSessionPersistence } from './useSessionPersistence';
import { trackGameplayEvent } from './telemetry';
type InitialGameState = {
  levelIndex: number;
  unlockedLevelIndex: number;
  level: ReturnType<typeof getLevel>;
  session: ReturnType<typeof loadLevelSession>;
};
export type CompletionSummary = SolveResult & { personalBest: boolean };
function createInitialGameState(): InitialGameState {
  const unlockedLevelIndex = readUnlockedLevel(),
    level = getLevel(unlockedLevelIndex);
  syncAchievementProgress(unlockedLevelIndex);
  return {
    levelIndex: unlockedLevelIndex,
    unlockedLevelIndex,
    level,
    session: loadLevelSession(level.id, level.size, level),
  };
}
export function useGameController(autoMarksEnabled: boolean) {
  const initialRef = useRef<InitialGameState | null>(null);
  if (!initialRef.current) initialRef.current = createInitialGameState();
  const initial = initialRef.current,
    initialLevel = initial.level;
  const [levelIndex, setLevelIndex] = useState(initial.levelIndex),
    [unlockedLevelIndex, setUnlockedLevelIndex] = useState(
      initial.unlockedLevelIndex,
    ),
    [board, setBoard] = useBoardState(
      initial.session?.board ?? createInitialBoard(initialLevel),
    ),
    [history, setHistory] = useState<CellState[][]>(
      initial.session?.history ?? [],
    ),
    [mistakes, setMistakes] = useState(initial.session?.mistakes ?? 0),
    [mistakeNotice, setMistakeNotice] = useState<string | null>(null),
    [mistakeCell, setMistakeCell] = useState<number | null>(null),
    [correctCell, setCorrectCell] = useState<number | null>(null),
    [completionSummary, setCompletionSummary] =
      useState<CompletionSummary | null>(null),
    [restartingFromMistakes, setRestartingFromMistakes] = useState(false),
    [won, setWon] = useState(false),
    [completionReady, setCompletionReady] = useState(false),
    [levelLeaving, setLevelLeaving] = useState(false),
    [idleHelpVisible, setIdleHelpVisible] = useState(false),
    [achievementQueue, setAchievementQueue] = useState<Achievement[]>([]),
    [achievementCount, setAchievementCount] = useState(
      () => getAchievementSnapshot().filter((i) => i.unlocked).length,
    ),
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
  } = usePuzzleHints(initial.session?.usedHint);
  const {
    seconds,
    started: timerStarted,
    start: startTimer,
    restore: restoreClock,
  } = useGameClock(initial.session, won || restartingFromMistakes);
  const mistakesRef = useRef(mistakes),
    idleHelpTimer = useRef<number | null>(null),
    mistakeRestartTimer = useRef<number | null>(null),
    mistakeFeedbackTimer = useRef<number | null>(null),
    correctFeedbackTimer = useRef<number | null>(null),
    mistakeNoticeTimer = useRef<number | null>(null),
    achievementToastTimer = useRef<number | null>(null),
    completionTimer = useRef<number | null>(null),
    trackedLevelStartRef = useRef<string | null>(null),
    trackedFirstMoveRef = useRef<string | null>(null);
  const level = useMemo(() => getLevel(levelIndex), [levelIndex]),
    pristineBoard = useMemo(() => createInitialBoard(level), [level]),
    fixedCells = useMemo(() => new Set(level.starterCats), [level]),
    conflicts = useMemo(() => findConflicts(board, level), [board, level]),
    catCount = useMemo(() => board.filter((v) => v === 2).length, [board]),
    solved = catCount === level.size && conflicts.size === 0,
    shouldPersist =
      mistakes < 3 &&
      !restartingFromMistakes &&
      !won &&
      !solved &&
      (timerStarted || !boardsEqual(board, pristineBoard));
  useSessionPersistence({
    levelId: level.id,
    board,
    seconds,
    history,
    started: timerStarted,
    mistakes,
    usedHint,
    persist: shouldPersist,
  });
  const track = (name: Parameters<typeof trackGameplayEvent>[0]) =>
      trackGameplayEvent(name, level.id, levelIndex, seconds),
    showMistakeNotice = (message: string, duration = 1200) => {
      setMistakeNotice(message);
      scheduleTimer(mistakeNoticeTimer, () => setMistakeNotice(null), duration);
    };
  const registerCorrectCat = (idx: number) => {
    clearTimer(correctFeedbackTimer);
    setCorrectCell(idx);
    setIdleHelpVisible(false);
    playSound('correct');
    scheduleTimer(correctFeedbackTimer, () => setCorrectCell(null), 520);
  };
  const registerMistake = (idx: number, restore: () => void) => {
    if (won || restartingFromMistakes || mistakeCell !== null) return;
    const next = Math.min(3, mistakesRef.current + 1);
    mistakesRef.current = next;
    setMistakes(next);
    setMistakeCell(idx);
    setIdleHelpVisible(false);
    playSound(next === 3 ? 'strikeout' : 'mistake');
    track('mistake');
    if (next < 3) {
      showMistakeNotice(`Wrong spot · Mistake ${next}/3`);
      haptic('mistake');
      mistakeFeedbackTimer.current = window.setTimeout(() => {
        restore();
        setMistakeCell(null);
        mistakeFeedbackTimer.current = null;
      }, 520);
      return;
    }
    showMistakeNotice('3 mistakes — restarting…', 900);
    setRestartingFromMistakes(true);
    track('mistake_restart');
    haptic('strikeout');
    clearTimer(mistakeRestartTimer);
    mistakeRestartTimer.current = window.setTimeout(
      () => resetCurrentLevel(true),
      520,
    );
  };
  const gestures = useBoardGestures({
    autoMarksEnabled,
    board,
    level,
    setBoard,
    setHistory,
    disabled: won || restartingFromMistakes || mistakeCell !== null,
    fixedCells,
    onBoardInteraction: dismissHint,
    onCellChange: (idx, mode, source) => {
      const kind =
        source === 'swipe'
          ? mode === 'erase'
            ? 'swipe-erase'
            : 'swipe-paint'
          : mode;
      cellFeedback.flashCell(idx, kind);
      if (source !== 'auto') playSound(mode === 'erase' ? 'erase' : 'mark');
    },
    onCatRemoved: () => {
      playSound('catRemove');
    },
    onCorrectCat: registerCorrectCat,
    onMistake: registerMistake,
    onFirstInteraction: () => {
      startTimer();
      if (trackedFirstMoveRef.current !== level.id) {
        trackedFirstMoveRef.current = level.id;
        track('first_move');
      }
    },
  });
  function resetCurrentLevel(fromMistakes = false) {
    gestures.resetInteraction();
    cellFeedback.clear();
    [
      mistakeRestartTimer,
      mistakeFeedbackTimer,
      correctFeedbackTimer,
      completionTimer,
    ].forEach(clearTimer);
    clearLevelSession(level.id);
    setBoard(createInitialBoard(level));
    setHistory([]);
    setWon(false);
    setCompletionReady(false);
    setCompletionSummary(null);
    cancelRestart();
    restoreClock();
    mistakesRef.current = 0;
    setMistakes(0);
    resetHints();
    setIdleHelpVisible(false);
    setMistakeCell(null);
    setCorrectCell(null);
    setRestartingFromMistakes(false);
    trackedFirstMoveRef.current = null;
    if (fromMistakes)
      showMistakeNotice('Three mistakes — level restarted.', 1600);
    else {
      clearTimer(mistakeNoticeTimer);
      setMistakeNotice(null);
    }
  }
  useEffect(() => {
    if (trackedLevelStartRef.current !== level.id) {
      trackedLevelStartRef.current = level.id;
      trackGameplayEvent('level_start', level.id, levelIndex, seconds);
    }
    return runWhenIdle(() => prewarmLevel(levelIndex + 1), 5000, 2500);
  }, [level.id, levelIndex]);
  useEffect(() => {
    dismissHint();
    cancelRestart();
  }, [board, levelIndex, dismissHint, cancelRestart]);
  useEffect(() => {
    setIdleHelpVisible(false);
    clearTimer(idleHelpTimer);
    if (timerStarted && !won && !restartingFromMistakes)
      idleHelpTimer.current = window.setTimeout(
        () => setIdleHelpVisible(true),
        45000,
      );
    return () => clearTimer(idleHelpTimer);
  }, [board, levelIndex, timerStarted, won, restartingFromMistakes]);
  useEffect(() => {
    if (!solved || won) return;
    setWon(true);
    setCompletionReady(false);
    track('level_complete');
    haptic('win');
    clearLevelSession(level.id);
    const previousBest = getBestTimeForSize(level.size),
      summary: CompletionSummary = {
        ...getSolveResult(level.size, seconds, mistakes, getUsedHint()),
        personalBest: previousBest === null || seconds < previousBest,
      };
    setCompletionSummary(summary);
    const progress = completeLevel(levelIndex);
    if (progress.unlockedIndex !== unlockedLevelIndex)
      setUnlockedLevelIndex(progress.unlockedIndex);
    const unlocked = recordLevelCompletion({
      levelIndex,
      size: level.size,
      seconds,
      mistakes,
      usedHint: getUsedHint(),
    });
    setAchievementCount(
      getAchievementSnapshot().filter((i) => i.unlocked).length,
    );
    if (unlocked.length) setAchievementQueue((q) => [...q, ...unlocked]);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    completionTimer.current = window.setTimeout(
      () => {
        playSound('win');
        setCompletionReady(true);
        completionTimer.current = null;
      },
      reduced ? 0 : 700,
    );
  }, [
    level.id,
    level.size,
    levelIndex,
    mistakes,
    seconds,
    solved,
    unlockedLevelIndex,
    won,
  ]);
  useEffect(() => {
    const current = achievementQueue[0];
    if (!current) return;
    playSound(current.secret ? 'secretAchievement' : 'achievement');
    haptic(current.secret ? 'secretAchievement' : 'achievement');
    clearTimer(achievementToastTimer);
    achievementToastTimer.current = window.setTimeout(() => {
      setAchievementQueue((q) => q.slice(1));
      achievementToastTimer.current = null;
    }, 2800);
    return () => clearTimer(achievementToastTimer);
  }, [achievementQueue]);
  useEffect(
    () => () => {
      gestures.resetInteraction();
      cellFeedback.clear();
      [
        idleHelpTimer,
        mistakeRestartTimer,
        mistakeFeedbackTimer,
        correctFeedbackTimer,
        mistakeNoticeTimer,
        achievementToastTimer,
        completionTimer,
      ].forEach(clearTimer);
    },
    [],
  );
  const undo = () => {
      const previous = history.at(-1);
      if (!previous || won || restartingFromMistakes || mistakeCell !== null)
        return;
      gestures.resetInteraction();
      cellFeedback.flashDiff(board, previous);
      setBoard(previous);
      setHistory((h) => h.slice(0, -1));
      playSound('rollback');
      haptic('undo');
      track('undo');
    },
    restart = () => {
      if (restartingFromMistakes || mistakeCell !== null) return;
      const has =
        !boardsEqual(board, pristineBoard) || mistakes > 0 || usedHint;
      if (!has) return;
      if (!confirmRestart()) {
        track('restart_arm');
        return;
      }
      track('restart_confirm');
      playSound('restart');
      haptic('restart');
      resetCurrentLevel();
    },
    hint = () => {
      if (won || restartingFromMistakes || mistakeCell !== null) return;
      startTimer();
      gestures.resetInteraction();
      const action = requestHint(
        level,
        board,
        'No forced move is available from the current marks. Recheck the board and clear any uncertain X marks.',
      );
      if (action === 'reveal') track('hint_reveal');
      if (action === 'open') {
        track('hint_open');
        setIdleHelpVisible(false);
      }
    },
    refreshAchievementCount = () =>
      setAchievementCount(
        getAchievementSnapshot().filter((i) => i.unlocked).length,
      );
  const nextLevelBusy = useRef(false),
    mounted = useRef(false),
    exitTransition = useRef<{ timer: number; finish: () => void } | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      const exit = exitTransition.current;
      if (exit) {
        clearTimeout(exit.timer);
        exit.finish();
        exitTransition.current = null;
      }
    };
  }, []);
  const nextLevel = async () => {
    const next = levelIndex + 1;
    if (!won || next > unlockedLevelIndex || nextLevelBusy.current) return;
    nextLevelBusy.current = true;
    try {
      await prepareLevel(next);
      if (!mounted.current) return;
      // Keep the solved board visible throughout generation. Only leave when ready.
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setLevelLeaving(true);
        await new Promise<void>((finish) => {
          exitTransition.current = {
            timer: window.setTimeout(() => {
              exitTransition.current = null;
              finish();
            }, 180),
            finish,
          };
        });
      }
      if (!mounted.current) return;
      gestures.resetInteraction();
      cellFeedback.clear();
      playSound('next');
      const l = getLevel(next),
        saved = loadLevelSession(l.id, l.size, l),
        restoredSeconds = saved?.seconds ?? 0,
        restoredStarted = saved?.started ?? false,
        restoredMistakes = saved?.mistakes ?? 0,
        restoredHint = saved?.usedHint ?? false;
      setLevelIndex(next);
      setBoard(saved?.board ?? createInitialBoard(l));
      setHistory(saved?.history ?? []);
      setWon(false);
      setCompletionReady(false);
      setCompletionSummary(null);
      cancelRestart();
      setMistakeNotice(null);
      setMistakeCell(null);
      setCorrectCell(null);
      setRestartingFromMistakes(false);
      restoreClock(restoredSeconds, restoredStarted);
      mistakesRef.current = restoredMistakes;
      setMistakes(restoredMistakes);
      resetHints(restoredHint);
      trackedFirstMoveRef.current = null;
    } finally {
      nextLevelBusy.current = false;
      if (mounted.current) setLevelLeaving(false);
    }
  };
  return {
    level,
    levelIndex,
    board,
    history,
    seconds,
    timerStarted,
    mistakes,
    usedHint,
    mistakeNotice,
    mistakeCell,
    correctCell,
    completionSummary,
    restartingFromMistakes,
    won,
    completionReady,
    levelLeaving,
    restartArmed,
    conflicts,
    catCount,
    hintInfo,
    hintRevealed,
    idleHelpVisible,
    achievementToast: achievementQueue[0] ?? null,
    achievementCount,
    refreshAchievementCount,
    cellFeedback: cellFeedback.effects,
    gestures,
    undo,
    restart,
    hint,
    dismissHint,
    nextLevel,
  };
}
