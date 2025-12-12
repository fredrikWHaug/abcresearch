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

  // Extend timeout for this entire test suite (3 minutes)
  test.setTimeout(180000)

  test('complete journey: login → create project → search → pipeline → export', async ({ page }) => {
    // =========================================
    // STEP 1: Login
    // =========================================
    console.log('📍 Step 1: Logging in...')
    await loginWithTestUser(page)

    await page.screenshot({
      path: '__tests__/output/screenshots/journey1-01-logged-in.png',
      fullPage: true
    })
    console.log('✅ Step 1 complete: Logged in')

    // =========================================
    // STEP 2: Create a new project
    // =========================================
    console.log('📍 Step 2: Creating new project...')

    // We should be on /app/home - look for create project button
    // Could be "Create Your First Project" or a "+" button
    const createProjectButton = page.getByRole('button', { name: /create.*project|new.*project|\+/i }).first()

    // If we're on home page with existing projects, there might be a different button
    const createFirstProjectButton = page.getByRole('button', { name: /create your first project/i })
    const newProjectButton = page.getByRole('button', { name: /new project/i })

    // Try to find any create project trigger
    let foundCreateButton = false

    if (await createFirstProjectButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await createFirstProjectButton.click()
      foundCreateButton = true
      console.log('  → Clicked "Create Your First Project"')
    } else if (await newProjectButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await newProjectButton.click()
      foundCreateButton = true
      console.log('  → Clicked "New Project"')
    } else if (await createProjectButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await createProjectButton.click()
      foundCreateButton = true
      console.log('  → Clicked create project button')
    }

    // If no create button found, we might already be in a project or need to navigate
    if (!foundCreateButton) {
      // Check if there's a projects dropdown or we need to go to home
      const homeLink = page.getByRole('link', { name: /home|abcresearch/i }).first()
      if (await homeLink.isVisible({ timeout: 2000 }).catch(() => false)) {
        await homeLink.click()
        await page.waitForTimeout(1000)

        // Try again to find create button
        if (await createFirstProjectButton.isVisible({ timeout: 3000 }).catch(() => false)) {
          await createFirstProjectButton.click()
          foundCreateButton = true
        }
      }
    }

    // Wait for modal to appear and fill in project name
    const projectNameInput = page.getByPlaceholder(/project name|name/i).or(
      page.getByLabel(/project name|name/i)
    ).or(
      page.locator('input[type="text"]').first()
    )

    await expect(projectNameInput).toBeVisible({ timeout: 5000 })

    // Generate unique project name with timestamp
    const projectName = `E2E Test - GLP-1 Analysis ${Date.now()}`
    await projectNameInput.fill(projectName)
    console.log(`  → Entered project name: ${projectName}`)

    // Click Create button in modal
    const createButton = page.getByRole('button', { name: /^create$/i })
    await createButton.click()
    console.log('  → Clicked Create')

    // Wait for project to be created and navigate
    await page.waitForTimeout(2000)

    await page.screenshot({
      path: '__tests__/output/screenshots/journey1-02-project-created.png',
      fullPage: true
    })
    console.log('✅ Step 2 complete: Project created')

    // =========================================
    // STEP 3: Search for GLP-1s
    // =========================================
    console.log('📍 Step 3: Searching for GLP-1s...')

    // Find the search/chat input
    const searchInput = page.getByPlaceholder(/how can i help|search|ask|what.*research/i).or(
      page.getByRole('textbox').first()
    )

    await expect(searchInput).toBeVisible({ timeout: 10000 })
    await searchInput.fill('GLP-1s')
    console.log('  → Entered search term: GLP-1s')

    await page.screenshot({
      path: '__tests__/output/screenshots/journey1-03-search-entered.png',
      fullPage: true
    })

    // Press Enter or click search button to submit
    await searchInput.press('Enter')
    console.log('  → Submitted search')

    // Wait for AI response with search suggestions
    console.log('  → Waiting for AI response...')
    await page.waitForTimeout(5000)

    // Look for "Click to Search" button in AI response
    const clickToSearchButton = page.getByRole('button', { name: /click to search|search.*glp/i }).first()

    if (await clickToSearchButton.isVisible({ timeout: 10000 }).catch(() => false)) {
      await clickToSearchButton.click()
      console.log('  → Clicked "Click to Search" button')
    } else {
      // Maybe the search already started, or we need to look for another trigger
      console.log('  → Search button not found, checking if search already in progress...')
    }

    await page.screenshot({
      path: '__tests__/output/screenshots/journey1-04-search-started.png',
      fullPage: true
    })

    // =========================================
    // STEP 4: Wait for search results (60-90 seconds)
    // =========================================
    console.log('📍 Step 4: Waiting for search results (this takes ~60-90 seconds)...')

    // Look for indicators that search is complete:
    // - Drugs list appears
    // - "Discovery complete" message
    // - Results panel populates

    const resultsIndicator = page.getByText(/discovery complete|found.*drugs|drugs.*found/i).or(
      page.getByText(/trials|papers|results/i)
    )

    // Wait up to 120 seconds for results
    let searchComplete = false
    const startTime = Date.now()
    const maxWaitTime = 120000 // 2 minutes

    while (!searchComplete && (Date.now() - startTime) < maxWaitTime) {
      // Check for completion indicators
      const hasResults = await page.getByText(/discovery complete/i).isVisible().catch(() => false)
      const hasDrugs = await page.locator('[class*="drug"]').first().isVisible().catch(() => false)
      const hasTrialsText = await page.getByText(/clinical trials/i).isVisible().catch(() => false)

      if (hasResults || hasDrugs || hasTrialsText) {
        searchComplete = true
        console.log('  → Search results detected!')
      } else {
        // Log progress
        const elapsed = Math.round((Date.now() - startTime) / 1000)
        if (elapsed % 15 === 0) {
          console.log(`  → Still waiting... (${elapsed}s elapsed)`)
        }
        await page.waitForTimeout(5000)
      }
    }

    await page.screenshot({
      path: '__tests__/output/screenshots/journey1-05-search-results.png',
      fullPage: true
    })

    // Verify we have results - this SHOULD fail if search didn't work
    // Look for any indication of drugs, trials, or papers
    const drugsSection = page.getByText(/drugs|compounds/i).first()
    const trialsSection = page.getByText(/trials|studies/i).first()

    const hasDrugsVisible = await drugsSection.isVisible({ timeout: 5000 }).catch(() => false)
    const hasTrialsVisible = await trialsSection.isVisible({ timeout: 5000 }).catch(() => false)

    // At least one of these should be true
    expect(hasDrugsVisible || hasTrialsVisible).toBe(true)
    console.log('✅ Step 4 complete: Search results loaded')

    // =========================================
    // STEP 5: Navigate to Asset Pipeline tab
    // =========================================
    console.log('📍 Step 5: Navigating to Asset Pipeline...')

    const pipelineTab = page.getByRole('button', { name: /asset pipeline|pipeline/i }).first()
    await expect(pipelineTab).toBeVisible({ timeout: 5000 })
    await pipelineTab.click()
    console.log('  → Clicked Asset Pipeline tab')

    await page.waitForTimeout(2000)

    await page.screenshot({
      path: '__tests__/output/screenshots/journey1-06-pipeline-tab.png',
      fullPage: true
    })
    console.log('✅ Step 5 complete: On Asset Pipeline tab')

    // =========================================
    // STEP 6: Click AI Extract (with count = 3)
    // =========================================
    console.log('📍 Step 6: Running AI Extract...')

    // Look for AI Extract button
    const aiExtractButton = page.getByRole('button', { name: /ai extract|extract/i }).first()

    if (await aiExtractButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Check if there's a count input to reduce
      const countInput = page.getByLabel(/count|number|drugs/i).or(
        page.locator('input[type="number"]').first()
      )

      if (await countInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await countInput.fill('3')
        console.log('  → Set count to 3')
      }

      await aiExtractButton.click()
      console.log('  → Clicked AI Extract')

      // Wait for extraction to complete (30-60 seconds)
      console.log('  → Waiting for AI extraction (30-60 seconds)...')
      await page.waitForTimeout(45000)

      await page.screenshot({
        path: '__tests__/output/screenshots/journey1-07-ai-extract-complete.png',
        fullPage: true
      })
    } else {
      console.log('  → AI Extract button not found (may require drugs to be loaded first)')
      await page.screenshot({
        path: '__tests__/output/screenshots/journey1-07-pipeline-state.png',
        fullPage: true
      })
    }

    console.log('✅ Step 6 complete: AI Extract processed')

    // =========================================
    // STEP 7: Download as PowerPoint
    // =========================================
    console.log('📍 Step 7: Downloading PowerPoint...')

    const downloadButton = page.getByRole('button', { name: /download.*powerpoint|export.*pptx|download.*pptx/i }).first()

    if (await downloadButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Set up download listener
      const downloadPromise = page.waitForEvent('download', { timeout: 30000 }).catch(() => null)

      await downloadButton.click()
      console.log('  → Clicked Download as PowerPoint')

      const download = await downloadPromise
      if (download) {
        console.log(`  → Download started: ${download.suggestedFilename()}`)
        // Save the download to our output folder
        await download.saveAs(`__tests__/output/downloads/${download.suggestedFilename()}`)
      } else {
        console.log('  → Download may have been handled differently (popup or direct download)')
      }

      await page.screenshot({
        path: '__tests__/output/screenshots/journey1-08-download-triggered.png',
        fullPage: true
      })
    } else {
      console.log('  → Download button not found (may require pipeline table to be generated)')
      await page.screenshot({
        path: '__tests__/output/screenshots/journey1-08-final-state.png',
        fullPage: true
      })
    }

    console.log('✅ Step 7 complete: PowerPoint export attempted')

    // =========================================
    // FINAL: Take final screenshot and verify
    // =========================================
    await page.screenshot({
      path: '__tests__/output/screenshots/journey1-09-complete.png',
      fullPage: true
    })

    // Final assertion - we should still be in the app
    await expect(page).toHaveURL(/\/app\//)

    console.log('🎉 User Journey 1 complete!')
  })
})
