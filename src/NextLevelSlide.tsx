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

type Props = {
  ready: boolean;
  onNext: () => Promise<void>;
  onProgress?: (progress: number) => void;
};
type Phase = 'idle' | 'dragging' | 'returning' | 'loading' | 'error';
type Drag = {
  id: number;
  x: number;
  y: number;
  travel: number;
  target: HTMLDivElement;
};
const THRESHOLD = 0.8;
const clamp = (value: number) => Math.max(0, Math.min(1, value));

export function NextLevelSlide({ ready, onNext, onProgress }: Props) {
  const track = useRef<HTMLDivElement>(null),
    handle = useRef<HTMLDivElement>(null),
    drag = useRef<Drag | null>(null),
    submitting = useRef(false),
    mounted = useRef(false),
    restingPhase = useRef<'idle' | 'error'>('idle'),
    progressRef = useRef(0),
    returnFrame = useRef<number | null>(null);
  const [armed, setArmed] = useState(false),
    [phase, setPhase] = useState<Phase>('idle'),
    [progress, setProgress] = useState(0),
    [travel, setTravel] = useState(0);

  const setScrubProgress = useCallback(
    (value: number) => {
      const next = clamp(value);
      progressRef.current = next;
      setProgress(next);
      onProgress?.(next);
    },
    [onProgress],
  );
  const stopReturn = useCallback(() => {
    if (returnFrame.current !== null) cancelAnimationFrame(returnFrame.current);
    returnFrame.current = null;
  }, []);
  const animateReturn = useCallback(() => {
    stopReturn();
    const from = progressRef.current;
    if (from <= 0) {
      setScrubProgress(0);
      setPhase(restingPhase.current);
      return;
    }
    setPhase('returning');
    const duration = 110 + from * 190;
    const started = performance.now();
    const tick = (now: number) => {
      if (!mounted.current) return;
      const t = clamp((now - started) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setScrubProgress(from * (1 - eased));
      if (t < 1) returnFrame.current = requestAnimationFrame(tick);
      else {
        returnFrame.current = null;
        setScrubProgress(0);
        setPhase(restingPhase.current);
      }
    };
    returnFrame.current = requestAnimationFrame(tick);
  }, [setScrubProgress, stopReturn]);
  const cancelDrag = useCallback((animate = true) => {
    const current = drag.current;
    if (!current) return;
    drag.current = null;
    if (current.target.hasPointerCapture(current.id))
      current.target.releasePointerCapture(current.id);
    if (animate) animateReturn();
    else {
      stopReturn();
      setScrubProgress(0);
      setPhase(restingPhase.current);
    }
  }, [animateReturn, setScrubProgress, stopReturn]);

  useEffect(() => {
    mounted.current = true;
    const measure = () => {
      cancelDrag(false);
      setTravel(
        Math.max(
          0,
          (track.current?.clientWidth ?? 0) -
            (handle.current?.offsetWidth ?? 0),
        ),
      );
    };
    const hide = () => {
      if (document.visibilityState === 'hidden') cancelDrag(false);
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
      stopReturn();
      observer.disconnect();
      window.removeEventListener('blur', cancelDrag);
      window.removeEventListener('resize', cancelDrag);
      document.removeEventListener('visibilitychange', hide);
    };
  }, [cancelDrag, stopReturn]);

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
    stopReturn();
    setScrubProgress(1);
    setPhase('loading');
    haptic('next');
    try {
      await onNext();
      if (mounted.current) {
        restingPhase.current = 'idle';
        setScrubProgress(0);
        setPhase('idle');
      }
    } catch {
      if (mounted.current) {
        restingPhase.current = 'error';
        setScrubProgress(0);
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
      phase === 'returning' ||
      drag.current ||
      !event.isPrimary ||
      event.button !== 0 ||
      travel <= 0
    )
      return;
    event.preventDefault();
    event.stopPropagation();
    stopReturn();
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
    setScrubProgress(0);
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
    const nextProgress = clamp((event.clientX - current.x) / current.travel);
    setScrubProgress(nextProgress);
  };
  const pointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    const completed =
      (event.clientX - current.x) / current.travel >= THRESHOLD &&
      Math.abs(event.clientY - current.y) <= 80;
    if (completed) {
      cancelDrag(false);
      void advance();
    } else cancelDrag(true);
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
        data-disabled={!armed || phase === 'loading' || phase === 'returning'}
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
