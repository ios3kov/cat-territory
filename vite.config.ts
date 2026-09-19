import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import { buildOfflineWorker } from './scripts/build-offline-worker.mjs';
let outputDirectory: string;

const iconSource = resolve('scripts/assets/icon-180.b64');
const appleIcon = resolve('public/icon-180.png');
writeFileSync(
  appleIcon,
  Buffer.from(readFileSync(iconSource, 'utf8').trim(), 'base64'),
);

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'offline-release',
      apply: 'build',
      configResolved(config) {
        outputDirectory = resolve(config.root, config.build.outDir);
      },
      async closeBundle() {
        await buildOfflineWorker(outputDirectory);
      },
    },
  ],
  base: './',
  build: {
    outDir: process.env.APPDEPLOY_VITE_OUT_DIR || 'dist',
    sourcemap:
      process.env.APPDEPLOY_VITE_SOURCEMAP === 'hidden' ? 'hidden' : false,
    rollupOptions: { maxParallelFileOps: 128 },
  },
});
