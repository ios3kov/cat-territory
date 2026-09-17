import { AchievementIcon } from './AchievementIcon';
import { LoadingTerritory } from './LoadingTerritory';
import {
  CircleHelp,
  Lightbulb,
  RotateCcw,
  Sparkles,
  Trophy,
  Undo2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { playSound, readSoundEnabled, setSoundEnabled } from './audio';
import { readAutoMarksEnabled, writeAutoMarksEnabled } from './autoMarks';
import { CatProgress } from './CatProgress';
import { ContextPanel } from './ContextPanel';
import { GameBoard } from './GameBoard';
import { haptic } from './haptics';
import { MistakeIndicator } from './MistakeIndicator';
import { getProgressionMeta } from './progression';
import { storageGet, storageSet } from './storage';
import { useGameController } from './useGameController';
const RulesDialog = lazy(() =>
  import('./GameDialogs').then((m) => ({ default: m.RulesDialog })),
);
const AchievementsDialog = lazy(() =>
  import('./GameDialogs').then((m) => ({ default: m.AchievementsDialog })),
);
const WinDialog = lazy(() =>
  import('./GameDialogs').then((m) => ({ default: m.WinDialog })),
);
type CoachStep = 'tap' | 'cat' | 'done';
const COACH_KEY = 'cat-territory-gesture-coach-v3';
function readCoachStep(): CoachStep {
  const v = storageGet(COACH_KEY);
  if (v === 'tap' || v === 'cat') return v;
  return v ? 'done' : 'tap';
}
function App() {
  const [autoMarksEnabled, setAutoMarksEnabled] =
    useState(readAutoMarksEnabled);
  const game = useGameController(autoMarksEnabled);
  const [showRules, setShowRules] = useState(false),
    [showAchievements, setShowAchievements] = useState(false),
    [soundEnabled, setSoundEnabledState] = useState(readSoundEnabled),
    [rankPulse, setRankPulse] = useState(false),
    [coachStep, setCoachStep] = useState<CoachStep>(readCoachStep);
  const progression = getProgressionMeta(game.levelIndex),
    previousProgression = useRef({
      levelIndex: game.levelIndex,
      rank: progression.rank,
    });
  const hintCanReveal = Boolean(
    game.hintInfo && !game.hintRevealed && game.hintInfo.cell >= 0,
  );
  const hintCells = useMemo(() => {
    const hint = game.hintInfo;
    if (!hint) return undefined;
    const clue = hint.focus ?? [];
    return game.hintRevealed
      ? Array.from(new Set([...clue, ...hint.highlight]))
      : clue;
  }, [game.hintInfo, game.hintRevealed]);
  const solutionCells = useMemo(
    () =>
      new Set(
        game.level.solution.map((col, row) => row * game.level.size + col),
      ),
    [game.level],
  );
  const setCoach = (next: CoachStep) => {
    storageSet(COACH_KEY, next);
    setCoachStep(next);
  };
  useEffect(() => {
    if (game.levelIndex !== 0 || coachStep === 'done') return;
    const feedback = Object.values(game.cellFeedback);
    if (coachStep === 'tap' && feedback.some((e) => e.kind === 'paint'))
      setCoach('cat');
    else if (coachStep === 'cat' && game.correctCell !== null) setCoach('done');
  }, [coachStep, game.cellFeedback, game.correctCell, game.levelIndex]);
  useEffect(() => {
    const previous = previousProgression.current;
    if (previous.levelIndex === game.levelIndex) return;
    let rankTimer: number | null = null,
      moonTimer: number | null = null;
    const changed = previous.rank !== progression.rank;
    if (changed) {
      setRankPulse(true);
      playSound('rankUp');
      haptic('milestone');
      rankTimer = window.setTimeout(() => setRankPulse(false), 720);
    }
    if (progression.special)
      moonTimer = window.setTimeout(
        () => {
          playSound('moonRun');
          haptic('milestone');
        },
        changed ? 170 : 0,
      );
    previousProgression.current = {
      levelIndex: game.levelIndex,
      rank: progression.rank,
    };
    return () => {
      if (rankTimer !== null) clearTimeout(rankTimer);
      if (moonTimer !== null) clearTimeout(moonTimer);
    };
  }, [game.levelIndex, progression.rank, progression.special]);
  const coachCell =
    game.levelIndex === 0 && coachStep !== 'done'
      ? coachStep === 'cat'
        ? game.level.solution
            .map((col, row) => row * game.level.size + col)
            .find(
              (idx) =>
                !game.level.starterCats.includes(idx) && game.board[idx] !== 2,
            )
        : coachStep === 'tap'
          ? game.board.findIndex(
              (v, idx) =>
                v === 0 &&
                !solutionCells.has(idx) &&
                !game.level.starterCats.includes(idx),
            )
          : undefined
      : undefined;
  const coachLabel =
    coachStep === 'tap'
      ? 'Tap'
      : coachStep === 'cat'
        ? 'Double tap'
        : undefined;
  const coachText =
    coachStep === 'tap'
      ? 'Tap the outlined tile to draw an X. Tap again to erase.'
      : 'Double tap the outlined tile to place a cat. Keyboard: press C.';
  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    setSoundEnabledState(next);
    if (next) playSound('ui');
  };
  const toggleAutoMarks = () => {
    const next = !autoMarksEnabled;
    writeAutoMarksEnabled(next);
    setAutoMarksEnabled(next);
    if (next) game.gestures.fillExistingSmartMarks();
    playSound('ui');
  };
  const open = (setter: (v: boolean) => void) => {
    playSound('uiOpen');
    setter(true);
  };
  const close = (setter: (v: boolean) => void) => {
    playSound('uiClose');
    setter(false);
  };
  const blocking =
    showRules ||
    showAchievements ||
    (game.won && game.winDialogReady && Boolean(game.completionSummary));
  const hintText = game.hintInfo
    ? game.hintRevealed
      ? game.hintInfo.reason
      : game.hintInfo.prompt
    : '';
  const hintTitle = !game.hintRevealed
    ? 'Think here'
    : game.hintInfo?.kind === 'place'
      ? 'Place cat'
      : game.hintInfo?.kind === 'eliminate'
        ? 'Mark X'
        : 'Check this';
  return (
    <main className="app-shell">
      <section
        className="game-card"
        inert={blocking}
        aria-hidden={blocking || undefined}
      >
        <header className="topbar">
          <div className="title-stack">
            <p className="eyebrow">CAT TERRITORY</p>
            <div className="title-line">
              <h1>{game.level.name}</h1>
              {progression.special && (
                <span
                  className={`difficulty-badge difficulty-${game.level.difficulty.toLowerCase()}`}
                >
                  {game.level.difficulty}
                </span>
              )}
            </div>
            <div className="subhead-row">
              <p
                className={`chapter-label ${progression.special ? 'moon-run-label' : ''} ${rankPulse ? 'rank-up-label' : ''}`}
              >
                Level {game.levelIndex + 1} · {game.level.size}×
                {game.level.size} ·{' '}
                {game.level.source === 'generated'
                  ? `${progression.special ? `Moon Run ${progression.run}` : `Run ${progression.run}: ${progression.runName}`} · ${progression.rank}`
                  : `Chapter ${game.level.chapter}`}
              </p>
            </div>
          </div>
          <div className="top-actions">
            <button
              className={`icon-button quiet-icon-button sound-button ${soundEnabled ? '' : 'sound-off'}`}
              onClick={toggleSound}
              aria-label={`Sound effects ${soundEnabled ? 'on' : 'off'}`}
            >
              {soundEnabled ? <Volume2 size={19} /> : <VolumeX size={19} />}
            </button>
            <button
              className="icon-button quiet-icon-button achievement-button"
              onClick={() => open(setShowAchievements)}
              aria-label={`Progress and achievements, ${game.achievementCount} unlocked`}
            >
              <Trophy size={19} />
            </button>
            <button
              className="icon-button quiet-icon-button"
              onClick={() => open(setShowRules)}
              aria-label="How to play"
            >
              <CircleHelp size={19} />
            </button>
          </div>
        </header>
        <div className="meta-row">
          <div className="cat-progress-group">
            {game.levelIndex === 0 && coachStep !== 'done' && (
              <span className="cat-progress-label">
                Cats {game.catCount}/{game.level.size}
              </span>
            )}
            <CatProgress board={game.board} level={game.level} />
          </div>
          <MistakeIndicator count={game.mistakes} />
        </div>
        <div className="board-stage">
          <GameBoard
            board={game.board}
            level={game.level}
            levelIndex={game.levelIndex}
            mistakeCell={game.mistakeCell}
            correctCell={game.correctCell}
            hintCells={hintCells}
            hintExcluded={
              game.hintRevealed ? game.hintInfo?.eliminate : undefined
            }
            hintTarget={
              game.hintInfo && game.hintRevealed
                ? game.hintInfo.cell
                : undefined
            }
            cellFeedback={game.cellFeedback}
            coachCell={coachCell === -1 ? undefined : coachCell}
            coachLabel={coachLabel}
            celebrateCats={game.won && !game.winDialogReady}
            onToggleCat={game.gestures.toggleCat}
            onKeyboardMark={game.gestures.keyboardMark}
            onPointerDown={game.gestures.pointerDown}
            onPointerMove={game.gestures.pointerMove}
            onPointerEnd={game.gestures.pointerEnd}
            onPointerCancel={game.gestures.pointerCancel}
            onMouseLeave={game.gestures.finishMouseDragOnLeave}
          />
        </div>
        <div className="context-slot">
          {game.mistakeNotice ? (
            <ContextPanel
              tone="error"
              icon={<X size={18} />}
              title={game.restartingFromMistakes ? 'Restarting' : 'Wrong cat'}
              text={game.mistakeNotice}
            />
          ) : game.hintInfo ? (
            <ContextPanel
              tone="hint"
              icon={<Lightbulb size={18} />}
              title={hintTitle}
              text={hintText}
              caption={
                game.hintRevealed && game.hintInfo.kind === 'eliminate'
                  ? 'Solid outline: the clue. Dashed outline: cells to mark X.'
                  : game.hintRevealed && game.hintInfo.kind === 'place'
                    ? 'Solid outline: the clue. Double outline: place a cat.'
                    : game.hintInfo.focus?.length
                      ? 'Follow the outlined row, column or territory.'
                      : undefined
              }
            >
              {hintCanReveal && (
                <button className="hint-reveal-button" onClick={game.hint}>
                  Show move
                </button>
              )}
              <button
                className="hint-close-button"
                aria-label="Close hint"
                onClick={() => {
                  playSound('uiClose');
                  game.dismissHint();
                }}
              >
                <X size={17} />
              </button>
            </ContextPanel>
          ) : game.levelIndex === 0 && coachStep !== 'done' ? (
            <ContextPanel
              tone="info"
              icon={<CircleHelp size={18} />}
              title={
                coachStep === 'tap'
                  ? '1 of 2 · Mark a tile'
                  : '2 of 2 · Find a cat'
              }
              text={coachText}
            >
              <button
                className="hint-close-button"
                aria-label="Skip introduction"
                onClick={() => setCoach('done')}
              >
                <X size={17} />
              </button>
            </ContextPanel>
          ) : (
            <div className="action-row">
              <button
                className="undo-action"
                onClick={game.undo}
                disabled={
                  !game.history.length ||
                  game.won ||
                  game.restartingFromMistakes ||
                  game.mistakeCell !== null
                }
              >
                <Undo2 size={20} />
                <span>Undo</span>
              </button>
              <button
                className={`hint-action ${game.idleHelpVisible && !game.won ? 'hint-attention' : ''}`}
                onClick={game.hint}
                disabled={
                  game.won ||
                  game.restartingFromMistakes ||
                  game.mistakeCell !== null
                }
              >
                <Lightbulb size={20} />
                <span>Hint</span>
              </button>
              <button
                type="button"
                className={`auto-x-action ${autoMarksEnabled ? 'auto-x-on' : 'auto-x-off'}`}
                onClick={toggleAutoMarks}
                aria-pressed={autoMarksEnabled}
                aria-label={`Automatic X marks ${autoMarksEnabled ? 'on' : 'off'}`}
                disabled={
                  game.won ||
                  game.restartingFromMistakes ||
                  game.mistakeCell !== null
                }
              >
                <Sparkles size={20} />
                <span>Auto X</span>
              </button>
              <button
                onClick={game.restart}
                className={`restart-action ${game.restartArmed ? 'restart-armed' : ''}`}
                disabled={
                  game.won ||
                  game.restartingFromMistakes ||
                  game.mistakeCell !== null
                }
              >
                <RotateCcw size={20} />
                <span>{game.restartArmed ? 'Restart?' : 'Restart'}</span>
              </button>
            </div>
          )}
        </div>
      </section>
      <Suspense
        fallback={
          <LoadingTerritory
            onCancel={
              showRules || showAchievements
                ? () => {
                    setShowRules(false);
                    setShowAchievements(false);
                  }
                : undefined
            }
          />
        }
      >
        {showRules && <RulesDialog onClose={() => close(setShowRules)} />}{' '}
        {showAchievements && (
          <AchievementsDialog onClose={() => close(setShowAchievements)} />
        )}{' '}
        {game.won && game.winDialogReady && game.completionSummary && (
          <WinDialog summary={game.completionSummary} onNext={game.nextLevel} />
        )}
      </Suspense>
      {game.achievementToast && (
        <div
          className={`achievement-toast ${game.achievementToast.secret ? 'secret-toast' : ''}`}
          role="status"
        >
          <span>
            <AchievementIcon id={game.achievementToast.id} />
          </span>
          <div>
            <strong>Achievement unlocked</strong>
            <span>{game.achievementToast.title}</span>
          </div>
        </div>
      )}
    </main>
  );
}
export default App;
