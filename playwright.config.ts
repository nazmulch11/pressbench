import { defineConfig, devices } from '@playwright/test';

const isCI = Boolean(process.env.CI);

// Some sandboxes ship a pre-installed Chromium instead of Playwright's download, without ffmpeg for video.
// There: PW_CHROMIUM_EXECUTABLE=<path to chrome> PW_NO_VIDEO=1. Leave both unset everywhere else.
const chromiumExecutable = process.env.PW_CHROMIUM_EXECUTABLE;
const recordVideo = !process.env.PW_NO_VIDEO;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  // Retries hide flaky tests. We repeat instead (npm run test:e2e:repeat) and treat any failure as real.
  retries: 0,
  // WordPress Playground cold boot is slow; Phase 1 measures and may tune this.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: isCI
    ? [['list'], ['html', { open: 'never' }], ['github']]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: recordVideo ? 'retain-on-failure' : 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(chromiumExecutable ? { launchOptions: { executablePath: chromiumExecutable } } : {}),
      },
    },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    // Always build and serve fresh, so tests never run against an old build left running.
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
