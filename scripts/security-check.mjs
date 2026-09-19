import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const headers = await readFile(resolve('dist/_headers'), 'utf8');
const requiredHeaders = [
  'X-Frame-Options: DENY',
  'X-Content-Type-Options: nosniff',
  'Referrer-Policy: no-referrer',
  'Permissions-Policy:',
  'Content-Security-Policy:',
];
const requiredCsp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "script-src 'self'",
  "connect-src 'self'",
  "worker-src 'self'",
];

const missing = [
  ...requiredHeaders.filter((value) => !headers.includes(value)),
  ...requiredCsp.filter((value) => !headers.includes(value)),
];
if (missing.length)
  throw new Error(`Security policy is missing: ${missing.join(', ')}`);

console.log('Production security headers: OK');
