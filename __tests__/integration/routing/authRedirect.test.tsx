import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { User, Session } from '@supabase/supabase-js'
import { AppContent } from '@/App'
import * as AuthContextModule from '@/contexts/AuthContext'

/**
 * REGRESSION TEST: Auth Redirect Behavior
 * 
 * This test prevents the bug where users could sign in
 * but wouldn't be redirected from the auth page.
 * 
 * Critical behaviors to maintain:
 * 1. After successful sign in (authorized) → redirect to /app/home
 * 2. Authenticated but not authorized → redirect to /unauthorized
 * 3. Already authenticated+authorized users visiting /auth → auto-redirect
 * 4. Unauthenticated users → stay on /auth
 */

describe('Auth Redirect - Regression Prevention', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('CRITICAL: authenticated AND authorized user on /auth must redirect to /app/home', async () => {
    // Mock an authenticated and authorized user
    const mockUser = { id: 'user-123', email: 'test@example.com' } as User

    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: mockUser,
      session: {} as Session,
      loading: false,
      isAuthorized: true,
      authorizationChecked: true,
      signUp: vi.fn(),
      signIn: vi.fn(),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
      checkAuthorization: vi.fn().mockResolvedValue(true),
      logPageVisit: vi.fn(),
      logSession: vi.fn(),
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

    console.log('✅ REGRESSION PREVENTION: Authenticated+authorized users redirect from /auth')
  })

  it('CRITICAL: authenticated but NOT authorized user must redirect to /unauthorized', async () => {
    // Mock an authenticated but not authorized user
    const mockUser = { id: 'user-123', email: 'test@example.com' } as User

    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: mockUser,
      session: {} as Session,
      loading: false,
      isAuthorized: false,
      authorizationChecked: true,
      signUp: vi.fn(),
      signIn: vi.fn(),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
      checkAuthorization: vi.fn().mockResolvedValue(false),
      logPageVisit: vi.fn(),
      logSession: vi.fn(),
    })

    // Start at /auth
    render(
      <MemoryRouter initialEntries={['/auth']}>
        <AppContent />
      </MemoryRouter>
    )

    // Should redirect to unauthorized page
    await waitFor(() => {
      // Should see the invite-only message
      expect(screen.queryByText(/Invite Only/i)).toBeInTheDocument()
      
      // Should NOT see the auth form
      expect(screen.queryByText(/ABCresearch Portal/i)).not.toBeInTheDocument()
    }, { timeout: 2000 })

    console.log('✅ REGRESSION PREVENTION: Unauthorized users redirect to /unauthorized')
  })

  it('CRITICAL: unauthenticated user stays on /auth (does NOT redirect)', async () => {
    // Mock an unauthenticated user
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: null,
      session: null,
      loading: false,
      isAuthorized: null,
      authorizationChecked: false,
      signUp: vi.fn(),
      signIn: vi.fn(),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
      checkAuthorization: vi.fn().mockResolvedValue(false),
      logPageVisit: vi.fn(),
      logSession: vi.fn(),
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
      isAuthorized: null,
      authorizationChecked: false,
      signUp: vi.fn(),
      signIn: vi.fn(),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
      checkAuthorization: vi.fn().mockResolvedValue(false),
      logPageVisit: vi.fn(),
      logSession: vi.fn(),
    })

    const { rerender } = render(
      <MemoryRouter initialEntries={['/auth']}>
        <AppContent />
      </MemoryRouter>
    )

    // Verify we're on auth page
    expect(screen.queryByText(/ABCresearch Portal/i)).toBeInTheDocument()

    // Simulate successful sign in (auth state changes to authenticated + authorized)
    const mockUser = { id: 'user-123', email: 'test@example.com' } as User
    mockAuthHook.mockReturnValue({
      user: mockUser,
      session: {} as Session,
      loading: false,
      isAuthorized: true,
      authorizationChecked: true,
      signUp: vi.fn(),
      signIn: vi.fn(),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
      checkAuthorization: vi.fn().mockResolvedValue(true),
      logPageVisit: vi.fn(),
      logSession: vi.fn(),
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
