import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const [headers, serviceWorker] = await Promise.all([
  readFile(resolve('dist/_headers'), 'utf8'),
  readFile(resolve('dist/sw.js'), 'utf8'),
]);
const requiredHeaders = [
  'X-Frame-Options: DENY',
  'X-Content-Type-Options: nosniff',
  'Referrer-Policy: no-referrer',
  'Permissions-Policy:',
  'Content-Security-Policy:',
];
const requiredCsp = [
  "default-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-src 'none'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "script-src 'self'",
  "script-src-attr 'none'",
  "connect-src 'self'",
  "worker-src 'self'",
  'upgrade-insecure-requests',
];

const missing = [
  ...requiredHeaders.filter((value) => !headers.includes(value)),
  ...requiredCsp.filter((value) => !headers.includes(value)),
];
if (missing.length)
  throw new Error(`Security policy is missing: ${missing.join(', ')}`);

for (const controlFile of ['_headers', '_redirects', '_routes.json'])
  if (serviceWorker.includes(`"./${controlFile}"`))
    throw new Error(
      `Deployment control file ${controlFile} must not be precached`,
    );

console.log('Production security headers and offline asset boundary: OK');
