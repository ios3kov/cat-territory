import { getAdaptivePhaseOffset } from './adaptiveDifficulty';
import {
  CURATED_LEVEL_COUNT,
  levelSizeAt,
  readGenerated,
  rememberGenerated,
} from './infiniteLevels';
import type { CatalogLevel } from './levelCatalog';

export { CURATED_LEVEL_COUNT, levelSizeAt };

type LevelRequest = { index: number; phaseOffset: number };
type Resource = {
  level?: CatalogLevel;
  error?: Error;
  promise?: Promise<void>;
};

const resources = new Map<string, Resource>();

function requestFor(index: number): LevelRequest {
  return { index, phaseOffset: getAdaptivePhaseOffset() };
}

function resource(key: string, request: LevelRequest): Resource {
  for (const [old, item] of resources) {
    if (resources.size < 20) break;
    if (old !== key && (item.level || item.error)) resources.delete(old);
  }
  const cached = resources.get(key);
  if (cached) return cached;
  const persisted = readGenerated(request.index),
    entry: Resource = { level: persisted ?? undefined };
  resources.set(key, entry);
  if (entry.level) return entry;
  entry.promise = new Promise<void>((resolve) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL('./levelWorker.ts', import.meta.url), {
        type: 'module',
      });
    } catch {
      entry.error = new Error(
        'Could not start territory generation. Please reload.',
      );
      resolve();
      return;
    }
    const finish = (level?: CatalogLevel, error?: string) => {
      clearTimeout(timeout);
      worker.terminate();
      entry.level = level;
      if (level) rememberGenerated(request.index, level);
      entry.error = error ? new Error(error) : undefined;
      resolve();
    };
    const timeout = window.setTimeout(
      () => finish(undefined, 'Territory generation timed out. Please retry.'),
      60000,
    );
    worker.onmessage = (event) => finish(event.data.level, event.data.error);
    worker.onerror = () =>
      finish(undefined, 'Could not prepare territory. Please retry.');
    try {
      worker.postMessage(request);
    } catch {
      finish(undefined, 'Could not prepare territory. Please retry.');
    }
  });
  return entry;
}

function read(key: string, request: LevelRequest) {
  const entry = resource(key, request);
  if (entry.error) throw entry.error;
  if (entry.level) return entry.level;
  throw entry.promise;
}

export function getLevel(index: number): CatalogLevel {
  return read(`level-${index}`, requestFor(index));
}

export function peekLevel(index: number): CatalogLevel | undefined {
  return (
    resources.get(`level-${index}`)?.level ?? readGenerated(index) ?? undefined
  );
}

export async function prepareLevel(index: number) {
  const key = `level-${index}`;
  if (resources.get(key)?.error) resources.delete(key);
  const entry = resource(key, requestFor(index));
  await entry.promise;
  if (entry.error) throw entry.error;
}

export function prewarmLevel(index: number) {
  void prepareLevel(index).catch(() => undefined);
}
