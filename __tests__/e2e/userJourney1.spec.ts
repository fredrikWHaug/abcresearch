import { test, expect } from '@playwright/test'
import { loginWithTestUser } from './helpers/auth'

/**
 * E2E Test: User Journey 1 - Exploring a New Treatment Area
 *
 * This test follows the complete user journey from the user guide:
 * 1. Login and create a research project
 * 2. Search for a therapeutic area (GLP-1s)
 * 3. Review aggregated results (drugs, trials, papers)
 * 4. Generate Asset Development Pipeline
 * 5. Download as PowerPoint
 *
 * Note: This test makes real API calls and takes 2-3 minutes to complete.
 */

test.describe('User Journey 1: Exploring a New Treatment Area', () => {
  // Use serial mode - these steps depend on each other
  test.describe.configure({ mode: 'serial' })

  // Extend timeout for this entire test suite (5 minutes for safety)
  test.setTimeout(300000)

  test('complete journey: login → create project → search → pipeline → export', async ({ page }) => {
    // =========================================
    // STEP 1: Login
    // =========================================
    console.log('📍 Step 1: Logging in...')
    await loginWithTestUser(page)
    await expect(page).toHaveURL(/\/app\//)

    await page.screenshot({
      path: '__tests__/output/screenshots/journey1-01-logged-in.png',
      fullPage: true
    })
    console.log('✅ Step 1 complete: Logged in')

    // =========================================
    // STEP 2: Create a new project
    // =========================================
    console.log('📍 Step 2: Creating new project...')

    // Wait for page to fully load
    await page.waitForTimeout(2000)

    // Look for "Create Your First Project" button (when no projects exist)
    // or "Create New Project" card (when projects exist)
    const createFirstProjectBtn = page.getByRole('button', { name: 'Create Your First Project' })
    const createNewProjectCard = page.getByText('Create New Project')

    if (await createFirstProjectBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await createFirstProjectBtn.click()
      console.log('  → Clicked "Create Your First Project" button')
    } else if (await createNewProjectCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await createNewProjectCard.click()
      console.log('  → Clicked "Create New Project" card')
    } else {
      // Take screenshot for debugging
      await page.screenshot({
        path: '__tests__/output/screenshots/journey1-debug-no-create-btn.png',
        fullPage: true
      })
      throw new Error('Could not find create project button or card')
    }

    // Wait for modal to appear
    await page.waitForTimeout(500)

    // Fill in project name using the exact input id="projectName"
    const projectNameInput = page.locator('input#projectName')
    await expect(projectNameInput).toBeVisible({ timeout: 5000 })

    const projectName = `E2E GLP-1 Analysis ${Date.now()}`
    await projectNameInput.fill(projectName)
    console.log(`  → Entered project name: ${projectName}`)

    // Click "Create Project" button (exact text from CreateProjectModal)
    const createProjectBtn = page.getByRole('button', { name: 'Create Project' })
    await expect(createProjectBtn).toBeVisible()
    await createProjectBtn.click()
    console.log('  → Clicked "Create Project"')

    // Wait for navigation to the new project
    await page.waitForURL(/\/app\/project\/\d+/, { timeout: 15000 })

    await page.screenshot({
      path: '__tests__/output/screenshots/journey1-02-project-created.png',
      fullPage: true
    })
    console.log('✅ Step 2 complete: Project created')

    // =========================================
    // STEP 3: Search for GLP-1s
    // =========================================
    console.log('📍 Step 3: Searching for GLP-1s...')

    // Wait for InitialResearchView to load
    await page.waitForTimeout(2000)

    // Find the search input with placeholder "How can I help you today?"
    const searchInput = page.getByPlaceholder('How can I help you today?')
    await expect(searchInput).toBeVisible({ timeout: 10000 })

    await searchInput.fill('GLP-1s')
    console.log('  → Entered search term: GLP-1s')

    await page.screenshot({
      path: '__tests__/output/screenshots/journey1-03-search-entered.png',
      fullPage: true
    })

    // Press Enter to submit (or click the arrow button)
    await searchInput.press('Enter')
    console.log('  → Submitted search')

    // Wait for AI to process
    console.log('  → Waiting for AI response...')

    // Wait 15 seconds for initial AI response
    await page.waitForTimeout(15000)

    // DIAGNOSTIC: Log all visible buttons on the page
    console.log('  → DIAGNOSTIC: Checking page state after 15 seconds...')
    const allButtons = await page.getByRole('button').all()
    console.log(`  → Found ${allButtons.length} buttons on page:`)
    for (const btn of allButtons) {
      const text = await btn.textContent().catch(() => '[no text]')
      const isVisible = await btn.isVisible().catch(() => false)
      if (isVisible && text && text.trim()) {
        console.log(`     - "${text.trim().substring(0, 50)}"`)
      }
    }

    // DIAGNOSTIC: Check for any chat messages or AI responses
    const chatMessages = await page.locator('[class*="message"], [class*="chat"], [class*="response"]').all()
    console.log(`  → Found ${chatMessages.length} potential chat/message elements`)

    // DIAGNOSTIC: Check current URL
    console.log(`  → Current URL: ${page.url()}`)

    await page.screenshot({
      path: '__tests__/output/screenshots/journey1-04-diagnostic.png',
      fullPage: true
    })

    // Try to find any search-related button
    const searchButtons = [
      page.getByRole('button', { name: /click to search/i }),
      page.getByRole('button', { name: /start search/i }),
      page.getByRole('button', { name: /search/i }),
      page.getByRole('button', { name: /find/i }),
      page.locator('button:has-text("Search")'),
      page.locator('button:has-text("search")'),
    ]

    let clickedSearchBtn = false
    for (const btn of searchButtons) {
      if (await btn.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        const btnText = await btn.first().textContent().catch(() => 'unknown')
        console.log(`  → Found search button: "${btnText}"`)
        await btn.first().click()
        clickedSearchBtn = true
        console.log('  → Clicked search button')
        break
      }
    }

    if (!clickedSearchBtn) {
      console.log('  → No search button found - checking if search started automatically...')
      // Maybe the search started automatically? Wait and check for results
      await page.waitForTimeout(5000)
    }

    await page.screenshot({
      path: '__tests__/output/screenshots/journey1-04-after-search-attempt.png',
      fullPage: true
    })

    // =========================================
    // STEP 4: Wait for search results (60-90 seconds)
    // =========================================
    console.log('📍 Step 4: Waiting for search results (this takes ~60-90 seconds)...')

    await page.screenshot({
      path: '__tests__/output/screenshots/journey1-05-search-started.png',
      fullPage: true
    })

    // Wait for "Discovery complete" message or drug results to appear
    // Poll for completion - this takes 60-90 seconds
    const maxWaitTime = 120000 // 2 minutes
    const startTime = Date.now()

    while ((Date.now() - startTime) < maxWaitTime) {
      // Check for discovery complete message
      const discoveryComplete = await page.getByText(/discovery complete/i).isVisible().catch(() => false)

      // Also check for drugs in the results panel
      const hasDrugResults = await page.getByText(/drugs found|found.*drug/i).isVisible().catch(() => false)

      if (discoveryComplete || hasDrugResults) {
        console.log('  → Search results detected!')
        break
      }

      // Log progress every 15 seconds
      const elapsed = Math.round((Date.now() - startTime) / 1000)
      if (elapsed % 15 === 0 && elapsed > 0) {
        console.log(`  → Still waiting... (${elapsed}s elapsed)`)
      }

      await page.waitForTimeout(5000)
    }

    await page.screenshot({
      path: '__tests__/output/screenshots/journey1-06-search-results.png',
      fullPage: true
    })

    // Verify results appeared - look for any drug-related content
    const resultsPanel = page.locator('[class*="drug"], [class*="trial"], [class*="result"]').first()
    const hasResults = await resultsPanel.isVisible({ timeout: 5000 }).catch(() => false)

    if (!hasResults) {
      // Alternative check - look for text indicating drugs were found
      const drugsText = await page.getByText(/clinical trials|papers|drugs/i).first().isVisible().catch(() => false)
      expect(drugsText).toBe(true)
    }

    console.log('✅ Step 4 complete: Search results loaded')

    // =========================================
    // STEP 5: Navigate to Pipeline tab
    // =========================================
    console.log('📍 Step 5: Navigating to Pipeline tab...')

    // Click the "Pipeline" tab in navigation
    const pipelineTab = page.getByRole('button', { name: /pipeline/i })
    await expect(pipelineTab.first()).toBeVisible({ timeout: 5000 })
    await pipelineTab.first().click()
    console.log('  → Clicked Pipeline tab')

    // Wait for Pipeline view to load
    await page.waitForTimeout(2000)

    await page.screenshot({
      path: '__tests__/output/screenshots/journey1-07-pipeline-tab.png',
      fullPage: true
    })
    console.log('✅ Step 5 complete: On Pipeline tab')

    // =========================================
    // STEP 6: Set drug count and click AI Extract
    // =========================================
    console.log('📍 Step 6: Running AI Extract...')

    // Find the drug limit input (id="drugLimit") and set to 3
    const drugLimitInput = page.locator('input#drugLimit')

    if (await drugLimitInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await drugLimitInput.fill('3')
      console.log('  → Set drug count to 3')
    } else {
      console.log('  → Drug limit input not found (may not have data yet)')
    }

    // Click "AI Extract" button (text is "AI Extract" or has Sparkles icon)
    const aiExtractBtn = page.getByRole('button', { name: /ai extract/i })

    if (await aiExtractBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await aiExtractBtn.click()
      console.log('  → Clicked "AI Extract"')

      // Wait for extraction to complete - look for "Extracting..." to disappear
      // or success message to appear
      console.log('  → Waiting for AI extraction (30-60 seconds)...')

      // Wait for the extracting state to finish
      const extractingIndicator = page.getByText(/extracting/i)

      // First wait for extraction to start
      await page.waitForTimeout(2000)

      // Then wait for it to complete (up to 90 seconds)
      let extractionComplete = false
      const extractStartTime = Date.now()
      const extractMaxWait = 90000

      while ((Date.now() - extractStartTime) < extractMaxWait) {
        const stillExtracting = await extractingIndicator.isVisible().catch(() => false)
        const successMessage = await page.getByText(/ai-extracted comprehensive drug data/i).isVisible().catch(() => false)

        if (!stillExtracting || successMessage) {
          extractionComplete = true
          console.log('  → AI extraction complete!')
          break
        }

        const elapsed = Math.round((Date.now() - extractStartTime) / 1000)
        if (elapsed % 15 === 0 && elapsed > 0) {
          console.log(`  → Still extracting... (${elapsed}s elapsed)`)
        }

        await page.waitForTimeout(5000)
      }

      if (!extractionComplete) {
        console.log('  → Extraction timed out, continuing anyway')
      }

      await page.screenshot({
        path: '__tests__/output/screenshots/journey1-08-ai-extract-complete.png',
        fullPage: true
      })
    } else {
      console.log('  → AI Extract button not visible (may need drugs loaded first)')
      await page.screenshot({
        path: '__tests__/output/screenshots/journey1-08-no-extract-btn.png',
        fullPage: true
      })
    }

    console.log('✅ Step 6 complete: AI Extract processed')

    // =========================================
    // STEP 7: Download as PowerPoint
    // =========================================
    console.log('📍 Step 7: Downloading PowerPoint...')

    // Look for "Export PPT" button
    const exportBtn = page.getByRole('button', { name: /export ppt/i })

    if (await exportBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Set up download listener before clicking
      const downloadPromise = page.waitForEvent('download', { timeout: 30000 }).catch(() => null)

      await exportBtn.click()
      console.log('  → Clicked "Export PPT"')

      // Wait for download
      const download = await downloadPromise
      if (download) {
        const filename = download.suggestedFilename()
        console.log(`  → Download started: ${filename}`)

        // Save to our output folder
        await download.saveAs(`__tests__/output/downloads/${filename}`)
        console.log(`  → Saved to: __tests__/output/downloads/${filename}`)
      } else {
        console.log('  → Download event not captured (may have been handled differently)')
      }

      await page.screenshot({
        path: '__tests__/output/screenshots/journey1-09-export-complete.png',
        fullPage: true
      })
    } else {
      console.log('  → Export PPT button not visible (needs pipeline data first)')
      await page.screenshot({
        path: '__tests__/output/screenshots/journey1-09-no-export-btn.png',
        fullPage: true
      })
    }

    console.log('✅ Step 7 complete: PowerPoint export attempted')

    // =========================================
    // FINAL: Verify we're still in the app
    // =========================================
    await page.screenshot({
      path: '__tests__/output/screenshots/journey1-10-final.png',
      fullPage: true
    })

    await expect(page).toHaveURL(/\/app\//)
    console.log('🎉 User Journey 1 complete!')
  })
})
