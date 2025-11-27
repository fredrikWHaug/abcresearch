import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AppContent } from '@/App'
import * as AuthContextModule from '@/contexts/AuthContext'

/**
 * REGRESSION TEST: Auth Redirect Behavior
 * 
 * This test prevents the bug where users could sign in or enter guest mode
 * but wouldn't be redirected from the auth page.
 * 
 * Critical behaviors to maintain:
 * 1. After successful sign in → redirect to /app/home
 * 2. After entering guest mode → redirect to /app/project/null
 * 3. Already authenticated users visiting /auth → auto-redirect
 */

describe('Auth Redirect - Regression Prevention', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('CRITICAL: authenticated user on /auth must redirect to /app/home', async () => {
    // Mock an authenticated user
    const mockUser = { id: 'user-123', email: 'test@example.com' } as any

    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: mockUser,
      session: {} as any,
      loading: false,
      isGuest: false,
      signUp: vi.fn(),
      signIn: vi.fn(),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
      enterGuestMode: vi.fn(),
      exitGuestMode: vi.fn(),
    })

    // Start at /auth
    render(
      <MemoryRouter initialEntries={['/auth']}>
        <AppContent />
      </MemoryRouter>
    )

    // Should redirect to home page, NOT stay on auth
    await waitFor(() => {
      // If we see "Your Projects", we're on the home page (SUCCESS)
      expect(screen.queryByText(/Your Projects/i)).toBeInTheDocument()
      
      // If we see "ABCresearch Portal", we're stuck on auth (FAILURE - regression bug!)
      expect(screen.queryByText(/ABCresearch Portal/i)).not.toBeInTheDocument()
    }, { timeout: 2000 })

    console.log('✅ REGRESSION PREVENTION: Authenticated users redirect from /auth')
  })

  it('CRITICAL: guest user on /auth must redirect to Dashboard', async () => {
    // Mock a guest user
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: null,
      session: null,
      loading: false,
      isGuest: true,
      signUp: vi.fn(),
      signIn: vi.fn(),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
      enterGuestMode: vi.fn(),
      exitGuestMode: vi.fn(),
    })

    // Start at /auth
    render(
      <MemoryRouter initialEntries={['/auth']}>
        <AppContent />
      </MemoryRouter>
    )

    // Should redirect to Dashboard at /app/project/null
    await waitFor(() => {
      // Dashboard should be visible (it has specific UI elements)
      // We're looking for ANY indication we're NOT on the auth page
      expect(screen.queryByText(/ABCresearch Portal/i)).not.toBeInTheDocument()
      
      // If we're stuck on auth form, this is the regression bug
      expect(screen.queryByText(/Continue as Guest/i)).not.toBeInTheDocument()
    }, { timeout: 2000 })

    console.log('✅ REGRESSION PREVENTION: Guest users redirect from /auth')
  })

  it('CRITICAL: unauthenticated user stays on /auth (does NOT redirect)', async () => {
    // Mock an unauthenticated user
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: null,
      session: null,
      loading: false,
      isGuest: false,
      signUp: vi.fn(),
      signIn: vi.fn(),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
      enterGuestMode: vi.fn(),
      exitGuestMode: vi.fn(),
    })

    // Start at /auth
    render(
      <MemoryRouter initialEntries={['/auth']}>
        <AppContent />
      </MemoryRouter>
    )

    // Should stay on auth page
    await waitFor(() => {
      // Should see the auth form
      expect(screen.queryByText(/ABCresearch Portal/i)).toBeInTheDocument()
    })

    console.log('✅ Unauthenticated users correctly stay on /auth')
  })

  it('PREVENT REGRESSION: auth state change triggers redirect', async () => {
    // Start with unauthenticated state
    const mockAuthHook = vi.spyOn(AuthContextModule, 'useAuth')
    
    // Initial: not authenticated
    mockAuthHook.mockReturnValue({
      user: null,
      session: null,
      loading: false,
      isGuest: false,
      signUp: vi.fn(),
      signIn: vi.fn(),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
      enterGuestMode: vi.fn(),
      exitGuestMode: vi.fn(),
    })

    const { rerender } = render(
      <MemoryRouter initialEntries={['/auth']}>
        <AppContent />
      </MemoryRouter>
    )

    // Verify we're on auth page
    expect(screen.queryByText(/ABCresearch Portal/i)).toBeInTheDocument()

    // Simulate successful sign in (auth state changes)
    const mockUser = { id: 'user-123', email: 'test@example.com' } as any
    mockAuthHook.mockReturnValue({
      user: mockUser,
      session: {} as any,
      loading: false,
      isGuest: false,
      signUp: vi.fn(),
      signIn: vi.fn(),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
      enterGuestMode: vi.fn(),
      exitGuestMode: vi.fn(),
    })

    // Re-render with new auth state
    rerender(
      <MemoryRouter initialEntries={['/auth']}>
        <AppContent />
      </MemoryRouter>
    )

    // Should redirect after auth state change
    await waitFor(() => {
      expect(screen.queryByText(/ABCresearch Portal/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/Your Projects/i)).toBeInTheDocument()
    }, { timeout: 2000 })

    console.log('✅ REGRESSION PREVENTION: Auth state changes trigger redirect')
  })
})

