import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e-offline',
  workers: 1,
  timeout: 45000,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? {
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
          args: ['--no-sandbox', '--disable-dev-shm-usage'],
        }
      : undefined,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'portrait', use: { ...devices['Pixel 7'] } },
    { name: 'landscape', use: { ...devices['Pixel 7 landscape'] } },
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
