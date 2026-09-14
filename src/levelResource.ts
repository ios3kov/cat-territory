import {
  CURATED_LEVEL_COUNT,
  getLevel as getCuratedLevel,
  levelSizeAt,
  readGenerated,
  readPersistedDaily,
  rememberGenerated,
  rememberDaily,
} from './infiniteLevels';
import type { CatalogLevel } from './levelCatalog';
export { CURATED_LEVEL_COUNT, levelSizeAt };
type Resource = {
  level?: CatalogLevel;
  error?: Error;
  promise?: Promise<void>;
};
const resources = new Map<string, Resource>();
function resource(
  key: string,
  request: { index?: number; dateKey?: string },
): Resource {
  for (const [old, r] of resources) {
    if (resources.size < 20) break;
    if (old !== key && (r.level || r.error)) resources.delete(old);
  }
  const cached = resources.get(key);
  if (cached) return cached;
  const persisted =
    request.index !== undefined
      ? readGenerated(request.index)
      : readPersistedDaily(request.dateKey!);
  const entry: Resource = { level: persisted ?? undefined };
  resources.set(key, entry);
  // Cached fields are validated synchronously; expensive candidate search runs only in a worker.
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
      if (level) {
        if (request.index !== undefined)
          rememberGenerated(request.index, level);
        else rememberDaily(request.dateKey!, level);
      }
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
function read(key: string, request: { index?: number; dateKey?: string }) {
  const r = resource(key, request);
  if (r.error) throw r.error;
  if (r.level) return r.level;
  throw r.promise;
}
export function getLevel(index: number): CatalogLevel {
  if (index < CURATED_LEVEL_COUNT) return getCuratedLevel(index);
  return read(`level-${index}`, { index });
}
export function getDailyLevel(dateKey: string): CatalogLevel {
  return read(`daily-${dateKey}`, { dateKey });
}
export async function prepareLevel(index: number) {
  if (index < CURATED_LEVEL_COUNT) return;
  const key = `level-${index}`;
  if (resources.get(key)?.error) resources.delete(key);
  const r = resource(key, { index });
  await r.promise;
  if (r.error) throw r.error;
}
export function prewarmLevel(index: number) {
  if (index >= CURATED_LEVEL_COUNT)
    void prepareLevel(index).catch(() => undefined);
}
