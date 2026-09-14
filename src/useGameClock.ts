import { useCallback, useEffect, useRef, useState } from 'react';

type SavedClock = { seconds: number; started: boolean };

// Both modes count wall time, but avoid rendering ticks while the tab is hidden.
export function useGameClock(
  initial: SavedClock | null | undefined,
  stopped: boolean,
) {
  const [seconds, setSeconds] = useState(initial?.seconds ?? 0);
  const [started, setStarted] = useState(initial?.started ?? false);
  const startedRef = useRef(started);
  const startedAt = useRef(Date.now() - seconds * 1000);
  const start = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    startedAt.current = Date.now() - seconds * 1000;
    setStarted(true);
  }, [seconds]);
  const restore = useCallback((elapsed = 0, running = false) => {
    startedRef.current = running;
    startedAt.current = Date.now() - elapsed * 1000;
    setSeconds(elapsed);
    setStarted(running);
  }, []);
  useEffect(() => {
    if (!started || stopped) return;
    const update = () => {
      if (document.visibilityState === 'visible')
        setSeconds(Math.floor((Date.now() - startedAt.current) / 1000));
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [started, stopped]);
  return { seconds, started, start, restore };
}
