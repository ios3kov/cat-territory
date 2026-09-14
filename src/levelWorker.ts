import { getLevel } from './infiniteLevels';
self.onmessage = (event: MessageEvent<{ index: number }>) => {
  try {
    self.postMessage({
      level: getLevel(event.data.index),
    });
  } catch (error) {
    self.postMessage({
      error:
        error instanceof Error ? error.message : 'Unable to create territory.',
    });
  }
};
