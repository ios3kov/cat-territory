import { playAudioCue, type AudioOutput } from './audioOutput';

export {
  installAudioUnlock,
  readSoundEnabled,
  setSoundEnabled,
  unlockAudio,
} from './audioOutput';

export type SoundEffect =
  | 'drop'
  | 'bounce'
  | 'merge'
  | 'order'
  | 'fail'
  | 'restart'
  | 'ui';

let lastBounceAt = -Infinity;

function tone(
  { context, master }: AudioOutput,
  frequency: number,
  start: number,
  duration: number,
  gain = 0.14,
  type: OscillatorType = 'sine',
  end?: number
) {
  const oscillator = context.createOscillator();
  const envelope = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  if (end)
    oscillator.frequency.exponentialRampToValueAtTime(end, start + duration);
  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(
    gain,
    start + Math.min(0.018, duration * 0.2)
  );
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(envelope);
  envelope.connect(master);
  oscillator.onended = () => {
    oscillator.disconnect();
    envelope.disconnect();
  };
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

export function playSound(effect: SoundEffect) {
  if (effect === 'bounce') {
    const now = performance.now();
    if (now - lastBounceAt < 90) return;
    lastBounceAt = now;
  }
  playAudioCue(output => {
    const now = output.context.currentTime + 0.006;
    const t = (
      frequency: number,
      duration: number,
      gain = 0.12,
      type: OscillatorType = 'sine',
      end?: number,
      delay = 0
    ) => tone(output, frequency, now + delay, duration, gain, type, end);

    switch (effect) {
      case 'drop':
        t(360, 0.075, 0.08, 'sine', 300);
        break;
      case 'bounce':
        t(190, 0.04, 0.035, 'sine', 150);
        break;
      case 'merge':
        t(520, 0.12, 0.13, 'sine', 740);
        t(820, 0.12, 0.08, 'sine', 940, 0.055);
        break;
      case 'order':
        t(523.25, 0.19, 0.13);
        t(659.25, 0.21, 0.12, 'sine', undefined, 0.07);
        t(880, 0.25, 0.1, 'sine', undefined, 0.14);
        break;
      case 'fail':
        t(220, 0.18, 0.13, 'triangle', 145);
        t(145, 0.18, 0.09, 'sine', 110, 0.07);
        break;
      case 'restart':
        t(340, 0.08, 0.08, 'triangle', 250);
        break;
      case 'ui':
        t(560, 0.07, 0.08, 'sine', 680);
        break;
    }
  });
}
