import { playAudioCue, type AudioOutput } from './audioOutput';
export {
  readSoundEnabled,
  setSoundEnabled,
  unlockAudio,
  installAudioUnlock,
} from './audioOutput';
let lastCellSoundAt = -Infinity;
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
function tone(
  { context, master }: AudioOutput,
  f: number,
  start: number,
  d: number,
  g = 0.28,
  type: OscillatorType = 'sine',
  end?: number,
) {
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
export function playSound(effect: SoundEffect) {
  if (effect === 'mark' || effect === 'erase') {
    const now = performance.now();
    if (now - lastCellSoundAt < 34) return;
    lastCellSoundAt = now;
  }
  playAudioCue((output) => {
    const a = output.context;
    const n = a.currentTime + 0.006,
      T = (
        f: number,
        d: number,
        g = 0.12,
        t: OscillatorType = 'sine',
        end?: number,
        delay = 0,
      ) => tone(output, f, n + delay, d, g, t, end);
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
  });
}
