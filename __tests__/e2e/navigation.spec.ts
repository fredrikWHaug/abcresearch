import { test, expect } from '@playwright/test'
import { loginWithTestUser } from './helpers/auth'

/**
 * E2E Tests: Navigation
 *
 * These tests verify navigation functionality after login:
 * - Dashboard loads after login
 * - Navigation elements are present
 * - Tab navigation works
 */

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await loginWithTestUser(page)
  })

  test('dashboard loads after login', async ({ page }) => {
    // Verify we're on the app
    await expect(page).toHaveURL(/\/app\//)

    // Page should have loaded (body should be visible)
    await expect(page.locator('body')).toBeVisible()
  })

  test('logo/brand is visible', async ({ page }) => {
    // The ABCresearch logo/brand should be visible
    const logo = page.getByText('ABCresearch')
    await expect(logo.first()).toBeVisible()
  })

  test('can navigate to a project and see navigation tabs', async ({ page }) => {
    // First, we need to get to a project page
    // Check if we're on home or already on a project
    const currentUrl = page.url()

    if (currentUrl.includes('/app/home')) {
      // We're on home - check if there are any projects to click
      // If no projects exist, this test should be skipped or we create one
      const projectLink = page.locator('a[href*="/app/project/"]').first()
      const hasProject = await projectLink.isVisible({ timeout: 5000 }).catch(() => false)

      if (!hasProject) {
        // No projects exist - skip this test
        test.skip()
        return
      }

      await projectLink.click()
      await page.waitForURL(/\/app\/project\//)
    }

    // Now we should be on a project page - verify nav tabs exist
    const researchTab = page.getByRole('button', { name: /research/i })
    const pipelineTab = page.getByRole('button', { name: /pipeline/i })
    const marketMapTab = page.getByRole('button', { name: /market map/i })

    // At least one of these should be visible (they may be in different containers)
    const hasResearch = await researchTab.first().isVisible({ timeout: 5000 }).catch(() => false)
    const hasPipeline = await pipelineTab.first().isVisible({ timeout: 5000 }).catch(() => false)
    const hasMarketMap = await marketMapTab.first().isVisible({ timeout: 5000 }).catch(() => false)

    expect(hasResearch || hasPipeline || hasMarketMap).toBe(true)
  })
})
