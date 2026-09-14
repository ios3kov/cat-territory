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
    audioRecovery: { contexts: RecoveryContext[]; coldDeferred: boolean };
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
      deferResume = harness.coldDeferred;
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
    const harness = { contexts: [] as FakeAudio[], coldDeferred: false };
    Object.assign(window, { audioRecovery: harness });
    Object.defineProperty(window, 'AudioContext', { value: FakeAudio });
    localStorage.setItem('cat-territory-gesture-coach-v3', 'done');
  });
  await page.goto('/');
});

test('quick mute toggle cancels the fade and interruptions recover on later gestures', async ({
  page,
}) => {
  await page.keyboard.press('Shift');
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
  await page.keyboard.press('Shift');
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
  await page.keyboard.press('Shift');
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
  await page.keyboard.press('Shift');
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

test('cold touch creates audio only on release and preserves the first cue during slow startup', async ({
  page,
}) => {
  await page.evaluate(() => {
    window.audioRecovery.coldDeferred = true;
    document.dispatchEvent(
      new PointerEvent('pointerdown', { pointerType: 'touch' }),
    );
    document.dispatchEvent(new Event('touchstart'));
  });
  expect(await page.evaluate(() => window.audioRecovery.contexts.length)).toBe(
    0,
  );
  await page.evaluate(async () => {
    document.dispatchEvent(
      new PointerEvent('pointerup', { pointerType: 'touch' }),
    );
    const audio = await import('/src/audio.ts');
    audio.playSound('mark');
  });
  await page.waitForTimeout(600);
  expect(
    await page.evaluate(() => window.audioRecovery.contexts[0].starts),
  ).toBe(0);
  await page.evaluate(() => window.audioRecovery.contexts[0].finishResume());
  await expect
    .poll(() => page.evaluate(() => window.audioRecovery.contexts[0].starts))
    .toBe(1);
});
test('slow cold start does not discard a cue after 350 milliseconds', async ({
  page,
}) => {
  await page.evaluate(() => (window.audioRecovery.coldDeferred = true));
  await page.keyboard.press('Shift');
  await page.evaluate(async () => {
    (await import('/src/audio.ts')).playSound('mark');
  });
  await page.waitForTimeout(600);
  await page.evaluate(() => window.audioRecovery.contexts[0].finishResume());
  await expect
    .poll(() => page.evaluate(() => window.audioRecovery.contexts[0].starts))
    .toBe(1);
});

test('first actual board gesture emits one mark without a warm-up gesture', async ({
  page,
  isMobile,
}) => {
  expect(await page.evaluate(() => window.audioRecovery.contexts.length)).toBe(
    0,
  );
  const cell = page.locator('[data-cell-index="9"]');
  if (isMobile) await cell.tap();
  else await cell.click();
  await expect(cell.locator('.mark-x')).toHaveCount(1);
  await expect
    .poll(() => page.evaluate(() => window.audioRecovery.contexts[0]?.starts))
    .toBe(1);
});
for (const cancel of ['mute', 'hidden', 'expired'] as const) {
  test(`cold startup cancels pending sound when ${cancel}`, async ({
    page,
  }) => {
    await page.evaluate(() => (window.audioRecovery.coldDeferred = true));
    await page.keyboard.press('Shift');
    await page.evaluate(async () => {
      (await import('/src/audio.ts')).playSound('correct');
    });
    if (cancel === 'expired') await page.waitForTimeout(1600);
    else
      await page.evaluate(async (mode) => {
        if (mode === 'mute')
          (await import('/src/audio.ts')).setSoundEnabled(false);
        else {
          Object.defineProperty(document, 'visibilityState', {
            configurable: true,
            value: 'hidden',
          });
          document.dispatchEvent(new Event('visibilitychange'));
        }
      }, cancel);
    await page.evaluate(() => window.audioRecovery.contexts[0].finishResume());
    await page.waitForTimeout(20);
    expect(
      await page.evaluate(() => window.audioRecovery.contexts[0].starts),
    ).toBe(0);
    if (cancel === 'hidden')
      await expect
        .poll(() => page.evaluate(() => window.audioRecovery.contexts[0].state))
        .toBe('suspended');
  });
}
test('all effect recipes play and repeated gesture listeners never duplicate a cue', async ({
  page,
}) => {
  await page.keyboard.press('Shift');
  const result = await page.evaluate(async () => {
    const audio = await import('/src/audio.ts');
    const effects = [
      'mark',
      'erase',
      'correct',
      'mistake',
      'strikeout',
      'hint',
      'reveal',
      'rollback',
      'catRemove',
      'restart',
      'win',
      'achievement',
      'secretAchievement',
      'next',
      'ui',
      'uiOpen',
      'uiClose',
      'rankUp',
      'moonRun',
    ] as const;
    const c = window.audioRecovery.contexts[0];
    const counts: number[] = [];
    for (const effect of effects) {
      const before = c.starts;
      audio.playSound(effect);
      counts.push(c.starts - before);
      await new Promise((r) => setTimeout(r, 40));
    }
    const before = c.starts;
    audio.installAudioUnlock();
    audio.installAudioUnlock();
    document.dispatchEvent(
      new PointerEvent('pointerup', { pointerType: 'touch' }),
    );
    document.dispatchEvent(new Event('touchend'));
    document.dispatchEvent(new MouseEvent('click'));
    await Promise.resolve();
    return { counts, duplicate: c.starts - before };
  });
  expect(result.counts.every((n) => n > 0)).toBe(true);
  expect(result.duplicate).toBe(0);
});

test('saved mute prevents cold audio creation and enabling plays only its confirmation', async ({
  page,
}) => {
  await page.evaluate(() =>
    localStorage.setItem('cat-territory-sound-enabled-v1', '0'),
  );
  await page.reload();
  await page.locator('[data-cell-index="9"]').click();
  expect(await page.evaluate(() => window.audioRecovery.contexts.length)).toBe(
    0,
  );
  await page.getByRole('button', { name: 'Sound effects off' }).click();
  await expect
    .poll(() => page.evaluate(() => window.audioRecovery.contexts[0]?.starts))
    .toBe(1);
  await expect(
    page.getByRole('button', { name: 'Sound effects on' }),
  ).toBeVisible();
});

test('a cue arriving as resume settles is not stranded until the next gesture', async ({
  page,
}) => {
  await page.keyboard.press('Shift');
  const count = await page.evaluate(async () => {
    const audio = await import('/src/audio.ts');
    const c = window.audioRecovery.contexts[0];
    c.state = 'suspended';
    c.deferResume = true;
    const before = c.starts;
    audio.playSound('mark');
    c.finishResume();
    await Promise.resolve();
    audio.playSound('hint');
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    return c.starts - before;
  });
  expect(count).toBe(2);
});
