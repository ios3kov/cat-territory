import { getLevel } from './infiniteLevels';

type Request = { index: number; phaseOffset?: number };

self.onmessage = (event: MessageEvent<Request>) => {
  try {
    self.postMessage({
      level: getLevel(event.data.index, event.data.phaseOffset ?? 0),
    });
  } catch (error) {
    self.postMessage({
      error:
        error instanceof Error ? error.message : 'Unable to create territory.',
    });
  }
};
