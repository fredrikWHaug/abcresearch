import { test, expect } from '@playwright/test'

/**
 * E2E Tests: Authentication Flow
 *
 * These tests verify the core authentication functionality:
 * - Unauthenticated users are redirected to /auth
 * - Auth form renders correctly
 * - Login with valid credentials works
 * - Login errors are displayed
 */

test.describe('Authentication', () => {
  test('redirects unauthenticated users to /auth', async ({ page }) => {
    // Try to access the app directly
    await page.goto('/app/home')

    // Should be redirected to auth page
    await expect(page).toHaveURL(/\/auth/)
  })

  test('auth form renders with required elements', async ({ page }) => {
    await page.goto('/auth')

    // Verify the form elements exist
    await expect(page.locator('input#email')).toBeVisible()
    await expect(page.locator('input#password')).toBeVisible()
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /continue as guest/i })).toBeVisible()
  })

  test('shows error for invalid credentials', async ({ page }) => {
    await page.goto('/auth')

    // Fill in invalid credentials
    await page.locator('input#email').fill('invalid@example.com')
    await page.locator('input#password').fill('wrongpassword')

    // Click sign in
    await page.getByRole('button', { name: /sign in/i }).click()

    // Wait for error message to appear
    // The error message contains text-red-700 class
    const errorMessage = page.locator('.text-red-700')
    await expect(errorMessage).toBeVisible({ timeout: 10000 })
  })

  test('successful login redirects to dashboard', async ({ page }) => {
    const email = process.env.TEST_USER_EMAIL
    const password = process.env.TEST_USER_PASSWORD

    // Skip this test if no test credentials are provided
    if (!email || !password) {
      test.skip()
      return
    }

    await page.goto('/auth')

    // Fill in valid credentials
    await page.locator('input#email').fill(email)
    await page.locator('input#password').fill(password)

    // Click sign in
    await page.getByRole('button', { name: /sign in/i }).click()

    // Should redirect to /app/home after successful login
    await expect(page).toHaveURL(/\/app\//, { timeout: 15000 })
  })

  test('guest mode allows access without credentials', async ({ page }) => {
    await page.goto('/auth')

    // Click "Continue as Guest"
    await page.getByRole('button', { name: /continue as guest/i }).click()

    // Should be redirected to app
    await expect(page).toHaveURL(/\/app\//, { timeout: 10000 })

    // Should see guest indicator
    const guestIndicator = page.getByText(/guest/i)
    await expect(guestIndicator.first()).toBeVisible()
  })
})
