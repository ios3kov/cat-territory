import { storageGet, storageSet } from './storage';

const SOUND_KEY = 'cat-territory-sound-enabled-v1';
const MASTER_VOLUME = 0.18;
const CUE_MAX_AGE_MS = 350;
// The first device activation can take longer than an ordinary interruption.
const STARTUP_CUE_MAX_AGE_MS = 1500;
type AudioWindow = Window & { webkitAudioContext?: typeof AudioContext };
export type AudioOutput = { context: AudioContext; master: GainNode };
type PendingCue = { play: (output: AudioOutput) => void; expiresAt: number };
let output: AudioOutput | null = null;
let enabled = storageGet(SOUND_KEY) !== '0';
let installed = false;
let outputReady = false;
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
function ensureOutput(allowCreation = false) {
  if (!enabled || !visible()) return null;
  if (output?.context.state === 'closed') {
    output = null;
    outputReady = false;
    resuming = null;
    pendingCue = null;
  }
  if (!output && allowCreation) {
    const Constructor =
      window.AudioContext ?? (window as AudioWindow).webkitAudioContext;
    if (!Constructor) return null;
    try {
      const context = new Constructor({ latencyHint: 'interactive' });
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
  outputReady = true;
  const cue = pendingCue;
  pendingCue = null;
  if (cue && enabled && visible() && performance.now() <= cue.expiresAt)
    cue.play(current);
}
function suspendOutput(current: AudioOutput) {
  if (current.context.state !== 'running') return;
  void current.context
    .suspend()
    .then(() => {
      // A rapid return can happen before the device finishes suspending.
      if (current === output && enabled && visible()) void unlockAudio();
    })
    .catch(() => undefined);
}
export async function unlockAudio(fromGesture = false) {
  const current = ensureOutput(fromGesture);
  if (!current) return;
  if (current.context.state === 'running') {
    if (resuming) return resuming;
    if (!outputReady) prime(current.context);
    flushCue(current);
    return;
  }
  // A fresh gesture must be allowed to retry a resume pending since tab activation.
  if (resuming && !fromGesture) return resuming;
  prime(current.context);
  const attempt = current.context
    .resume()
    .then(() => {
      if (current !== output) return;
      flushCue(current);
      if (!visible()) suspendOutput(current);
    })
    .catch(() => {
      // Autoplay policy or an OS interruption can require another user gesture.
    });
  resuming = attempt;
  await attempt;
  if (resuming === attempt) {
    resuming = null;
    // A game event can arrive between the resume callback and this continuation.
    // Flush that cue now rather than waiting for an unrelated later gesture.
    flushCue(current);
  }
}
export function setSoundEnabled(value: boolean) {
  enabled = value;
  pendingCue = null;
  storageSet(SOUND_KEY, value ? '1' : '0');
  setVolume();
  if (value) void unlockAudio(true);
}
export function playAudioCue(play: (output: AudioOutput) => void) {
  if (!enabled || !visible()) return;
  const current = ensureOutput();
  if (current?.context.state === 'running' && !resuming && outputReady) {
    pendingCue = null;
    play(current);
    return;
  }
  // Keep one recent cue instead of replaying a backlog when audio returns.
  pendingCue = {
    play,
    expiresAt:
      performance.now() +
      (outputReady ? CUE_MAX_AGE_MS : STARTUP_CUE_MAX_AGE_MS),
  };
  void unlockAudio();
}
export function installAudioUnlock() {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  const unlock = () => {
    if (enabled) void unlockAudio(true);
  };
  // Keep these listeners: iOS can interrupt an already-unlocked context later.
  // Start the audio session at the earliest real gesture. On iOS/WebKit a
  // cold AudioContext may need the whole tap duration before it can emit the
  // first game cue, so waiting until release can make tap #1 silent.
  document.addEventListener('pointerdown', unlock, true);
  document.addEventListener('touchstart', unlock, {
    capture: true,
    passive: true,
  });
  // Keep release listeners as retries for browsers/OS states that reject the
  // first resume attempt or interrupt an already-created context.
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
      if (output) suspendOutput(output);
    } else if (output && enabled) void unlockAudio();
  });
}
