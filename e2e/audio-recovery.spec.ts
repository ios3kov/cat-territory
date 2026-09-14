import { expect, test } from '@playwright/test';

type RecoveryContext = {
  state: string;
  resumes: number;
  starts: number;
  allowResume: boolean;
  deferSuspend: boolean;
  deferResume: boolean;
  master: { target: number; cancellations: number };
  finishSuspend: () => void;
  finishResume: () => void;
};
declare global {
  interface Window {
    audioRecovery: { contexts: RecoveryContext[] };
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    type Parameter = {
      value: number;
      target: number;
      cancellations: number;
      cancelScheduledValues(): void;
      setTargetAtTime(value: number): void;
      setValueAtTime(): void;
      exponentialRampToValueAtTime(): void;
    };
    const parameter = (): Parameter => ({
      value: 0.18,
      target: 0.18,
      cancellations: 0,
      cancelScheduledValues() {
        this.cancellations++;
      },
      setTargetAtTime(value) {
        this.target = value;
      },
      setValueAtTime() {},
      exponentialRampToValueAtTime() {},
    });
    class FakeAudio {
      state = 'suspended';
      currentTime = 0;
      sampleRate = 44100;
      destination = {};
      resumes = 0;
      starts = 0;
      allowResume = true;
      deferSuspend = false;
      deferResume = false;
      master: Parameter | null = null;
      finishSuspend: (() => void) | null = null;
      finishResume: (() => void) | null = null;
      constructor() {
        harness.contexts.push(this);
      }
      createGain() {
        const gain = parameter();
        this.master ??= gain;
        return { gain, connect() {}, disconnect() {} };
      }
      createBuffer() {
        return {};
      }
      createBufferSource() {
        return { connect() {}, disconnect() {}, start() {} };
      }
      createOscillator() {
        return {
          frequency: parameter(),
          connect() {},
          disconnect() {},
          start: () => {
            this.starts++;
          },
          stop() {},
        };
      }
      resume() {
        this.resumes++;
        if (!this.allowResume)
          return Promise.reject(new Error('Gesture required'));
        if (this.deferResume)
          return new Promise<void>((resolve) => {
            this.finishResume = () => {
              this.state = 'running';
              resolve();
            };
          });
        this.state = 'running';
        return Promise.resolve();
      }
      suspend() {
        if (this.deferSuspend)
          return new Promise<void>((resolve) => {
            this.finishSuspend = () => {
              this.state = 'suspended';
              resolve();
            };
          });
        this.state = 'suspended';
        return Promise.resolve();
      }
    }
    const harness = { contexts: [] as FakeAudio[] };
    Object.assign(window, { audioRecovery: harness });
    Object.defineProperty(window, 'AudioContext', { value: FakeAudio });
    localStorage.setItem('cat-territory-gesture-coach-v3', 'done');
  });
  await page.goto('/');
  await page.keyboard.press('Shift');
});

test('quick mute toggle cancels the fade and interruptions recover on later gestures', async ({
  page,
}) => {
  const toggled = await page.evaluate(async () => {
    const audio = await import('/src/audio.ts');
    audio.setSoundEnabled(false);
    audio.setSoundEnabled(true);
    const context = window.audioRecovery.contexts[0];
    return {
      target: context.master.target,
      cancellations: context.master.cancellations,
    };
  });
  expect(toggled.target).toBe(0.18);
  expect(toggled.cancellations).toBeGreaterThanOrEqual(2);
  for (let i = 0; i < 3; i++) {
    await page.evaluate(async () => {
      const context = window.audioRecovery.contexts[0];
      context.state = 'interrupted';
      context.allowResume = false;
      const audio = await import('/src/audio.ts');
      await audio.unlockAudio();
      context.allowResume = true;
    });
    await page.keyboard.press('Shift');
    await expect
      .poll(() => page.evaluate(() => window.audioRecovery.contexts[0].state))
      .toBe('running');
  }
  const starts = await page.evaluate(async () => {
    const audio = await import('/src/audio.ts');
    const c = window.audioRecovery.contexts[0];
    const before = c.starts;
    audio.playSound('correct');
    return c.starts - before;
  });
  expect(starts).toBe(2);
});

test('returning before suspend completes recovers and a closed context is recreated', async ({
  page,
}) => {
  await page.evaluate(() => {
    const context = window.audioRecovery.contexts[0];
    context.deferSuspend = true;
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
    document.dispatchEvent(new Event('visibilitychange'));
    context.finishSuspend();
  });
  await expect
    .poll(() => page.evaluate(() => window.audioRecovery.contexts[0].state))
    .toBe('running');
  await page.evaluate(
    () => (window.audioRecovery.contexts[0].state = 'closed'),
  );
  await page.keyboard.press('Shift');
  await expect
    .poll(() => page.evaluate(() => window.audioRecovery.contexts.length))
    .toBe(2);
  expect(
    await page.evaluate(() => window.audioRecovery.contexts[1].state),
  ).toBe('running');
});

test('resume plays only the latest queued cue and mute discards pending sound', async ({
  page,
}) => {
  const starts = await page.evaluate(async () => {
    const audio = await import('/src/audio.ts');
    const c = window.audioRecovery.contexts[0];
    c.state = 'suspended';
    c.deferResume = true;
    const before = c.starts;
    audio.playSound('mark');
    audio.playSound('correct');
    audio.playSound('mistake');
    c.finishResume();
    await audio.unlockAudio();
    await Promise.resolve();
    return c.starts - before;
  });
  expect(starts).toBe(2);
  const muted = await page.evaluate(async () => {
    const audio = await import('/src/audio.ts');
    const c = window.audioRecovery.contexts[0];
    c.state = 'suspended';
    const before = c.starts;
    audio.playSound('correct');
    audio.setSoundEnabled(false);
    c.finishResume();
    await Promise.resolve();
    await Promise.resolve();
    return c.starts - before;
  });
  expect(muted).toBe(0);
});

test('first touch release retries audio blocked at touch start without waiting for another action', async ({
  page,
}) => {
  await page.evaluate(async () => {
    const audio = await import('/src/audio.ts');
    const c = window.audioRecovery.contexts[0];
    c.state = 'suspended';
    c.allowResume = false;
    document.dispatchEvent(
      new PointerEvent('pointerdown', { pointerType: 'touch' }),
    );
    audio.playSound('mark');
  });
  const before = await page.evaluate(
    () => window.audioRecovery.contexts[0].starts,
  );
  await page.evaluate(() => {
    window.audioRecovery.contexts[0].allowResume = true;
    document.dispatchEvent(
      new PointerEvent('pointerup', { pointerType: 'touch' }),
    );
  });
  await expect
    .poll(() => page.evaluate(() => window.audioRecovery.contexts[0].state))
    .toBe('running');
  expect(
    await page.evaluate(() => window.audioRecovery.contexts[0].starts),
  ).toBeGreaterThan(before);
});
