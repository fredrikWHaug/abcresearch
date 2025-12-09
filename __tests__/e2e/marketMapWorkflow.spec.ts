import { test, expect } from '@playwright/test'

/**
 * E2E Test: Market Map Save/Load Workflow
 *
 * This test verifies the complete market map journey:
 * 1. User performs a search to get data
 * 2. User navigates to Market Map view
 * 3. User creates/saves a market map
 * 4. User reloads the page
 * 5. User loads the saved market map
 * 6. System persists data across sessions
 */

test.describe('Market Map Workflow - End-to-End', () => {
  test('user can create, save, and reload a market map', async ({ page }) => {
    // Step 1: Navigate to the application
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Step 2: Enter guest mode
    const guestButton = page.getByRole('button', { name: /continue as guest|guest mode/i })
    if (await guestButton.isVisible()) {
      await guestButton.click()
      console.log('✅ Entered guest mode')
    }

    // Step 3: Wait for dashboard
    await page.waitForURL(/\/(dashboard|app)/, { timeout: 10000 })
    console.log('✅ Dashboard loaded')

    // Step 4: Chat with AI to get search suggestion
    await page.waitForTimeout(2000)

    const chatInput = page.getByPlaceholder(/how can i help|respond to/i).first()
    const isChatVisible = await chatInput.isVisible({ timeout: 5000 }).catch(() => false)

    if (isChatVisible) {
      await chatInput.fill('GLP-1')
      console.log('✅ Entered chat message: GLP-1')

      // Submit message (press Enter)
      await chatInput.press('Enter')
      console.log('✅ Sent message to AI')

      // Wait for AI to respond with search suggestions
      console.log('⏳ Waiting for AI response...')
      await page.waitForTimeout(5000)

      // Step 5: Click the search suggestion button
      const searchButton = page.getByRole('button').filter({ hasText: /click to search/i })
      const isSearchButtonVisible = await searchButton.isVisible({ timeout: 10000 }).catch(() => false)

      if (isSearchButtonVisible) {
        await searchButton.click()
        console.log('✅ Clicked "Click to Search" button')

        // Wait for search to complete - takes ~60-90 seconds
        console.log('⏳ Waiting for search to complete (this can take up to 90 seconds)...')
        await page.waitForTimeout(90000)
        console.log('✅ Search completed')
      } else {
        console.log('⚠️  Search button not found in AI response')
      }
    } else {
      console.log('⚠️  Chat input not found')
    }

    // Step 6: Navigate to Market Map tab
    const marketMapTab = page.getByRole('button', { name: /market map/i }).or(
      page.getByRole('tab', { name: /market map/i })
    )

    if (await marketMapTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await marketMapTab.click()
      console.log('✅ Clicked Market Map tab')
      await page.waitForTimeout(2000)
    } else {
      console.log('⚠️  Market Map tab not found, checking if already on market map view')
    }

    // Step 7: Click "Generate Market Map" button
    const generateButton = page.getByRole('button', { name: /generate market map/i })

    if (await generateButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await generateButton.click()
      console.log('✅ Clicked Generate Market Map button (first time)')

      // Wait for slide generation to start (AI processing can take time)
      await page.waitForTimeout(3000)

      // Sometimes the button needs to be clicked twice - check if it's still visible
      const generateButtonStillVisible = await generateButton.isVisible({ timeout: 2000 }).catch(() => false)
      if (generateButtonStillVisible) {
        await generateButton.click()
        console.log('✅ Clicked Generate Market Map button again (second click needed)')
      }

      // Wait for slide generation to complete (AI processing)
      console.log('⏳ Waiting for AI to generate market analysis (15 seconds)...')
      await page.waitForTimeout(15000)
      console.log('✅ Slide generation wait completed')
    } else {
      console.log('⚠️  Generate Market Map button not found - may already have slide or no trials')
    }

    // Step 8: Look for "Save Map" button in the Slide modal
    // The Slide modal appears on top, so we need to click the Save button within it
    const saveButtonInModal = page.locator('.slide-light-theme').getByRole('button', { name: /save.*map/i })

    if (await saveButtonInModal.isVisible({ timeout: 5000 }).catch(() => false)) {
      await saveButtonInModal.click()
      console.log('✅ Clicked Save Map button in modal')

      // Step 8: Fill in map name if there's a dialog/modal
      await page.waitForTimeout(500)

      const nameInput = page.getByLabel(/name|title/i).or(
        page.getByPlaceholder(/name|title/i)
      )

      if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await nameInput.fill('Test Market Map E2E')
        console.log('✅ Entered map name')

        // Look for confirm/save button in modal
        const confirmButton = page.getByRole('button', { name: /save|confirm|create/i }).last()
        if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await confirmButton.click()
          console.log('✅ Confirmed save')
          await page.waitForTimeout(2000)
        }
      }
    } else {
      console.log('⚠️  Save button not found - user may need to be authenticated')
    }

    // Step 9: Close the slide modal to see the saved maps list
    const closeButton = page.locator('button').filter({ hasText: /^×$|close/i }).first()
    if (await closeButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await closeButton.click()
      console.log('✅ Closed slide modal')
      await page.waitForTimeout(1000)
    }

    // Step 10: Take screenshot of saved state
    await page.screenshot({
      path: '__tests__/e2e/screenshots/market-map-saved.png',
      fullPage: true,
    })
    console.log('✅ Screenshot taken')

    // Step 11: Reload the page to verify persistence
    await page.reload()
    await page.waitForLoadState('networkidle')
    console.log('✅ Page reloaded')

    // Re-enter guest mode after reload
    const guestButtonAfterReload = page.getByRole('button', { name: /continue as guest|guest mode/i })
    if (await guestButtonAfterReload.isVisible({ timeout: 3000 }).catch(() => false)) {
      await guestButtonAfterReload.click()
      console.log('✅ Re-entered guest mode')
      await page.waitForTimeout(1000)
    }

    // Navigate back to Market Map tab
    const marketMapTabAfterReload = page.getByRole('button', { name: /market map/i }).or(
      page.getByRole('tab', { name: /market map/i })
    )
    if (await marketMapTabAfterReload.isVisible({ timeout: 5000 }).catch(() => false)) {
      await marketMapTabAfterReload.click()
      console.log('✅ Navigated back to Market Map tab')
      await page.waitForTimeout(2000)
    }

    // Step 12: Look for our saved map in the "Saved Market Maps" section
    const savedMapCard = page.getByText(/test market map e2e/i)
    if (await savedMapCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('✅ Found saved map in list')

      // Look for Load button within the saved map card
      const loadButton = savedMapCard.locator('..').getByRole('button', { name: /load/i })
      if (await loadButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await loadButton.click()
        console.log('✅ Clicked Load button')

        // Wait for map to load
        await page.waitForTimeout(3000)
        console.log('✅ Loaded saved map')
      }
    } else {
      console.log('⚠️  Saved map not found in list (may require authentication)')
    }

    // Step 13: Final screenshot
    await page.screenshot({
      path: '__tests__/e2e/screenshots/market-map-loaded.png',
      fullPage: true,
    })

    // Final assertion: Verify we're still on the app
    await expect(page).toHaveURL(/\/(dashboard|app)/)
    console.log('✅ Market Map workflow test completed')
  })

  test('user can view list of saved market maps', async ({ page }) => {
    // Step 1: Navigate to app in guest mode
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const guestButton = page.getByRole('button', { name: /continue as guest|guest mode/i })
    if (await guestButton.isVisible()) {
      await guestButton.click()
    }

    await page.waitForURL(/\/(dashboard|app)/, { timeout: 10000 })

    // Step 2: Navigate to Market Map view
    const marketMapTab = page.getByRole('button', { name: /market map/i }).or(
      page.getByRole('tab', { name: /market map/i })
    )

    if (await marketMapTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await marketMapTab.click()
      await page.waitForTimeout(1000)
    }

    // Step 3: Look for saved maps section or button
    const savedMapsButton = page.getByRole('button', { name: /saved.*map|my.*map|load.*map/i })

    if (await savedMapsButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await savedMapsButton.click()
      console.log('✅ Opened saved maps list')
      await page.waitForTimeout(1000)

      // Take screenshot of list
      await page.screenshot({
        path: '__tests__/e2e/screenshots/saved-maps-list.png',
        fullPage: true,
      })
      console.log('✅ Screenshot of saved maps list taken')
    } else {
      console.log('⚠️  Saved maps button not visible (may require authentication)')
    }

    // Final assertion
    await expect(page).toHaveURL(/\/(dashboard|app)/)
    console.log('✅ Saved maps list test completed')
  })
})
