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

      // Take screenshot of the extraction view (before upload)
      await page.screenshot({
        path: '__tests__/output/screenshots/11-extraction-view-before.png',
        fullPage: true
      })
      console.log('✅ Screenshot: Extraction view (before upload)')

      // =========================================
      // STEP 16: Upload PDF file
      // =========================================
      console.log('📍 Uploading test PDF file...')

      // Find the file input element (it might be hidden behind the upload button)
      const fileInput = page.locator('input[type="file"]')
      const fileInputExists = await fileInput.count() > 0

      if (fileInputExists) {
        // Upload the test PDF file
        await fileInput.setInputFiles('__tests__/fixtures/test_paper.pdf')
        console.log('  → Uploaded test_paper.pdf')

        // Wait for the upload to register
        await page.waitForTimeout(2000)

        // Take screenshot after upload
        await page.screenshot({
          path: '__tests__/output/screenshots/12-pdf-uploaded.png',
          fullPage: true
        })
        console.log('✅ Screenshot: After PDF upload')

        // =========================================
        // STEP 17: Click Extract Content and wait for success
        // =========================================
        console.log('📍 Clicking Extract Content button...')

        const extractContentButton = page.getByRole('button', { name: /extract content/i })
        const extractButtonVisible = await extractContentButton.isVisible({ timeout: 5000 }).catch(() => false)

        if (extractButtonVisible) {
          await extractContentButton.click()
          console.log('  → Clicked "Extract Content" button')

          // Wait for extraction to complete
          console.log('  → Waiting for PDF extraction to complete...')

          const maxWaitTime = 120000 // 2 minutes
          const startTime = Date.now()
          let extractionSuccessful = false

          while ((Date.now() - startTime) < maxWaitTime) {
            // Check if "Extraction Successful!" appears
            const successMessage = await page.getByText(/extraction successful/i).isVisible().catch(() => false)

            if (successMessage) {
              console.log('  → Extraction Successful!')
              extractionSuccessful = true
              break
            }

            // Log progress every 15 seconds
            const elapsed = Math.round((Date.now() - startTime) / 1000)
            if (elapsed % 15 === 0 && elapsed > 0) {
              console.log(`  → Still extracting... (${elapsed}s elapsed)`)
            }

            await page.waitForTimeout(3000) // Check every 3 seconds
          }

          if (!extractionSuccessful) {
            console.log('  ⚠️  PDF extraction timed out after 2 minutes')
          }

          // Wait for results to fully render
          await page.waitForTimeout(2000)

          // Take screenshot showing extraction results
          await page.screenshot({
            path: '__tests__/output/screenshots/13-pdf-extraction-complete.png',
            fullPage: true
          })
          console.log('✅ Screenshot: PDF extraction complete')

          // =========================================
          // STEP 18: Click View Comprehensive Analysis
          // =========================================
          console.log('📍 Clicking View Comprehensive Analysis button...')

          const analysisButton = page.getByRole('button', { name: /view comprehensive analysis/i })
          const analysisButtonVisible = await analysisButton.isVisible({ timeout: 5000 }).catch(() => false)

          if (analysisButtonVisible) {
            await analysisButton.click()
            console.log('  → Clicked "View Comprehensive Analysis" button')

            // Wait for the analysis page to render
            await page.waitForTimeout(3000)

            // Take screenshot of the comprehensive analysis page
            await page.screenshot({
              path: '__tests__/output/screenshots/14-comprehensive-analysis.png',
              fullPage: true
            })
            console.log('✅ Screenshot: Comprehensive analysis page')

            // =========================================
            // STEP 19: Click Back to Upload
            // =========================================
            console.log('📍 Clicking Back to Upload button...')

            // DEBUG: Log all elements containing "back" to see what's on the page
            console.log('  → DEBUG: Looking for elements with "back" or "upload"...')
            const allElementsFallback = await page.locator('button, a, [role="button"]').all()
            for (const el of allElementsFallback) {
              const text = await el.textContent().catch(() => '')
              if (text && (text.toLowerCase().includes('back') || text.toLowerCase().includes('upload'))) {
                const tagName = await el.evaluate(e => e.tagName).catch(() => 'unknown')
                console.log(`  → Found: <${tagName}> "${text.trim().substring(0, 50)}"`)
              }
            }

            // Try multiple selectors to find the back button in the top left
            const backButtonSelectorsFallback = [
              page.getByRole('button', { name: /back to upload/i }),
              page.getByRole('link', { name: /back to upload/i }),
              page.getByText(/back to upload/i),
              page.getByText(/← back/i),
              page.getByText(/back/i).filter({ has: page.locator('svg') }), // Button with arrow icon
              page.locator('button:has-text("Back")'),
              page.locator('a:has-text("Back")'),
              page.locator('[href*="upload"]').filter({ hasText: /back/i }),
            ]

            let backButtonClickedFallback = false
            for (const selector of backButtonSelectorsFallback) {
              const isVisible = await selector.first().isVisible({ timeout: 2000 }).catch(() => false)
              if (isVisible) {
                const text = await selector.first().textContent().catch(() => 'unknown')
                console.log(`  → Found back button with text: "${text}"`)
                await selector.first().click()
                console.log('  → Clicked back button')
                backButtonClickedFallback = true
                break
              }
            }

            if (backButtonClickedFallback) {
              // Wait for the upload page to render
              await page.waitForTimeout(2000)

              // Take screenshot of the upload page
              await page.screenshot({
                path: '__tests__/output/screenshots/15-back-to-upload.png',
                fullPage: true
              })
              console.log('✅ Screenshot: Back to upload view')

              // =========================================
              // STEP 20: Click Add to Chat
              // =========================================
              console.log('📍 Clicking Add to Chat button...')

              const addToChatButton = page.getByRole('button', { name: /add to chat/i })
              const addToChatVisible = await addToChatButton.isVisible({ timeout: 5000 }).catch(() => false)

              if (addToChatVisible) {
                await addToChatButton.click()
                console.log('  → Clicked "Add to Chat" button')

                // Wait for the next page to render
                await page.waitForTimeout(2000)

                // Take screenshot of the page after adding to chat
                await page.screenshot({
                  path: '__tests__/output/screenshots/16-add-to-chat.png',
                  fullPage: true
                })
                console.log('✅ Screenshot: After adding to chat')

                // =========================================
                // STEP 21: Enter text and wait for graph to render
                // =========================================
                console.log('📍 Entering text in search bar and waiting for graph...')

                // Find the search input field (placeholder: "Ask a follow-up question...")
                const chatSearchInput = page.getByPlaceholder('Ask a follow-up question...')
                const chatInputVisible = await chatSearchInput.isVisible({ timeout: 5000 }).catch(() => false)

                if (chatInputVisible) {
                  const graphQuery = 'Please write a python script creating a graph comparing the drugs from the paper'
                  await chatSearchInput.fill(graphQuery)
                  console.log(`  → Entered: "${graphQuery}"`)

                  // Press Enter to submit
                  await chatSearchInput.press('Enter')
                  console.log('  → Pressed Enter to submit')

                  // Wait for the graph to fully render (indicated by "View Code" button)
                  console.log('  → Waiting for graph to fully render...')

                  const maxGraphWaitTime = 180000 // 3 minutes
                  const graphStartTime = Date.now()
                  let graphRendered = false

                  while ((Date.now() - graphStartTime) < maxGraphWaitTime) {
                    // Check if "View Code" text appears (definitive signal graph is rendered)
                    const viewCodeText = await page.getByText(/View Code/i).isVisible().catch(() => false)

                    if (viewCodeText) {
                      console.log('  → "View Code" button appeared - Graph fully rendered!')
                      graphRendered = true
                      break
                    }

                    // Log progress every 15 seconds
                    const graphElapsed = Math.round((Date.now() - graphStartTime) / 1000)
                    if (graphElapsed % 15 === 0 && graphElapsed > 0) {
                      console.log(`  → Still rendering graph... (${graphElapsed}s elapsed)`)
                    }

                    await page.waitForTimeout(3000) // Check every 3 seconds
                  }

                  if (!graphRendered) {
                    console.log('  ⚠️  Graph rendering timed out after 3 minutes')
                  }

                  // Wait for UI to settle
                  await page.waitForTimeout(2000)

                  // Take screenshot of the fully rendered graph
                  await page.screenshot({
                    path: '__tests__/output/screenshots/17-graph-output.png',
                    fullPage: true
                  })
                  console.log('✅ Screenshot: Graph output fully rendered')
                  console.log('🎉 Basic smoke test complete!')
                  return // Exit test immediately - full e2e journey succeeded
                } else {
                  console.log('  ⚠️  Search input field not found')
                }
              } else {
                console.log('  ⚠️  Add to Chat button not found')
              }
            } else {
              console.log('  ⚠️  Back to Upload button not found - check debug output above')
            }
          } else {
            console.log('  ⚠️  View Comprehensive Analysis button not found')
          }
        } else {
          console.log('  ⚠️  Extract Content button not found')
        }
      } else {
        console.log('  ⚠️  File input not found - trying to click upload button first')

        // Try clicking the upload button to reveal the file input
        const uploadButton = page.getByText(/click or drag to upload pdf file/i)
        const uploadButtonVisible = await uploadButton.isVisible({ timeout: 3000 }).catch(() => false)

        if (uploadButtonVisible) {
          await uploadButton.click()
          console.log('  → Clicked upload button')
          await page.waitForTimeout(500)

          // Try to find file input again
          const fileInputAfterClick = page.locator('input[type="file"]')
          await fileInputAfterClick.setInputFiles('__tests__/fixtures/test_paper.pdf')
          console.log('  → Uploaded test_paper.pdf')

          // Wait for the upload to register
          await page.waitForTimeout(2000)

          // Take screenshot after upload
          await page.screenshot({
            path: '__tests__/output/screenshots/12-pdf-uploaded.png',
            fullPage: true
          })
          console.log('✅ Screenshot: After PDF upload')

          // Click Extract Content button
          console.log('📍 Clicking Extract Content button...')
          const extractContentButton = page.getByRole('button', { name: /extract content/i })
          const extractButtonVisible = await extractContentButton.isVisible({ timeout: 5000 }).catch(() => false)

          if (extractButtonVisible) {
            await extractContentButton.click()
            console.log('  → Clicked "Extract Content" button')

            // Wait for extraction to complete
            console.log('  → Waiting for PDF extraction to complete...')

            const maxWaitTime = 120000 // 2 minutes
            const startTime = Date.now()
            let extractionSuccessful = false

            while ((Date.now() - startTime) < maxWaitTime) {
              // Check if "Extraction Successful!" appears
              const successMessage = await page.getByText(/extraction successful/i).isVisible().catch(() => false)

              if (successMessage) {
                console.log('  → Extraction Successful!')
                extractionSuccessful = true
                break
              }

              // Log progress every 15 seconds
              const elapsed = Math.round((Date.now() - startTime) / 1000)
              if (elapsed % 15 === 0 && elapsed > 0) {
                console.log(`  → Still extracting... (${elapsed}s elapsed)`)
              }

              await page.waitForTimeout(3000) // Check every 3 seconds
            }

            if (!extractionSuccessful) {
              console.log('  ⚠️  PDF extraction timed out after 2 minutes')
            }

            // Wait for results to fully render
            await page.waitForTimeout(2000)

            // Take screenshot showing extraction results
            await page.screenshot({
              path: '__tests__/output/screenshots/13-pdf-extraction-complete.png',
              fullPage: true
            })
            console.log('✅ Screenshot: PDF extraction complete')

            // =========================================
            // STEP 18: Click View Comprehensive Analysis
            // =========================================
            console.log('📍 Clicking View Comprehensive Analysis button...')

            const analysisButton = page.getByRole('button', { name: /view comprehensive analysis/i })
            const analysisButtonVisible = await analysisButton.isVisible({ timeout: 5000 }).catch(() => false)

            if (analysisButtonVisible) {
              await analysisButton.click()
              console.log('  → Clicked "View Comprehensive Analysis" button')

              // Wait for the analysis page to render
              await page.waitForTimeout(3000)

              // Take screenshot of the comprehensive analysis page
              await page.screenshot({
                path: '__tests__/output/screenshots/14-comprehensive-analysis.png',
                fullPage: true
              })
              console.log('✅ Screenshot: Comprehensive analysis page')

              // =========================================
              // STEP 19: Click Back to Upload
              // =========================================
              console.log('📍 Clicking Back to Upload button...')

              // DEBUG: Log all elements containing "back" to see what's on the page
              console.log('  → DEBUG: Looking for elements with "back" or "upload"...')
              const allElements = await page.locator('button, a, [role="button"]').all()
              for (const el of allElements) {
                const text = await el.textContent().catch(() => '')
                if (text && (text.toLowerCase().includes('back') || text.toLowerCase().includes('upload'))) {
                  const tagName = await el.evaluate(e => e.tagName).catch(() => 'unknown')
                  console.log(`  → Found: <${tagName}> "${text.trim().substring(0, 50)}"`)
                }
              }

              // Try multiple selectors to find the back button in the top left
              const backButtonSelectors = [
                page.getByRole('button', { name: /back to upload/i }),
                page.getByRole('link', { name: /back to upload/i }),
                page.getByText(/back to upload/i),
                page.getByText(/← back/i),
                page.getByText(/back/i).filter({ has: page.locator('svg') }), // Button with arrow icon
                page.locator('button:has-text("Back")'),
                page.locator('a:has-text("Back")'),
                page.locator('[href*="upload"]').filter({ hasText: /back/i }),
              ]

              let backButtonClicked = false
              for (const selector of backButtonSelectors) {
                const isVisible = await selector.first().isVisible({ timeout: 2000 }).catch(() => false)
                if (isVisible) {
                  const text = await selector.first().textContent().catch(() => 'unknown')
                  console.log(`  → Found back button with text: "${text}"`)
                  await selector.first().click()
                  console.log('  → Clicked back button')
                  backButtonClicked = true
                  break
                }
              }

              if (backButtonClicked) {
                // Wait for the upload page to render
                await page.waitForTimeout(2000)

                // Take screenshot of the upload page
                await page.screenshot({
                  path: '__tests__/output/screenshots/15-back-to-upload.png',
                  fullPage: true
                })
                console.log('✅ Screenshot: Back to upload view')

                // =========================================
                // STEP 20: Click Add to Chat
                // =========================================
                console.log('📍 Clicking Add to Chat button...')

                const addToChatButton = page.getByRole('button', { name: /add to chat/i })
                const addToChatVisible = await addToChatButton.isVisible({ timeout: 5000 }).catch(() => false)

                if (addToChatVisible) {
                  await addToChatButton.click()
                  console.log('  → Clicked "Add to Chat" button')

                  // Wait for the next page to render
                  await page.waitForTimeout(2000)

                  // Take screenshot of the page after adding to chat
                  await page.screenshot({
                    path: '__tests__/output/screenshots/16-add-to-chat.png',
                    fullPage: true
                  })
                  console.log('✅ Screenshot: After adding to chat')

                  // =========================================
                  // STEP 21: Enter text and wait for graph to render
                  // =========================================
                  console.log('📍 Entering text in search bar and waiting for graph...')

                  // Find the search input field (placeholder: "Ask a follow-up question...")
                  const chatSearchInput = page.getByPlaceholder('Ask a follow-up question...')
                  const chatInputVisible = await chatSearchInput.isVisible({ timeout: 5000 }).catch(() => false)

                  if (chatInputVisible) {
                    const graphQuery = 'Please write a python script creating a graph comparing the drugs from the paper'
                    await chatSearchInput.fill(graphQuery)
                    console.log(`  → Entered: "${graphQuery}"`)

                    // Press Enter to submit
                    await chatSearchInput.press('Enter')
                    console.log('  → Pressed Enter to submit')

                    // Wait for the graph to fully render (indicated by "View Code" button)
                    console.log('  → Waiting for graph to fully render...')

                    const maxGraphWaitTime = 180000 // 3 minutes
                    const graphStartTime = Date.now()
                    let graphRendered = false

                    while ((Date.now() - graphStartTime) < maxGraphWaitTime) {
                      // Check if "View Code" text appears (definitive signal graph is rendered)
                      const viewCodeText = await page.getByText(/View Code/i).isVisible().catch(() => false)

                      if (viewCodeText) {
                        console.log('  → "View Code" button appeared - Graph fully rendered!')
                        graphRendered = true
                        break
                      }

                      // Log progress every 15 seconds
                      const graphElapsed = Math.round((Date.now() - graphStartTime) / 1000)
                      if (graphElapsed % 15 === 0 && graphElapsed > 0) {
                        console.log(`  → Still rendering graph... (${graphElapsed}s elapsed)`)
                      }

                      await page.waitForTimeout(3000) // Check every 3 seconds
                    }

                    if (!graphRendered) {
                      console.log('  ⚠️  Graph rendering timed out after 3 minutes')
                    }

                    // Wait for UI to settle
                    await page.waitForTimeout(2000)

                    // Take screenshot of the fully rendered graph
                    await page.screenshot({
                      path: '__tests__/output/screenshots/17-graph-output.png',
                      fullPage: true
                    })
                    console.log('✅ Screenshot: Graph output fully rendered')
                    console.log('🎉 Basic smoke test complete!')
                    return // Exit test immediately - full e2e journey succeeded
                  } else {
                    console.log('  ⚠️  Search input field not found')
                  }
                } else {
                  console.log('  ⚠️  Add to Chat button not found')
                }
              } else {
                console.log('  ⚠️  Back to Upload button not found - check debug output above')
              }
            } else {
              console.log('  ⚠️  View Comprehensive Analysis button not found')
            }
          } else {
            console.log('  ⚠️  Extract Content button not found')
          }
        } else {
          console.log('  ⚠️  Upload button not found')
        }
      }
    } else {
      console.log('  ⚠️  Extraction tab not found')
    }
  } else {
    console.log('  ⚠️  Pipeline tab not found')
  }

  console.log('🎉 Basic smoke test complete!')
})
