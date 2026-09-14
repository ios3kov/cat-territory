import { storageGet, storageSet } from './storage';
const KEY = 'cat-territory-sound-enabled-v1',
  MASTER = 0.18;
export type SoundEffect =
  | 'mark'
  | 'erase'
  | 'correct'
  | 'mistake'
  | 'strikeout'
  | 'hint'
  | 'reveal'
  | 'rollback'
  | 'catRemove'
  | 'restart'
  | 'win'
  | 'achievement'
  | 'secretAchievement'
  | 'next'
  | 'ui'
  | 'uiOpen'
  | 'uiClose'
  | 'rankUp'
  | 'moonRun'
  | 'streak';
type AW = Window &
  typeof globalThis & { webkitAudioContext?: typeof AudioContext };
let context: AudioContext | null = null,
  master: GainNode | null = null,
  soundEnabled = storageGet(KEY) !== '0',
  lastCellSoundAt = 0,
  unlockInstalled = false;
export const readSoundEnabled = () => soundEnabled;
export function setSoundEnabled(v: boolean) {
  soundEnabled = v;
  storageSet(KEY, v ? '1' : '0');
  if (!v && master && context)
    master.gain.setTargetAtTime(0, context.currentTime, 0.015);
  if (v) void unlockAudio();
}
function ensure() {
  if (!soundEnabled || document.visibilityState === 'hidden') return null;
  if (!context) {
    const w = window as AW,
      C = window.AudioContext ?? w.webkitAudioContext;
    if (!C) return null;
    try {
      context = new C();
      master = context.createGain();
      master.gain.value = MASTER;
      master.connect(context.destination);
    } catch {
      context = null;
      master = null;
      return null;
    }
  }
  if (master && master.gain.value < MASTER * 0.5)
    master.gain.setTargetAtTime(MASTER, context.currentTime, 0.015);
  return context;
}
function prime(a: AudioContext) {
  try {
    const s = a.createBufferSource(),
      g = a.createGain();
    s.buffer = a.createBuffer(1, 1, Math.max(8000, a.sampleRate));
    g.gain.value = 0;
    s.connect(g);
    g.connect(a.destination);
    s.start(0);
  } catch {
    /* Audio can remain unavailable until the next user gesture. */
  }
}
export async function unlockAudio() {
  if (!soundEnabled) return;
  const a = ensure();
  if (!a) return;
  prime(a);
  if (a.state !== 'running')
    try {
      await a.resume();
      prime(a);
    } catch {
      /* Audio can remain unavailable until the next user gesture. */
    }
}
export function installAudioUnlock() {
  if (unlockInstalled || typeof document === 'undefined') return;
  unlockInstalled = true;
  const remove = () => {
      document.removeEventListener('pointerdown', unlock, true);
      document.removeEventListener('touchstart', unlock, true);
      document.removeEventListener('keydown', unlock, true);
    },
    unlock = () =>
      void unlockAudio().finally(() => {
        if (context?.state === 'running') remove();
      });
  document.addEventListener('pointerdown', unlock, true);
  document.addEventListener('touchstart', unlock, {
    capture: true,
    passive: true,
  });
  document.addEventListener('keydown', unlock, true);
}
function tone(
  f: number,
  start: number,
  d: number,
  g = 0.28,
  type: OscillatorType = 'sine',
  end?: number,
) {
  if (!context || !master) return;
  const o = context.createOscillator(),
    e = context.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, start);
  if (end) o.frequency.exponentialRampToValueAtTime(end, start + d);
  e.gain.setValueAtTime(0.0001, start);
  e.gain.exponentialRampToValueAtTime(g, start + Math.min(0.018, d * 0.22));
  e.gain.exponentialRampToValueAtTime(0.0001, start + d);
  o.connect(e);
  e.connect(master);
  o.onended = () => {
    o.disconnect();
    e.disconnect();
  };
  o.start(start);
  o.stop(start + d + 0.02);
}
if (typeof document !== 'undefined')
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && context?.state === 'running')
      void context.suspend().catch(() => undefined);
    else if (document.visibilityState === 'visible' && context && soundEnabled)
      void unlockAudio();
  });
