import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

// Called after Vite has written HTML, lazy chunks and the generation worker.
export async function buildOfflineWorker(outDir) {
  const template = await readFile(
    new URL('../src/serviceWorker.js', import.meta.url),
    'utf8',
  );
  const paths = [];
  async function visit(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.name !== 'sw.js' && !entry.name.endsWith('.map'))
        paths.push(relative(outDir, path).split('\\').join('/'));
    }
  }
  await visit(outDir);
  paths.sort();
  const hash = createHash('sha256').update(template);
  for (const path of paths)
    hash.update(path).update(await readFile(join(outDir, path)));
  const version = hash.digest('hex').slice(0, 20);
  const worker = template
    .replace('__RELEASE_VERSION__', version)
    .replace(
      '/* __PRECACHE__ */ []',
      JSON.stringify(paths.map((path) => './' + path)),
    );
  await writeFile(join(outDir, 'sw.js'), worker);
  return { version, paths };
}
