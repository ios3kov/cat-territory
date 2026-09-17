import { AchievementIcon } from './AchievementIcon';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Check, ChevronLeft, ChevronRight, Lock, X } from 'lucide-react';
import {
  getAchievementSnapshot,
  getPlayerRank,
  getPlayerStats,
  getTerritoryJournal,
} from './achievements';
import { CatMark } from './CatMark';
import { formatTime } from './game';
type RulesProps = { onClose: () => void };
type AchievementsProps = { onClose: () => void };
export function trapTabKey(
  event: KeyboardEvent<HTMLElement>,
  root: HTMLElement | null,
) {
  if (event.key !== 'Tab' || !root) return;
  const focusable = Array.from(
    root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  );
  if (focusable.length === 0) {
    event.preventDefault();
    root.focus();
    return;
  }
  const first = focusable[0],
    last = focusable[focusable.length - 1];
  if (!root.contains(document.activeElement)) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  } else if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
function useDialogFocus(onClose: () => void, fallbackSelector: string) {
  const dialogRef = useRef<HTMLElement>(null),
    closeRef = useRef<HTMLButtonElement>(null),
    previousFocusRef = useRef<HTMLElement | null>(
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null,
    );
  useEffect(() => {
    closeRef.current?.focus();
    const previous = previousFocusRef.current;
    return () => {
      const target =
        previous && previous !== document.body && document.contains(previous)
          ? previous
          : document.querySelector<HTMLElement>(fallbackSelector);
      target?.focus();
    };
  }, [fallbackSelector]);
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    trapTabKey(event, dialogRef.current);
  };
  return { dialogRef, closeRef, onKeyDown };
}
export function RulesDialog({ onClose }: RulesProps) {
  const dialog = useDialogFocus(onClose, 'button[aria-label="How to play"]');
  const [showMore, setShowMore] = useState(false);
  return (
    <div className="overlay" role="presentation" onClick={onClose}>
      <section
        ref={dialog.dialogRef}
        className="modal rules-modal system-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rules-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={dialog.onKeyDown}
      >
        <button
          ref={dialog.closeRef}
          className="close-button"
          type="button"
          onClick={onClose}
          aria-label="Close rules"
        >
          <X size={21} />
        </button>
        <div className="modal-heading">
          <span className="modal-cat compact-modal-cat" aria-hidden="true">
            <CatMark />
          </span>
          <div>
            <p className="eyebrow">HOW TO PLAY</p>
            <h2 id="rules-title">Give every cat its own territory.</h2>
          </div>
        </div>
        <div className="rules-core">
          <div>
            <strong>Tap</strong>
            <span>Mark or erase an X.</span>
          </div>
          <div>
            <strong>Double tap</strong>
            <span>Place or remove a cat.</span>
          </div>
          <div>
            <strong>One each</strong>
            <span>One cat per row, column and colored territory.</span>
          </div>
          <div>
            <strong>Keep apart</strong>
            <span>Cats cannot touch, even diagonally.</span>
          </div>
        </div>
        <button
          className="disclosure-button"
          type="button"
          aria-expanded={showMore}
          onClick={() => setShowMore((v) => !v)}
        >
          {showMore ? 'Hide details' : 'More rules'}{' '}
          <ChevronRight
            className={showMore ? 'disclosure-open' : ''}
            size={17}
          />
        </button>
        {showMore && (
          <div className="rules-more">
            <p>
              <strong>Keyboard:</strong> use arrow keys to move, Space or Enter
              to mark X, and C to place or remove a cat.
            </p>
            <p>
              <strong>Swipe:</strong> start on an empty tile to paint Xs, or on
              an X to erase them.
            </p>
            <p>
              <strong>Smart marks:</strong> a correct cat automatically marks
              cells it rules out.
            </p>
            <p>
              <strong>Three mistakes:</strong> only a wrong cat counts; the
              third restarts the level.
            </p>
            <p>
              <strong>Score:</strong> Bigger boards and faster solves earn more.
              Mistakes reduce the clean-play bonus. Hint reduces a flawless
              bonus and removes the no-hint bonus. Your result shows every part.
            </p>
            <p>
              <strong>Perfect:</strong> finish with no mistakes and no Hint.
            </p>

            <p>
              The endless journey grows up to 10×10 and is paced in ten-level
              Territory Runs.
            </p>
          </div>
        )}
        <button
          className="primary-button modal-primary"
          type="button"
          onClick={onClose}
        >
          Got it
        </button>
      </section>
    </div>
  );
}
export function AchievementsDialog({ onClose }: AchievementsProps) {
  const dialog = useDialogFocus(
    onClose,
    'button[aria-label^="Progress and achievements"]',
  );
  const [view, setView] = useState<'overview' | 'all'>('overview');
  const previousViewRef = useRef(view),
    backRef = useRef<HTMLButtonElement>(null),
    allRef = useRef<HTMLButtonElement>(null);
  const achievements = getAchievementSnapshot(),
    stats = getPlayerStats(),
    rank = getPlayerRank(stats.completed),
    journal = getTerritoryJournal(),
    unlockedCount = achievements.filter((i) => i.unlocked).length,
    locked = achievements.filter((i) => !i.unlocked),
    preview = locked.length ? locked.slice(0, 3) : achievements.slice(-3);
  useEffect(() => {
    const previous = previousViewRef.current;
    if (previous === view) return;
    if (view === 'all') backRef.current?.focus();
    else allRef.current?.focus();
    previousViewRef.current = view;
  }, [view]);
  return (
    <div className="overlay" role="presentation" onClick={onClose}>
      <section
        ref={dialog.dialogRef}
        className={`modal achievements-modal system-modal ${view === 'all' ? 'achievements-all-view' : 'achievements-overview-view'}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="achievements-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={dialog.onKeyDown}
      >
        {view === 'all' && (
          <button
            ref={backRef}
            className="modal-back-button"
            type="button"
            onClick={() => setView('overview')}
            aria-label="Back to progress overview"
          >
            <ChevronLeft size={20} />
            <span>Back</span>
          </button>
        )}
        <button
          ref={dialog.closeRef}
          className="close-button"
          type="button"
          onClick={onClose}
          aria-label="Close progress"
        >
          <X size={21} />
        </button>
        {view === 'overview' ? (
          <>
            <div className="progress-heading">
              <p className="eyebrow">PROGRESS</p>
              <h2 id="achievements-title">Your territory</h2>
              <p className="achievement-summary">
                {rank.title} · {unlockedCount}/{achievements.length}{' '}
                achievements
              </p>
            </div>
            <div className="rank-track">
              <span
                style={{
                  width: `${Math.max(4, Math.min(100, rank.progress * 100))}%`,
                }}
              />
            </div>
            <div className="stats-grid compact-stats-grid">
              <div>
                <strong>{stats.completed}</strong>
                <span>levels</span>
              </div>
              <div>
                <strong>{stats.flawless}</strong>
                <span>flawless</span>
              </div>
              <div>
                <strong>{stats.bestFlawlessStreak}</strong>
                <span>best run</span>
              </div>
            </div>
            <p className="stats-detail">
              Best 8×8{' '}
              {stats.fastest8 === null ? '—' : formatTime(stats.fastest8)} ·
              Best 10×10{' '}
              {stats.fastest10 === null ? '—' : formatTime(stats.fastest10)}
            </p>
            <div className="section-heading-row">
              <span>Territory Journal</span>
              <small>your play style</small>
            </div>
            <div className="territory-journal" aria-label="Territory Journal">
              {journal.map((i) => (
                <div
                  className={
                    i.value > 0 ? 'journal-mark earned' : 'journal-mark'
                  }
                  key={i.id}
                >
                  <span>
                    <AchievementIcon id={i.id} />
                  </span>
                  <strong>{i.value}</strong>
                  <small>{i.label}</small>
                </div>
              ))}
            </div>
            <div className="section-heading-row">
              <span>Up next</span>
              <small>{locked.length} locked</small>
            </div>
            <div className="achievement-list achievement-list-preview">
              {preview.map((i) => (
                <article
                  className={`achievement-card ${i.unlocked ? 'unlocked' : 'locked'}`}
                  key={i.id}
                >
                  <span className="achievement-icon">
                    <AchievementIcon
                      id={i.id}
                      secret={'secret' in i && i.secret && !i.unlocked}
                    />
                  </span>
                  <div>
                    <strong>{i.title}</strong>
                    <p>{i.description}</p>
                    {i.progress && !i.unlocked && <small>{i.progress}</small>}
                  </div>
                  <span className="achievement-state">
                    {i.unlocked ? <Check size={18} /> : <Lock size={16} />}
                  </span>
                </article>
              ))}
            </div>
            <button
              ref={allRef}
              className="achievements-toggle"
              type="button"
              onClick={() => setView('all')}
            >
              All achievements <ChevronRight size={17} />
            </button>
          </>
        ) : (
          <>
            <div className="progress-heading nested-heading">
              <p className="eyebrow">PROGRESS</p>
              <h2 id="achievements-title">All achievements</h2>
              <p className="achievement-summary">
                {unlockedCount} unlocked · {achievements.length - unlockedCount}{' '}
                remaining
              </p>
            </div>
            <div
              className="achievement-list achievement-list-all"
              tabIndex={0}
              role="region"
              aria-label="Achievement list"
            >
              {achievements.map((i) => (
                <article
                  className={`achievement-row ${i.unlocked ? 'unlocked' : 'locked'}`}
                  key={i.id}
                >
                  <span className="achievement-row-icon">
                    <AchievementIcon
                      id={i.id}
                      secret={'secret' in i && i.secret && !i.unlocked}
                    />
                  </span>
                  <div>
                    <strong>{i.title}</strong>
                    <small>
                      {i.unlocked ? 'Unlocked' : (i.progress ?? i.description)}
                    </small>
                  </div>
                  <span className="achievement-state">
                    {i.unlocked ? <Check size={17} /> : <Lock size={15} />}
                  </span>
                </article>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
