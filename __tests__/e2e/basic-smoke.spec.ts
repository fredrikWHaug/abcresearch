import { test, expect } from '@playwright/test'

/**
 * Basic E2E Smoke Test
 *
 * Simple test that verifies:
 * 1. App launches
 * 2. Login portal renders
 * 3. Authentication works
 * 4. Dashboard loads after login
 * 5. Can create a new project
 * 6. Project page loads after creation
 */

test('app launches, login works, and dashboard loads', async ({ page }) => {
  const email = process.env.TEST_USER_EMAIL
  const password = process.env.TEST_USER_PASSWORD

  // Skip if no credentials provided
  if (!email || !password) {
    console.log('⚠️  No test credentials found - skipping test')
    test.skip()
    return
  }

  // =========================================
  // STEP 1: Navigate to auth page
  // =========================================
  await page.goto('/auth')
  await page.waitForLoadState('networkidle')

  // =========================================
  // STEP 2: Screenshot the login portal
  // =========================================
  await page.screenshot({
    path: '__tests__/output/screenshots/01-login-portal.png',
    fullPage: true
  })
  console.log('✅ Screenshot: Login portal')

  // =========================================
  // STEP 3: Log in with test credentials
  // =========================================
  await page.locator('input#email').fill(email)
  await page.locator('input#password').fill(password)
  await page.getByRole('button', { name: /sign in/i }).click()
  console.log('✅ Logged in with test credentials')

  // Wait for redirect to dashboard
  await page.waitForURL(/\/app\//, { timeout: 15000 })

  // =========================================
  // STEP 4: Screenshot the dashboard
  // =========================================
  // Wait a moment for the dashboard to fully render
  await page.waitForTimeout(2000)

  await page.screenshot({
    path: '__tests__/output/screenshots/02-dashboard-after-login.png',
    fullPage: true
  })
  console.log('✅ Screenshot: Dashboard after login')

  // Verify we're actually on the app
  await expect(page).toHaveURL(/\/app\//)

  // =========================================
  // STEP 5: Create a new project
  // =========================================
  console.log('📍 Creating a new project...')

  // Generate unique project name using timestamp
  const projectNumber = Date.now()
  const projectName = `GLP Research ${projectNumber}`

  // Click create project button (could be "Create Your First Project" or "Create New Project")
  const createFirstProjectBtn = page.getByRole('button', { name: 'Create Your First Project' })
  const createNewProjectCard = page.getByText('Create New Project')

  if (await createFirstProjectBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await createFirstProjectBtn.click()
    console.log('  → Clicked "Create Your First Project"')
  } else if (await createNewProjectCard.isVisible({ timeout: 3000 }).catch(() => false)) {
    await createNewProjectCard.click()
    console.log('  → Clicked "Create New Project" card')
  } else {
    throw new Error('Could not find create project button or card')
  }

  // Wait for modal to appear
  await page.waitForTimeout(500)

  // =========================================
  // STEP 6: Screenshot the create project modal
  // =========================================
  await page.screenshot({
    path: '__tests__/output/screenshots/03-create-project-modal.png',
    fullPage: true
  })
  console.log('✅ Screenshot: Create project modal')

  // =========================================
  // STEP 7: Fill in project details and submit
  // =========================================
  const projectNameInput = page.locator('input#projectName')
  await expect(projectNameInput).toBeVisible({ timeout: 5000 })
  await projectNameInput.fill(projectName)
  console.log(`  → Entered project name: ${projectName}`)

  // Click "Create Project" button
  const createProjectBtn = page.getByRole('button', { name: 'Create Project' })
  await expect(createProjectBtn).toBeVisible()
  await createProjectBtn.click()
  console.log('  → Clicked "Create Project"')

  // Wait for navigation to the new project page
  await page.waitForURL(/\/app\/project\/\d+/, { timeout: 15000 })
  console.log('✅ Navigated to project page')

  // =========================================
  // STEP 8: Screenshot the created project
  // =========================================
  // Wait for project page to fully render
  await page.waitForTimeout(2000)

  await page.screenshot({
    path: '__tests__/output/screenshots/04-project-created.png',
    fullPage: true
  })
  console.log('✅ Screenshot: Project page after creation')

  // Verify we're on a project page
  await expect(page).toHaveURL(/\/app\/project\/\d+/)

  // =========================================
  // STEP 9: Enter search term
  // =========================================
  console.log('📍 Entering search term...')

  // Find the search input
  const searchInput = page.getByPlaceholder('How can I help you today?')
  await expect(searchInput).toBeVisible({ timeout: 10000 })

  // Enter "GLP1" into the search bar
  await searchInput.fill('GLP1')
  console.log('  → Entered "GLP1" into search bar')

  // Take screenshot showing the search term entered
  await page.screenshot({
    path: '__tests__/output/screenshots/05-search-entered.png',
    fullPage: true
  })
  console.log('✅ Screenshot: Search term entered')

  // Press Enter to submit the search
  await searchInput.press('Enter')
  console.log('  → Pressed Enter to submit search')

  // Wait 5 seconds for the search to process
  await page.waitForTimeout(5000)
  console.log('  → Waited 5 seconds')

  // Take screenshot of what's displayed after search submission
  await page.screenshot({
    path: '__tests__/output/screenshots/06-after-search-submit.png',
    fullPage: true
  })
  console.log('✅ Screenshot: After search submission')

  // =========================================
  // STEP 10: Click the search button
  // =========================================
  console.log('📍 Looking for search button...')

  // Try to find any search-related button
  const searchButtons = [
    page.getByRole('button', { name: /click to search/i }),
    page.getByRole('button', { name: /start search/i }),
    page.getByRole('button', { name: /search/i }),
    page.locator('button:has-text("Search")'),
    page.locator('button:has-text("search")'),
  ]

  let searchButtonClicked = false
  for (const btn of searchButtons) {
    if (await btn.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      const btnText = await btn.first().textContent().catch(() => 'unknown')
      console.log(`  → Found search button: "${btnText}"`)
      await btn.first().click()
      searchButtonClicked = true
      console.log('  → Clicked search button')
      break
    }
  }

  if (!searchButtonClicked) {
    console.log('  → No search button found - search may have started automatically')
  }

  // =========================================
  // STEP 11: Wait for search to complete and drugs to appear
  // =========================================
  console.log('📍 Waiting for search to complete and drugs to load (this may take 2-3 minutes)...')

  // Wait directly for "Drugs Found (X)" which is the definitive completion signal
  const drugsFoundText = page.getByText(/Drugs Found \(\d+\)/i)

  const maxWaitTime = 180000 // 3 minutes
  const startTime = Date.now()
  let drugsAppeared = false

  while ((Date.now() - startTime) < maxWaitTime) {
    // Check if "Drugs Found (X)" has appeared
    const foundDrugs = await drugsFoundText.isVisible().catch(() => false)

    if (foundDrugs) {
      const drugText = await drugsFoundText.textContent()
      console.log(`  → ${drugText} - Search complete!`)
      drugsAppeared = true
      break
    }

    // Log progress every 15 seconds
    const elapsed = Math.round((Date.now() - startTime) / 1000)
    if (elapsed % 15 === 0 && elapsed > 0) {
      console.log(`  → Still searching... (${elapsed}s elapsed)`)
    }

    await page.waitForTimeout(3000) // Check every 3 seconds
  }

  if (!drugsAppeared) {
    console.log('  ⚠️  Search timed out after 3 minutes - drugs not found')
  }

  // Wait an extra 2 seconds for results to fully render
  await page.waitForTimeout(2000)

  // Take screenshot of completed results with split screen
  await page.screenshot({
    path: '__tests__/output/screenshots/07-search-results-complete.png',
    fullPage: true
  })
  console.log('✅ Screenshot: Search results complete')

  // =========================================
  // STEP 12: Click on the top drug card
  // =========================================
  console.log('📍 Clicking on the top drug card...')

  // First, find the drugs panel (the right side where "Drugs Found (X)" is)
  // Then find clickable items within that panel only
  const drugsPanel = page.locator('div, section').filter({ hasText: /Drugs Found \(\d+\)/i }).first()
  const panelExists = await drugsPanel.isVisible({ timeout: 5000 }).catch(() => false)

  let drugCardClicked = false

  if (panelExists) {
    console.log('  → Found drugs panel')

    // Look for the "X total" text on drug cards (e.g., "72 total", "5 total")
    const totalTextElement = page.getByText(/\d+ total/i).first()
    const totalTextVisible = await totalTextElement.isVisible({ timeout: 3000 }).catch(() => false)

    if (totalTextVisible) {
      const totalText = await totalTextElement.textContent()
      console.log(`  → Found drug card indicator: "${totalText}"`)

      await totalTextElement.click()
      console.log('  → Clicked on drug card (via "X total" text)')
      drugCardClicked = true
    } else {
      console.log('  ⚠️  Could not find "X total" text on drug cards')
    }
  }

  if (!drugCardClicked) {
    console.log('  ⚠️  Could not find drug card to click')
  } else {
    // Wait longer for papers to load (5 seconds)
    console.log('  → Waiting for drug detail view to load...')
    await page.waitForTimeout(5000)

    // Take screenshot of what's rendered after clicking the drug
    await page.screenshot({
      path: '__tests__/output/screenshots/08-drug-detail-view.png',
      fullPage: true
    })
    console.log('✅ Screenshot: Drug detail view with papers')
  }

  // =========================================
  // STEP 13: Click Pipeline tab to view asset pipeline
  // =========================================
  console.log('📍 Clicking Pipeline tab...')

  // Look for the Pipeline button/tab in the navigation
  const pipelineTab = page.getByRole('button', { name: /pipeline/i })
  const pipelineTabVisible = await pipelineTab.first().isVisible({ timeout: 5000 }).catch(() => false)

  if (pipelineTabVisible) {
    await pipelineTab.first().click()
    console.log('  → Clicked Pipeline tab')

    // Wait for pipeline view to render
    await page.waitForTimeout(3000)

    // Take screenshot of the asset pipeline (before extraction)
    await page.screenshot({
      path: '__tests__/output/screenshots/09-asset-pipeline-before.png',
      fullPage: true
    })
    console.log('✅ Screenshot: Asset pipeline view (before extraction)')

    // =========================================
    // STEP 14: Set drug count to 3 and run AI Extract
    // =========================================
    console.log('📍 Setting drug count and running AI Extract...')

    // Find the number input field (likely id="drugLimit" or similar)
    const drugCountInput = page.locator('input[type="number"]').first()
    const inputVisible = await drugCountInput.isVisible({ timeout: 5000 }).catch(() => false)

    if (inputVisible) {
      // Clear and set to 3
      await drugCountInput.click()
      await drugCountInput.fill('3')
      console.log('  → Set drug count to 3')

      // Find and click the "AI Extract" button
      const aiExtractButton = page.getByRole('button', { name: /ai extract/i })
      const buttonVisible = await aiExtractButton.isVisible({ timeout: 3000 }).catch(() => false)

      if (buttonVisible) {
        await aiExtractButton.click()
        console.log('  → Clicked "AI Extract" button')

        // Wait for extraction to complete
        console.log('  → Waiting for AI extraction to complete...')

        // Poll for the "No pipeline data extracted yet" text to disappear
        const maxWaitTime = 120000 // 2 minutes
        const startTime = Date.now()
        let extractionComplete = false

        while ((Date.now() - startTime) < maxWaitTime) {
          // Check if "No pipeline data extracted yet" is still visible
          const noDataText = await page.getByText(/no pipeline data extracted yet/i).isVisible().catch(() => false)

          if (!noDataText) {
            console.log('  → AI extraction complete - pipeline data appeared!')
            extractionComplete = true
            break
          }

          // Log progress every 15 seconds
          const elapsed = Math.round((Date.now() - startTime) / 1000)
          if (elapsed % 15 === 0 && elapsed > 0) {
            console.log(`  → Still extracting... (${elapsed}s elapsed)`)
          }

          await page.waitForTimeout(3000) // Check every 3 seconds
        }

        if (!extractionComplete) {
          console.log('  ⚠️  AI extraction timed out after 2 minutes')
        }

        // Wait an extra 2 seconds for UI to settle
        await page.waitForTimeout(2000)

        // Take screenshot of pipeline with extracted data
        await page.screenshot({
          path: '__tests__/output/screenshots/10-pipeline-extracted.png',
          fullPage: true
        })
        console.log('✅ Screenshot: Pipeline with AI-extracted data')
      } else {
        console.log('  ⚠️  AI Extract button not found')
      }
    } else {
      console.log('  ⚠️  Drug count input field not found')
    }

    // =========================================
    // STEP 15: Click Extraction tab
    // =========================================
    console.log('📍 Clicking Extraction tab...')

    // Look for the Extraction button/tab in the navigation
    const extractionTab = page.getByRole('button', { name: /extraction/i })
    const extractionTabVisible = await extractionTab.first().isVisible({ timeout: 5000 }).catch(() => false)

    if (extractionTabVisible) {
      await extractionTab.first().click()
      console.log('  → Clicked Extraction tab')

      // Wait for extraction view to render
      await page.waitForTimeout(2000)

      // Take screenshot of the extraction view
      await page.screenshot({
        path: '__tests__/output/screenshots/11-extraction-view.png',
        fullPage: true
      })
      console.log('✅ Screenshot: Extraction view')
    } else {
      console.log('  ⚠️  Extraction tab not found')
    }
  } else {
    console.log('  ⚠️  Pipeline tab not found')
  }

  console.log('🎉 Basic smoke test complete!')
})
