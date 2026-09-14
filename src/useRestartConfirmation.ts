import { useCallback, useEffect, useRef, useState } from 'react';
import { clearTimer, scheduleTimer } from './scheduler';

export function useRestartConfirmation() {
  const [armed, setArmed] = useState(false);
  const timer = useRef<number | null>(null);
  const cancel = useCallback(() => {
    clearTimer(timer);
    setArmed(false);
  }, []);
  const confirm = () => {
    if (armed) {
      cancel();
      return true;
    }
    setArmed(true);
    scheduleTimer(timer, () => setArmed(false), 2200);
    return false;
  };
  useEffect(() => () => clearTimer(timer), []);
  return { armed, cancel, confirm };
}
