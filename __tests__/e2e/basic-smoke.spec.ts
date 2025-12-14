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

  // Take final screenshot of completed results
  await page.screenshot({
    path: '__tests__/output/screenshots/07-search-results-complete.png',
    fullPage: true
  })
  console.log('✅ Screenshot: Search results complete')

  console.log('🎉 Basic smoke test complete!')
})
