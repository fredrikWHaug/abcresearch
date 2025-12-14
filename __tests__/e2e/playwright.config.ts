import { defineConfig, devices } from '@playwright/test'

// Test credentials for E2E tests (safe to commit - this is a test account)
process.env.TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || 'e2e@test.com'
process.env.TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || 'abcresearch'

/**
 * Playwright configuration for E2E tests
 * See https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './',

  // Output directories (centralized in __tests__/output/)
  outputDir: '../output/test-results',

  // Run tests in files in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Use single worker to match CI behavior and avoid overwhelming vercel dev
  workers: 1,

  // Reporter to use - output HTML report to centralized location
  reporter: [['html', { outputFolder: '../output/playwright-report' }]],

  // Increase test timeout for long-running operations (search takes ~60s, slide generation ~15s)
  timeout: 180000, // 3 minutes per test

  // Shared settings for all the projects below
  use: {
    // Base URL to use in actions like `await page.goto('/')`
    // Use port 3000 for Vercel dev (instead of 5173 for Vite)
    baseURL: 'http://localhost:3000',

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // CRITICAL: Ensure fresh browser state for each test (no cached sessions)
    // This prevents locally cached Supabase sessions from affecting tests
    storageState: undefined,
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Fresh browser state to match CI behavior
        launchOptions: {
          args: ['--incognito', '--disable-extensions', '--no-first-run'],
        },
        storageState: { cookies: [], origins: [] },
      },
    },
  ],

  // Run your local dev server before starting the tests
  // In CI, vercel dev is started manually (supports API routes)
  // Locally, use vite directly (faster, more reliable - API routes won't work)
  // Full E2E with API routes runs in CI
  webServer: process.env.CI
    ? undefined
    : {
        command: 'npm run dev -- --port 3000',
        port: 3000,
        reuseExistingServer: true,
        timeout: 60000,
      },
})
