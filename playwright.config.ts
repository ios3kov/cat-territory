import { defineConfig, devices } from '@playwright/test';
const externalBaseURL=process.env.PLAYWRIGHT_BASE_URL;const localBaseURL='http://127.0.0.1:4173';
export default defineConfig({testDir:'./e2e',fullyParallel:false,retries:process.env.CI?1:0,reporter:'list',use:{baseURL:externalBaseURL??localBaseURL,trace:'on-first-retry'},webServer:externalBaseURL?undefined:{command:'npm run dev -- --host 127.0.0.1 --port 4173',url:localBaseURL,reuseExistingServer:!process.env.CI},projects:[{name:'chromium',use:{...devices['Desktop Chrome']}}]});
