import { AchievementIcon } from './AchievementIcon';
import { LoadingTerritory } from './LoadingTerritory';
import {
  CalendarDays,
  CircleHelp,
  Lightbulb,
  RotateCcw,
  Trophy,
  Undo2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { playSound, readSoundEnabled, setSoundEnabled } from './audio';
import { CatProgress } from './CatProgress';
import { ContextPanel } from './ContextPanel';
import { GameBoard } from './GameBoard';
import { haptic } from './haptics';
import { MistakeIndicator } from './MistakeIndicator';
import { getProgressionMeta } from './progression';
import { storageGet, storageSet } from './storage';
import { useGameController } from './useGameController';
const DailyTerritory = lazy(() =>
  import('./DailyTerritory').then((m) => ({ default: m.DailyTerritory })),
);
const RulesDialog = lazy(() =>
  import('./GameDialogs').then((m) => ({ default: m.RulesDialog })),
);
const AchievementsDialog = lazy(() =>
  import('./GameDialogs').then((m) => ({ default: m.AchievementsDialog })),
);
const WinDialog = lazy(() =>
  import('./GameDialogs').then((m) => ({ default: m.WinDialog })),
);
type CoachStep = 'tap' | 'cat' | 'swipe' | 'rules' | 'deduction' | 'done';
const COACH_KEY = 'cat-territory-gesture-coach-v3';
function readCoachStep(): CoachStep {
  const v = storageGet(COACH_KEY);
  return v === 'tap' ||
    v === 'cat' ||
    v === 'swipe' ||
    v === 'rules' ||
    v === 'deduction' ||
    v === 'done'
    ? v
    : 'tap';
}
function App() {
  const game = useGameController();
  const [showRules, setShowRules] = useState(false),
    [showAchievements, setShowAchievements] = useState(false),
    [showDaily, setShowDaily] = useState(false),
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
    else if (coachStep === 'cat' && game.correctCell !== null)
      setCoach('swipe');
    else if (
      coachStep === 'swipe' &&
      feedback.some((e) => e.kind === 'swipe-paint' || e.kind === 'swipe-erase')
    )
      setCoach('rules');
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
      ? 'Tap a tile to mark an X.'
      : coachStep === 'cat'
        ? 'Double tap the highlighted tile to place a cat.'
        : coachStep === 'swipe'
          ? 'Swipe across tiles to mark several Xs.'
          : coachStep === 'rules'
            ? 'One cat in every row, column and color. Cats cannot touch, even diagonally.'
            : coachStep === 'deduction'
              ? 'Use each cat to rule out its row, column, color and neighboring tiles. What remains is where the next cat can live.'
              : '';
  const coachTitle =
    coachStep === 'rules'
      ? 'Core rule'
      : coachStep === 'deduction'
        ? 'Think like a cat'
        : 'Quick tip';
  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    setSoundEnabledState(next);
    if (next) playSound('ui');
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
    showDaily ||
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
              <button
                className="daily-shortcut"
                type="button"
                onClick={() => open(setShowDaily)}
                aria-label="Open Daily Territory"
              >
                <CalendarDays size={13} /> Daily
              </button>
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
            hintCells={
              game.hintInfo
                ? game.hintRevealed
                  ? game.hintInfo.highlight
                  : (game.hintInfo.focus ?? [])
                : undefined
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
            >
              {hintCanReveal && (
                <button className="hint-reveal-button" onClick={game.hint}>
                  Reveal
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
              title={coachTitle}
              text={coachText}
            >
              {coachStep === 'rules' && (
                <button
                  className="hint-reveal-button"
                  onClick={() => setCoach('deduction')}
                >
                  Got it
                </button>
              )}
              {coachStep === 'deduction' && (
                <button
                  className="hint-reveal-button"
                  onClick={() => setCoach('done')}
                >
                  Play
                </button>
              )}
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
              showDaily || showRules || showAchievements
                ? () => {
                    setShowDaily(false);
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
        {showDaily && (
          <DailyTerritory
            onClose={() => close(setShowDaily)}
            onAchievements={game.receiveAchievements}
          />
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
