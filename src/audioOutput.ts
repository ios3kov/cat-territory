import { storageGet, storageSet } from './storage';

const SOUND_KEY = 'cat-territory-sound-enabled-v1';
const MASTER_VOLUME = 0.18;
const CUE_MAX_AGE_MS = 350;
type AudioWindow = Window & { webkitAudioContext?: typeof AudioContext };
export type AudioOutput = { context: AudioContext; master: GainNode };
type PendingCue = { play: (output: AudioOutput) => void; requestedAt: number };
let output: AudioOutput | null = null;
let enabled = storageGet(SOUND_KEY) !== '0';
let installed = false;
let pendingCue: PendingCue | null = null;
let resuming: Promise<void> | null = null;

export const readSoundEnabled = () => enabled;
const visible = () => document.visibilityState !== 'hidden';
function setVolume() {
  if (!output || output.context.state === 'closed') return;
  const { context, master } = output;
  // Cancel a pending mute ramp even when its current value still looks audible.
  master.gain.cancelScheduledValues(context.currentTime);
  master.gain.setTargetAtTime(
    enabled ? MASTER_VOLUME : 0,
    context.currentTime,
    0.015,
  );
}
function ensureOutput() {
  if (!enabled || !visible()) return null;
  if (output?.context.state === 'closed') {
    output = null;
    resuming = null;
    pendingCue = null;
  }
  if (!output) {
    const Constructor =
      window.AudioContext ?? (window as AudioWindow).webkitAudioContext;
    if (!Constructor) return null;
    try {
      const context = new Constructor();
      const master = context.createGain();
      master.gain.value = MASTER_VOLUME;
      master.connect(context.destination);
      output = { context, master };
    } catch {
      output = null;
    }
  }
  return output;
}
function prime(context: AudioContext) {
  try {
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = context.createBuffer(
      1,
      1,
      Math.max(8000, context.sampleRate),
    );
    gain.gain.value = 0;
    source.connect(gain);
    gain.connect(context.destination);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
    };
    source.start(0);
  } catch {
    // A later gesture can retry an interrupted audio session.
  }
}
function flushCue(current: AudioOutput) {
  if (current !== output || current.context.state !== 'running') return;
  const cue = pendingCue;
  pendingCue = null;
  if (
    cue &&
    enabled &&
    visible() &&
    performance.now() - cue.requestedAt <= CUE_MAX_AGE_MS
  )
    cue.play(current);
}
export async function unlockAudio(fromGesture = false) {
  const current = ensureOutput();
  if (!current || current.context.state === 'running') return;
  // A fresh gesture must be allowed to retry a resume pending since tab activation.
  if (resuming && !fromGesture) return resuming;
  prime(current.context);
  const attempt = current.context
    .resume()
    .then(() => {
      if (current !== output) return;
      flushCue(current);
    })
    .catch(() => {
      // Autoplay policy or an OS interruption can require another user gesture.
    });
  resuming = attempt;
  await attempt;
  if (resuming === attempt) resuming = null;
}
export function setSoundEnabled(value: boolean) {
  enabled = value;
  pendingCue = null;
  storageSet(SOUND_KEY, value ? '1' : '0');
  setVolume();
  if (value) void unlockAudio(true);
}
export function playAudioCue(play: (output: AudioOutput) => void) {
  const current = ensureOutput();
  if (!current) return;
  if (current.context.state === 'running') {
    pendingCue = null;
    play(current);
    return;
  }
  // Keep one recent cue instead of replaying a backlog when audio returns.
  pendingCue = { play, requestedAt: performance.now() };
  void unlockAudio();
}
export function installAudioUnlock() {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  const unlock = () => {
    if (enabled) void unlockAudio(true);
  };
  // Keep these listeners: iOS can interrupt an already-unlocked context later.
  document.addEventListener('pointerdown', unlock, true);
  document.addEventListener('touchstart', unlock, {
    capture: true,
    passive: true,
  });
  // Touch activation is granted on release. A resume requested at touchstart
  // can remain blocked, so retry inside the release gesture itself.
  document.addEventListener('pointerup', unlock, true);
  document.addEventListener('touchend', unlock, {
    capture: true,
    passive: true,
  });
  document.addEventListener('click', unlock, true);
  document.addEventListener('keydown', unlock, true);
  document.addEventListener('visibilitychange', () => {
    if (!visible()) {
      pendingCue = null;
      const current = output;
      if (current?.context.state === 'running') {
        void current.context
          .suspend()
          .then(() => {
            // The tab may have returned before the asynchronous suspend completed.
            if (current === output && enabled && visible()) void unlockAudio();
          })
          .catch(() => undefined);
      }
    } else if (output && enabled) void unlockAudio();
  });
}