export function playSound(effect: SoundEffect) {
  if (effect === 'mark' || effect === 'erase') {
    const now = performance.now();
    if (now - lastCellSoundAt < 34) return;
    lastCellSoundAt = now;
  }
  const a = ensure();
  if (!a || !soundEnabled) return;
  const play = () => {
    if (
      !soundEnabled ||
      document.visibilityState === 'hidden' ||
      a.state !== 'running'
    )
      return;
    const n = a.currentTime + 0.006,
      T = (
        f: number,
        d: number,
        g = 0.12,
        t: OscillatorType = 'sine',
        end?: number,
        delay = 0,
      ) => tone(f, n + delay, d, g, t, end);
    switch (effect) {
      case 'mark':
        T(510, 0.052, 0.14, 'sine', 640);
        break;
      case 'erase':
        T(650, 0.06, 0.12, 'triangle', 430);
        break;
      case 'correct':
        T(660, 0.12, 0.24, 'sine', 760);
        T(990, 0.12, 0.15, 'sine', 1080, 0.055);
        break;
      case 'mistake':
        T(220, 0.15, 0.18, 'triangle', 150);
        T(145, 0.12, 0.11, 'sine', 118, 0.035);
        break;
      case 'strikeout':
        T(210, 0.13, 0.16, 'triangle', 145);
        T(165, 0.14, 0.15, 'triangle', 112, 0.08);
        T(118, 0.18, 0.14, 'sine', 86, 0.16);
        break;
      case 'hint':
        T(710, 0.13, 0.12, 'sine', 840);
        break;
      case 'reveal':
        T(820, 0.14, 0.13, 'sine', 980);
        T(1040, 0.16, 0.09, 'sine', 1160, 0.055);
        break;
      case 'rollback':
        T(480, 0.12, 0.12, 'triangle', 330);
        T(350, 0.1, 0.08, 'sine', 280, 0.045);
        break;
      case 'catRemove':
        T(560, 0.11, 0.11, 'sine', 360);
        break;
      case 'restart':
        T(340, 0.1, 0.13, 'triangle', 250);
        T(250, 0.12, 0.1, 'triangle', 190, 0.06);
        break;
      case 'win':
        T(523.25, 0.28, 0.17);
        T(659.25, 0.3, 0.16, 'sine', undefined, 0.055);
        T(783.99, 0.34, 0.15, 'sine', undefined, 0.11);
        break;
      case 'achievement':
        T(880, 0.16);
        T(1174.66, 0.2, 0.12, 'sine', undefined, 0.07);
        break;
      case 'secretAchievement':
        T(392, 0.22, 0.12, 'sine', 523.25);
        T(659.25, 0.24, 0.12, 'sine', 783.99, 0.08);
        T(1046.5, 0.3, 0.11, 'sine', 1318.5, 0.18);
        break;
      case 'next':
        T(520, 0.08, 0.11, 'sine', 690);
        break;
      case 'ui':
        T(560, 0.07, 0.1, 'sine', 680);
        break;
      case 'uiOpen':
        T(520, 0.075, 0.08, 'sine', 700);
        break;
      case 'uiClose':
        T(690, 0.075, 0.075, 'sine', 500);
        break;
      case 'rankUp':
        T(523.25, 0.18, 0.11);
        T(659.25, 0.2, 0.11, 'sine', undefined, 0.07);
        T(880, 0.24, 0.1, 'sine', undefined, 0.14);
        break;
      case 'moonRun':
        T(196, 0.34, 0.09, 'sine', 246.94);
        T(587.33, 0.3, 0.08, 'sine', 783.99, 0.08);
        break;
      case 'streak':
        T(920, 0.08, 0.085, 'sine', 1060);
        T(1180, 0.11, 0.065, 'sine', 1320, 0.055);
    }
  };
  if (a.state !== 'running')
    void a
      .resume()
      .then(play)
      .catch(() => undefined);
  else play();
}
