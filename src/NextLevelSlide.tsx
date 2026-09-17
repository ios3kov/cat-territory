import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from 'react';
import { ChevronRight, LoaderCircle, PawPrint } from 'lucide-react';
import { haptic } from './haptics';

type Props = { ready: boolean; onNext: () => Promise<void> };
type Phase = 'idle' | 'dragging' | 'loading' | 'error';
type Drag = {
  id: number;
  x: number;
  y: number;
  travel: number;
  target: HTMLDivElement;
};
const THRESHOLD = 0.8;
const clamp = (value: number) => Math.max(0, Math.min(1, value));

export function NextLevelSlide({ ready, onNext }: Props) {
  const track = useRef<HTMLDivElement>(null),
    handle = useRef<HTMLDivElement>(null),
    drag = useRef<Drag | null>(null),
    submitting = useRef(false),
    mounted = useRef(false),
    restingPhase = useRef<'idle' | 'error'>('idle');
  const [armed, setArmed] = useState(false),
    [phase, setPhase] = useState<Phase>('idle'),
    [progress, setProgress] = useState(0),
    [travel, setTravel] = useState(0);

  const cancelDrag = useCallback(() => {
    const current = drag.current;
    if (!current) return;
    drag.current = null;
    if (current.target.hasPointerCapture(current.id))
      current.target.releasePointerCapture(current.id);
    setProgress(0);
    setPhase(restingPhase.current);
  }, []);

  useEffect(() => {
    mounted.current = true;
    const measure = () => {
      cancelDrag();
      setTravel(
        Math.max(
          0,
          (track.current?.clientWidth ?? 0) -
            (handle.current?.offsetWidth ?? 0),
        ),
      );
    };
    const hide = () => {
      if (document.visibilityState === 'hidden') cancelDrag();
    };
    const observer = new ResizeObserver(measure);
    if (track.current) observer.observe(track.current);
    measure();
    window.addEventListener('blur', cancelDrag);
    window.addEventListener('resize', cancelDrag);
    document.addEventListener('visibilitychange', hide);
    return () => {
      mounted.current = false;
      drag.current = null;
      observer.disconnect();
      window.removeEventListener('blur', cancelDrag);
      window.removeEventListener('resize', cancelDrag);
      document.removeEventListener('visibilitychange', hide);
    };
  }, [cancelDrag]);

  useEffect(() => {
    setArmed(false);
    if (!ready) return;
    // Arm on the next frame: the winning pointer sequence has ended, while the
    // newly visible track responds immediately to the player's next gesture.
    const frame = requestAnimationFrame(() => setArmed(true));
    return () => cancelAnimationFrame(frame);
  }, [ready]);

  const advance = async () => {
    if (submitting.current) return;
    submitting.current = true;
    setProgress(1);
    setPhase('loading');
    haptic('next');
    try {
      await onNext();
      if (mounted.current) {
        restingPhase.current = 'idle';
        setProgress(0);
        setPhase('idle');
      }
    } catch {
      if (mounted.current) {
        restingPhase.current = 'error';
        setProgress(0);
        setPhase('error');
      }
    } finally {
      submitting.current = false;
    }
  };
  const pointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (
      !armed ||
      !ready ||
      submitting.current ||
      drag.current ||
      !event.isPrimary ||
      event.button !== 0 ||
      travel <= 0
    )
      return;
    event.preventDefault();
    event.stopPropagation();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      return;
    }
    drag.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      travel,
      target: event.currentTarget,
    };
    event.currentTarget.focus({ preventScroll: true });
    setProgress(0);
    setPhase('dragging');
  };
  const pointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    if (
      Math.abs(event.clientY - current.y) > 80 ||
      (event.pointerType === 'mouse' && !(event.buttons & 1))
    ) {
      cancelDrag();
      return;
    }
    setProgress(clamp((event.clientX - current.x) / current.travel));
  };
  const pointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    const completed =
      (event.clientX - current.x) / current.travel >= THRESHOLD &&
      Math.abs(event.clientY - current.y) <= 80;
    cancelDrag();
    if (completed) void advance();
  };
  const label =
    phase === 'loading'
      ? 'Preparing…'
      : phase === 'error'
        ? 'Could not load level'
        : 'Next level';
  const caption =
    phase === 'loading'
      ? 'Your next territory'
      : phase === 'error'
        ? 'Slide to retry'
        : progress >= THRESHOLD
          ? 'Release to continue'
          : 'Slide to continue';
  return (
    <div
      ref={track}
      data-testid="next-level-slide"
      data-state={phase}
      className={`next-level-slide ${ready ? 'is-ready' : ''}`}
      role="group"
      aria-label="Next level"
      aria-busy={phase === 'loading'}
      style={
        {
          '--slide-offset': `${progress * travel}px`,
          '--slide-progress': progress,
        } as CSSProperties
      }
    >
      <div className="slide-track-fill" aria-hidden="true" />
      <div className="slide-copy" aria-hidden="true">
        <strong>{label}</strong>
        <span>{caption}</span>
      </div>
      <ChevronRight
        className="slide-destination"
        size={21}
        aria-hidden="true"
      />
      <div
        ref={handle}
        className="slide-handle"
        aria-hidden="true"
        data-progress={Math.round(progress * 100)}
        data-disabled={!armed || phase === 'loading'}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={(event) => {
          if (drag.current?.id === event.pointerId) cancelDrag();
        }}
        onLostPointerCapture={(event) => {
          if (drag.current?.id === event.pointerId) cancelDrag();
        }}
        onContextMenu={(event) => event.preventDefault()}
      >
        <span className="slide-handle-face" aria-hidden="true">
          {phase === 'loading' ? (
            <LoaderCircle className="slide-spinner" size={22} />
          ) : (
            <PawPrint className="slide-paw" size={23} />
          )}
        </span>
      </div>
      <button
        type="button"
        className="slide-assistive-action"
        disabled={!armed || !ready || phase === 'loading'}
        onClick={() => void advance()}
      >
        {phase === 'error' ? 'Retry next level' : 'Continue to next level'}
      </button>
      <span className="sr-only" role="status">
        {phase === 'error'
          ? 'Could not prepare the next territory. Slide again to retry.'
          : phase === 'loading'
            ? 'Preparing next level.'
            : ''}
      </span>
    </div>
  );
}
