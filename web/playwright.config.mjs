import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.PORT || 3100);

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  fullyParallel: true,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${port}`, trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'mobile', use: { ...devices['Pixel 5'], viewport: { width: 360, height: 740 } } },
  ],
  // The UI kit page is hidden unless ENABLE_UI_KIT=1; the test server enables it explicitly.
  webServer: {
    command: `ENABLE_UI_KIT=1 npx next dev -p ${port}`,
    url: `http://localhost:${port}/ui-kit`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
