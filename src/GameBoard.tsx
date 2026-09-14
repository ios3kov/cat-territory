import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { CatMark } from './CatMark';
import { getRegionColorMap, indexOf, type CellState, type Level } from './game';
import type { CellFeedbackMap } from './useCellFeedback';
type Props = {
  board: CellState[];
  level: Level;
  levelIndex: number;
  mistakeCell?: number | null;
  correctCell?: number | null;
  hintCells?: number[];
  hintTarget?: number;
  cellFeedback?: CellFeedbackMap;
  coachCell?: number;
  coachLabel?: string;
  celebrateCats?: boolean;
  onToggleCat: (idx: number) => void;
  onKeyboardMark: (idx: number) => void;
  onPointerDown: (
    idx: number,
    x: number,
    y: number,
    pointerType?: string,
  ) => void;
  onPointerMove: (x: number, y: number) => void;
  onPointerEnd: () => void;
  onPointerCancel: () => void;
  onMouseLeave: () => void;
};
type CellStyle = CSSProperties & {
  '--cat-delay'?: string;
  '--cat-idle-delay'?: string;
  '--cat-blink-delay'?: string;
  '--assemble-delay'?: string;
};
function MarkX({
  drawn = false,
  swipe = false,
  erase = false,
}: {
  drawn?: boolean;
  swipe?: boolean;
  erase?: boolean;
}) {
  return (
    <svg
      className={`mark-x ${drawn ? 'mark-x-drawn' : ''} ${swipe ? 'mark-x-swipe' : ''} ${erase ? 'erase-ghost' : ''}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <line
        className="mark-x-stroke mark-x-stroke-one"
        x1="5"
        y1="5"
        x2="19"
        y2="19"
      />
      <line
        className="mark-x-stroke mark-x-stroke-two"
        x1="19"
        y1="5"
        x2="5"
        y2="19"
      />
    </svg>
  );
}
function GameBoardView({
  board,
  level,
  levelIndex,
  mistakeCell,
  correctCell,
  hintCells = [],
  hintTarget,
  cellFeedback = {},
  coachCell,
  coachLabel,
  celebrateCats = false,
  onToggleCat,
  onKeyboardMark,
  onPointerDown,
  onPointerMove,
  onPointerEnd,
  onPointerCancel,
  onMouseLeave,
}: Props) {
  const starterCats = useMemo(
    () => new Set(level.starterCats),
    [level.starterCats],
  );
  const hintCellSet = useMemo(() => new Set(hintCells), [hintCells]);
  const regionColors = useMemo(
    () => getRegionColorMap(level.regions),
    [level.regions],
  );
  const size = level.size;
  const [focusIndex, setFocusIndex] = useState(
    () =>
      Array.from({ length: size * size }, (_, i) => i).find(
        (i) => !starterCats.has(i),
      ) ?? 0,
  );
  const catOrder = useMemo(() => {
    if (!celebrateCats) return new Map<number, number>();
    const order = new Map<number, number>();
    let ordinal = 0;
    board.forEach((value, idx) => {
      if (value === 2) order.set(idx, ordinal++);
    });
    return order;
  }, [board, celebrateCats]);
  const [assembling, setAssembling] = useState(true);
  useEffect(() => {
    setFocusIndex(
      Array.from({ length: size * size }, (_, i) => i).find(
        (i) => !starterCats.has(i),
      ) ?? 0,
    );
    setAssembling(true);
    const timer = window.setTimeout(() => setAssembling(false), 800);
    return () => clearTimeout(timer);
  }, [level.id]);
  const moveFocus = (start: number, step: number) => {
    let target = start + step;
    while (target >= 0 && target < size * size && starterCats.has(target))
      target += step;
    return target >= 0 &&
      target < size * size &&
      (Math.abs(step) !== 1 ||
        Math.floor(target / size) === Math.floor(start / size))
      ? target
      : start;
  };
  return (
    <div className="board-wrap">
      <div
        className={`board board-size-${size} ${assembling ? 'board-assembling' : ''}`}
        key={level.id}
        role="grid"
        aria-rowcount={size}
        aria-colcount={size}
        aria-label={`Puzzle level ${levelIndex + 1}, ${size} by ${size}. Tap marks X. Double tap places a cat. Swipe marks several X tiles.`}
        style={{
          gridTemplateColumns: `repeat(${size}, 1fr)`,
          gridTemplateRows: `repeat(${size}, 1fr)`,
        }}
        onPointerDownCapture={() => setAssembling(false)}
        onKeyDownCapture={() => setAssembling(false)}
        onPointerMove={(e) => onPointerMove(e.clientX, e.clientY)}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerCancel}
        onPointerLeave={(e) => {
          if (e.pointerType === 'mouse') onMouseLeave();
        }}
      >
        {level.regions.map((row, rowIndex) => (
          <div role="row" key={rowIndex} style={{ display: 'contents' }}>
            {row.map((region, colIndex) => {
              const idx = indexOf(rowIndex, colIndex, size),
                value = board[idx],
                starter = starterCats.has(idx),
                feedback = cellFeedback[idx],
                celebrating = celebrateCats && value === 2;
              const style: CellStyle = {
                backgroundColor: regionColors[region],
                '--assemble-delay': `${Math.min(360, (rowIndex + colIndex) * 22 + ((rowIndex * 7 + colIndex * 11) % 3) * 8)}ms`,
              };
              if (celebrating)
                style['--cat-delay'] = `${(catOrder.get(idx) ?? 0) * 34}ms`;
              if (value === 2) {
                style['--cat-idle-delay'] = `${-((idx * 0.71) % 8)}s`;
                style['--cat-blink-delay'] = `${-((idx * 0.43) % 6)}s`;
              }
              return (
                <button
                  className={`cell ${starter ? 'starter' : ''} ${mistakeCell === idx ? 'mistake-cell' : ''} ${correctCell === idx ? 'correct-cell' : ''} ${hintCellSet.has(idx) ? 'hint-cell' : ''} ${hintTarget === idx ? 'hint-target' : ''} ${coachCell === idx ? 'gesture-coach-cell' : ''} ${feedback ? `feedback-${feedback.kind} feedback-phase-${feedback.token % 2}` : ''} ${celebrating ? 'win-sequence' : ''}`}
                  key={`${rowIndex}-${colIndex}`}
                  type="button"
                  role="gridcell"
                  aria-rowindex={rowIndex + 1}
                  aria-colindex={colIndex + 1}
                  tabIndex={!starter && idx === focusIndex ? 0 : -1}
                  disabled={starter}
                  aria-label={`Row ${rowIndex + 1}, column ${colIndex + 1}, territory ${region + 1}${value === 2 ? ', cat' : value === 1 ? ', marked X' : ', empty'}${starter ? ', starter cat' : ''}`}
                  data-cell-index={idx}
                  data-region={region}
                  onFocus={() => setFocusIndex(idx)}
                  onPointerDown={(e) => {
                    if (e.pointerType === 'mouse' && e.button !== 0) return;
                    if (starter) return;
                    onPointerDown(idx, e.clientX, e.clientY, e.pointerType);
                    try {
                      e.currentTarget.setPointerCapture(e.pointerId);
                    } catch {
                      /* Pointer capture may be unavailable after a cancelled pointer event. */
                    }
                  }}
                  onPointerUp={onPointerEnd}
                  onPointerCancel={onPointerCancel}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    if (!starter) onToggleCat(idx);
                  }}
                  onKeyDown={(e) => {
                    let target = idx;
                    if (e.key.startsWith('Arrow')) e.preventDefault();
                    if (e.key === 'ArrowLeft' && colIndex > 0)
                      target = moveFocus(idx, -1);
                    else if (e.key === 'ArrowRight' && colIndex < size - 1)
                      target = moveFocus(idx, 1);
                    else if (e.key === 'ArrowUp' && rowIndex > 0)
                      target = moveFocus(idx, -size);
                    else if (e.key === 'ArrowDown' && rowIndex < size - 1)
                      target = moveFocus(idx, size);
                    if (target !== idx) {
                      e.preventDefault();
                      setFocusIndex(target);
                      e.currentTarget
                        .closest('[role="grid"]')
                        ?.querySelector<HTMLButtonElement>(
                          `[data-cell-index="${target}"]`,
                        )
                        ?.focus();
                      return;
                    }
                    if ((e.key === 'Enter' || e.key === ' ') && !starter) {
                      e.preventDefault();
                      onKeyboardMark(idx);
                    } else if (e.key.toLowerCase() === 'c' && !starter) {
                      e.preventDefault();
                      onToggleCat(idx);
                    }
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    if (e.detail === 0 && !starter) onKeyboardMark(idx);
                  }}
                  style={style}
                >
                  {value === 1 && (
                    <MarkX
                      key={`x-${feedback?.token ?? 'steady'}`}
                      drawn={
                        feedback?.kind === 'paint' ||
                        feedback?.kind === 'swipe-paint'
                      }
                      swipe={feedback?.kind === 'swipe-paint'}
                    />
                  )}{' '}
                  {value === 0 &&
                    (feedback?.kind === 'erase' ||
                      feedback?.kind === 'swipe-erase') && (
                      <MarkX
                        key={`erase-${feedback.token}`}
                        erase
                        swipe={feedback.kind === 'swipe-erase'}
                      />
                    )}{' '}
                  {value === 2 && (
                    <CatMark
                      className={`cat-face live-cat cat-personality-${idx % 4}`}
                    />
                  )}{' '}
                  {coachCell === idx && value !== 2 && coachLabel && (
                    <span className="gesture-coach" aria-hidden="true">
                      {coachLabel}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
const MemoBoard = memo(GameBoardView);
export function GameBoard(props: Props) {
  const latest = useRef(props);
  latest.current = props;
  const handlers = useMemo(
    () => ({
      onToggleCat: (i: number) => latest.current.onToggleCat(i),
      onKeyboardMark: (i: number) => latest.current.onKeyboardMark(i),
      onPointerDown: (i: number, x: number, y: number, t?: string) =>
        latest.current.onPointerDown(i, x, y, t),
      onPointerMove: (x: number, y: number) =>
        latest.current.onPointerMove(x, y),
      onPointerEnd: () => latest.current.onPointerEnd(),
      onPointerCancel: () => latest.current.onPointerCancel(),
      onMouseLeave: () => latest.current.onMouseLeave(),
    }),
    [],
  );
  return <MemoBoard {...props} {...handlers} />;
}
