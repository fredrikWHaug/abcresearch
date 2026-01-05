/**
 * React Testing Helpers
 * Utilities for rendering components with necessary providers
 */

import React from 'react'
import { render, type RenderOptions } from '@testing-library/react'
import { AuthProvider } from '@/contexts/AuthContext'
import { vi } from 'vitest'

/**
 * Custom render function that wraps component with AuthProvider
 */
export function renderWithProviders(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <AuthProvider>{children}</AuthProvider>
  }

  return render(ui, { wrapper: Wrapper, ...options })
}

/**
 * Render with mocked auth state
 */
interface RenderWithAuthOptions {
  user?: {
    id: string
    email: string
  } | null
  loading?: boolean
  isAuthorized?: boolean | null
  authorizationChecked?: boolean
}

export function renderWithAuth(
  ui: React.ReactElement,
  authState: RenderWithAuthOptions = {},
  renderOptions?: Omit<RenderOptions, 'wrapper'>
) {
  const { 
    user = null, 
    loading = false, 
    isAuthorized = user ? true : null,
    authorizationChecked = user ? true : false
  } = authState

  // Mock the useAuth hook
  vi.mock('@/contexts/AuthContext', () => ({
    AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useAuth: () => ({
      user,
      session: user ? { user, access_token: 'mock-token' } : null,
      loading,
      isAuthorized,
      authorizationChecked,
      signUp: vi.fn(),
      signIn: vi.fn(),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
      checkAuthorization: vi.fn().mockResolvedValue(isAuthorized ?? false),
    }),
  }))

  return render(ui, renderOptions)
}

/**
 * Wait for async operations and re-renders
 */
export async function waitForLoadingToFinish() {
  const { waitFor } = await import('@testing-library/react')
  await waitFor(() => {
    expect(document.querySelector('[data-loading="true"]')).not.toBeInTheDocument()
  }, { timeout: 3000 })
}

/**
 * Create mock user event for interactions
 */
export function createUserEvent() {
  return import('@testing-library/user-event').then(mod => mod.default.setup())
}
