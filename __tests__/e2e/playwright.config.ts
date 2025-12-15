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

  // Increase test timeout for long-running operations (search can take 2-3 minutes)
  timeout: 300000, // 5 minutes per test

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
  // Runs both Vite (frontend on :3000) and Vercel dev (API routes on :3001)
  // Vite proxies /api/* requests to Vercel dev for real API calls
  // Now runs in BOTH local and CI environments for consistent behavior
  webServer: {
    command: 'npm run dev:e2e',
    port: 3000,
    reuseExistingServer: !process.env.CI, // Fresh servers in CI, reuse locally
    timeout: 120000, // Increased timeout for both servers to start
  },
})
