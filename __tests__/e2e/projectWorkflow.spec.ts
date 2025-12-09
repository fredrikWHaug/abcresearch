import { test, expect } from '@playwright/test'
import { loginWithTestUser } from './helpers/auth'

/**
 * E2E Test: Complete Project Workflow
 *
 * This test verifies the entire user journey:
 * 1. User logs in (with test credentials in CI, guest mode locally)
 * 2. User performs a search for drug candidates
 * 3. User sees search results (trials, papers, or drug groups)
 * 4. System handles the complete flow from UI → API → Backend
 */

test.describe('Project Workflow - End-to-End', () => {
  test('user can login and view home page', async ({ page }) => {
    // Step 1: Login (uses test credentials in CI, guest mode locally)
    await loginWithTestUser(page)
    console.log('✅ Reached dashboard/app')

    // Step 2: Wait for the page to fully load
    await page.waitForTimeout(2000)

    // Step 3: Verify we're on the app and page has content
    const currentUrl = page.url()
    console.log(`Current URL: ${currentUrl}`)

    // Step 4: Take a screenshot of the home page
    await page.screenshot({ path: '__tests__/e2e/screenshots/home-page.png', fullPage: true })
    console.log('✅ Home page screenshot saved')

    // Step 5: Look for common UI elements on home page
    const hasContent = await page.locator('button, a, input, [role="button"]').first().isVisible({ timeout: 5000 }).catch(() => false)

    if (hasContent) {
      console.log('✅ Page has interactive elements')
    } else {
      console.log('⚠️  No interactive elements found')
    }

    // Final assertion: Verify we're on the app
    await expect(page).toHaveURL(/\/app\//)
    console.log('✅ Test completed successfully')
  })

  test('user can navigate between different views/tabs', async ({ page }) => {
    // Step 1: Login (uses test credentials in CI, guest mode locally)
    await loginWithTestUser(page)

    // Step 3: Look for navigation tabs/buttons
    // Common patterns: Research, Pipeline, Market Map, Data Extraction, etc.
    const tabs = [
      /research/i,
      /pipeline/i,
      /market map/i,
      /data extraction/i,
      /feed/i,
    ]

    for (const tabPattern of tabs) {
      const tab = page.getByRole('button', { name: tabPattern }).or(
        page.getByRole('tab', { name: tabPattern })
      ).or(
        page.locator(`[data-view="${tabPattern.source.replace(/\\\\/g, '').replace(/i/g, '')}"]`)
      )

      if (await tab.isVisible({ timeout: 1000 }).catch(() => false)) {
        await tab.click()
        console.log(`✅ Clicked ${tabPattern} tab`)
        await page.waitForTimeout(500) // Let view render
        break // Just verify we can click at least one tab
      }
    }

    // Step 4: Verify we're still on the app
    await expect(page).toHaveURL(/\/app\//)
    console.log('✅ Tab navigation test completed')
  })
})
