import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: process.env.THH_E2E_BASE_URL || 'http://127.0.0.1:3000',
    launchOptions: process.env.THH_PLAYWRIGHT_CHROMIUM
      ? { executablePath: process.env.THH_PLAYWRIGHT_CHROMIUM }
      : undefined,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
  // A protected preview can be tested by setting THH_E2E_BASE_URL; no credentials
  // are embedded in source or copied into Playwright artifacts.
});
