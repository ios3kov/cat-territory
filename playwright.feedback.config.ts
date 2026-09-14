import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

export default defineConfig({
  ...base,
  testMatch: /(?:audio-recovery|cat-motion)\.spec\.ts/,
  projects: [
    {
      name: 'webkit-portrait',
      use: {
        ...devices['iPhone 13'],
        launchOptions: { executablePath: undefined, args: [] },
      },
    },
    {
      name: 'webkit-landscape',
      use: {
        ...devices['iPhone 13 landscape'],
        launchOptions: { executablePath: undefined, args: [] },
      },
    },
  ],
});
