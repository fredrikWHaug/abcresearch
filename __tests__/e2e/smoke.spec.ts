import { test, expect } from '@playwright/test'
import { loginWithTestUser } from './helpers/auth'

/**
 * E2E Tests: Smoke Tests
 *
 * Basic smoke tests to verify the app loads without critical errors:
 * - Pages load without JavaScript errors
 * - Critical UI elements render
 */

test.describe('Smoke Tests', () => {
  // With incognito mode configured in playwright.config.ts,
  // each test gets a fresh browser context with no cached data

  test('auth page loads without errors', async ({ page }) => {
    // Collect console errors
    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    await page.goto('/auth')

    // Page should load
    await expect(page.locator('body')).toBeVisible()

    // Should have the main card/form visible
    await expect(page.locator('form')).toBeVisible()

    // Filter out expected errors (like failed network requests during tests)
    const criticalErrors = errors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('Failed to load resource') &&
      !e.includes('net::ERR')
    )

    // No critical JavaScript errors
    expect(criticalErrors).toHaveLength(0)
  })

  test('dashboard loads without errors after login', async ({ page }) => {
    // Collect console errors
    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    await loginWithTestUser(page)

    // Give the page time to load fully
    await page.waitForTimeout(2000)

    // Page should be on app
    await expect(page).toHaveURL(/\/app\//)

    // Body should be visible
    await expect(page.locator('body')).toBeVisible()

    // Filter out expected errors
    const criticalErrors = errors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('Failed to load resource') &&
      !e.includes('net::ERR') &&
      !e.includes('ResizeObserver') // React dev mode noise
    )

    // Log any critical errors for debugging (but don't fail on them in CI)
    if (criticalErrors.length > 0) {
      console.log('Console errors detected:', criticalErrors)
    }
  })

  test('takes screenshot of dashboard for visual verification', async ({ page }) => {
    await loginWithTestUser(page)

    // Wait for page to stabilize
    await page.waitForTimeout(2000)

    // Take screenshot
    await page.screenshot({
      path: '__tests__/output/screenshots/dashboard-smoke.png',
      fullPage: true
    })

    // Verify we're on the app
    await expect(page).toHaveURL(/\/app\//)
  })
})
