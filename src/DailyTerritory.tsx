import { ChevronLeft, Lightbulb, RotateCcw, Undo2, X } from 'lucide-react';
import { playSound } from './audio';
import { CatMark } from './CatMark';
import { CatProgress } from './CatProgress';
import { ContextPanel } from './ContextPanel';
import { formatTime } from './game';
import { GameBoard } from './GameBoard';
import { MistakeIndicator } from './MistakeIndicator';
import { ScoreResult } from './ScoreResult';
import { useDailyController, type DailyProps } from './useDailyController';
export function DailyTerritory(props: DailyProps) {
  const { onClose } = props;
  const {
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
  } = useDailyController(props);
  return (
    <div
      className="secondary-screen daily-screen"
      role="dialog"
      aria-modal="true"
      aria-labelledby="daily-title"
    >
      <section
        ref={dialogRef}
        className={`secondary-shell daily-shell ${won ? 'daily-won' : 'daily-playing'}`}
        onKeyDown={keyDown}
      >
        <header className="secondary-header daily-header">
          <button
            ref={backRef}
            className="screen-back-button"
            type="button"
            onClick={onClose}
            aria-label="Back to endless"
          >
            <ChevronLeft size={20} />
            <span>Back</span>
          </button>
          <div className="secondary-title-block">
            <p className="eyebrow">DAILY TERRITORY</p>
            <h2 id="daily-title">Today's territory</h2>
            <p className="daily-subtitle">
              {key} · {level.size}×{level.size} · streak{' '}
              <span className={streakAnimating ? 'daily-streak-pop' : ''}>
                {displayedStreak}
              </span>
            </p>
          </div>
        </header>
        {won ? (
          <div className="daily-result">
            <span className="daily-result-cat" aria-hidden="true">
              <CatMark happy className="celebrating-cat" />
            </span>
            <h3>{summary?.label ?? 'Territory Secured'}</h3>
            <p className="win-result-summary subdued-result">
              {summary
                ? `${formatTime(summary.seconds)} · ${summary.score.toLocaleString()} pts · ${summary.mistakes} ${summary.mistakes === 1 ? 'mistake' : 'mistakes'} · ${summary.usedHint ? 'hint used' : 'no hint'}`
                : 'Come back tomorrow for a new territory.'}
            </p>
            {summary && <ScoreResult breakdown={summary.breakdown} />}
            <span className="daily-streak-badge">
              Daily streak {displayedStreak}
            </span>
            {milestone && (
              <p className="win-result-summary subdued-result">
                Next streak milestone · {displayedStreak}/{milestone}
              </p>
            )}
            <button className="primary-button" type="button" onClick={onClose}>
              Back to endless
            </button>
          </div>
        ) : (
          <>
            <div className="daily-meta">
              <CatProgress board={board} level={level} />
              <MistakeIndicator count={mistakes} />
            </div>
            <div className="board-stage">
              <GameBoard
                board={board}
                level={level}
                levelIndex={0}
                mistakeCell={mistakeCell}
                correctCell={correctCell}
                hintCells={
                  hintInfo
                    ? hintRevealed
                      ? hintInfo.highlight
                      : (hintInfo.focus ?? [])
                    : undefined
                }
                hintTarget={
                  hintInfo && hintRevealed ? hintInfo.cell : undefined
                }
                cellFeedback={cellFeedback.effects}
                celebrateCats={celebrating}
                onToggleCat={gestures.toggleCat}
                onKeyboardMark={gestures.keyboardMark}
                onPointerDown={gestures.pointerDown}
                onPointerMove={gestures.pointerMove}
                onPointerEnd={gestures.pointerEnd}
                onPointerCancel={gestures.pointerCancel}
                onMouseLeave={gestures.finishMouseDragOnLeave}
              />
            </div>
            <div className="daily-spacer" />
            <div className="context-slot">
              {mistakeNotice ? (
                <ContextPanel
                  tone="error"
                  icon={<X size={18} />}
                  title={
                    mistakeNotice.startsWith('3 mistakes')
                      ? 'Restarting'
                      : 'Wrong cat'
                  }
                  text={mistakeNotice}
                />
              ) : hintInfo ? (
                <ContextPanel
                  tone="hint"
                  icon={<Lightbulb size={18} />}
                  title={hintTitle}
                  text={hintText}
                >
                  {hintCanReveal && (
                    <button className="hint-reveal-button" onClick={hint}>
                      Reveal
                    </button>
                  )}
                  <button
                    className="hint-close-button"
                    aria-label="Close hint"
                    onClick={() => {
                      playSound('uiClose');
                      dismissHint();
                    }}
                  >
                    <X size={17} />
                  </button>
                </ContextPanel>
              ) : (
                <div className="action-row">
                  <button
                    className="undo-action"
                    onClick={undo}
                    disabled={
                      !history.length || celebrating || mistakeCell !== null
                    }
                  >
                    <Undo2 size={20} />
                    <span>Undo</span>
                  </button>
                  <button
                    className="hint-action"
                    onClick={hint}
                    disabled={celebrating || mistakeCell !== null}
                  >
                    <Lightbulb size={20} />
                    <span>Hint</span>
                  </button>
                  <button
                    onClick={requestRestart}
                    className={`restart-action ${restartArmed ? 'restart-armed' : ''}`}
                    disabled={celebrating || mistakeCell !== null}
                  >
                    <RotateCcw size={20} />
                    <span>{restartArmed ? 'Restart?' : 'Restart'}</span>
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
