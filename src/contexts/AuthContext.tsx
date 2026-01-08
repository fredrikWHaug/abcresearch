/* eslint-disable */
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  isAuthorized: boolean | null  // null = checking, true = has profile, false = no profile
  authorizationChecked: boolean
  signUp: (email: string, password: string) => Promise<any>
  signIn: (email: string, password: string) => Promise<any>
  signInWithOAuth: (provider: 'google' | 'github') => Promise<any>
  signOut: () => Promise<void>
  checkAuthorization: () => Promise<boolean>
  logPageVisit: (page: string, metadata?: Record<string, any>) => Promise<void>
  logSession: (eventType: string, metadata?: Record<string, any>) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null)
  const [authorizationChecked, setAuthorizationChecked] = useState(false)

  // Log user session (fire and forget - doesn't block)
  const logSession = useCallback(async (eventType: string, metadata: Record<string, any> = {}) => {
    if (!user) return
    
    try {
      await supabase.from('user_sessions').insert({
        user_id: user.id,
        email: user.email,
        event_type: eventType,
        user_agent: navigator.userAgent,
        metadata,
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      // Don't block on logging errors
      console.debug('Session logging (non-critical):', error)
    }
  }, [user])

  // Log page visit (fire and forget - doesn't block)
  const logPageVisit = useCallback(async (page: string, metadata: Record<string, any> = {}) => {
    if (!user) return
    
    // Determine event type from page path
    let eventType: string
    
    if (page === '/' || page === '/app/home') {
      eventType = 'page_home'
    } else if (page.startsWith('/app/project/') && page.includes('/research')) {
      eventType = 'page_research'
    } else if (page.startsWith('/app/project/') && page.includes('/pipeline')) {
      eventType = 'page_pipeline'
    } else if (page.startsWith('/app/project/') && page.includes('/marketmap')) {
      eventType = 'page_marketmap'
    } else if (page.startsWith('/app/project/') && page.includes('/extraction')) {
      eventType = 'page_extraction'
    } else if (page.startsWith('/app/project/') && page.includes('/feed')) {
      eventType = 'page_feed'
    } else if (page === '/auth') {
      eventType = 'page_auth'
    } else if (page === '/unauthorized') {
      eventType = 'page_unauthorized'
    } else {
      // Fallback for unknown pages
      eventType = 'page_visit'
    }

    // Extract project ID from path if present
    const projectIdMatch = page.match(/\/project\/(\d+)/)
    if (projectIdMatch) {
      metadata.project_id = parseInt(projectIdMatch[1], 10)
    }

    try {
      await supabase.from('user_sessions').insert({
        user_id: user.id,
        email: user.email,
        event_type: eventType,
        user_agent: navigator.userAgent,
        metadata: {
          ...metadata,
          page_path: page,
        },
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      // Don't block on logging errors
      console.debug('Page visit logging (non-critical):', error)
    }
  }, [user])

  // Check if user is authorized (has a profile OR is invited and needs profile created)
  const checkAuthorization = useCallback(async (): Promise<boolean> => {
    if (!user) {
      setIsAuthorized(false)
      setAuthorizationChecked(true)
      return false
    }

    try {
      // First check if user already has a profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (profile && !profileError) {
        // User has a profile - authorized
        setIsAuthorized(true)
        setAuthorizationChecked(true)
        logSession('login')
        return true
      }

      // No profile - check if their email is in invites table using RPC function
      const userEmail = user.email?.toLowerCase().trim()
      if (!userEmail) {
        setIsAuthorized(false)
        setAuthorizationChecked(true)
        return false
      }

      // Use RPC function to check invite (bypasses RLS)
      const { data: isInvited, error: inviteCheckError } = await supabase.rpc('check_email_invited', {
        p_email: userEmail
      })

      if (inviteCheckError) {
        console.error('Error checking invite in AuthContext:', inviteCheckError)
        setIsAuthorized(false)
        setAuthorizationChecked(true)
        return false
      }

      if (isInvited === true) {
        // Email is invited - try to mark invite as used first to get invite_id
        let inviteId: string | null = null
        
        const { data: inviteResult, error: inviteError } = await supabase.rpc('mark_invite_used_by_email', {
          p_email: userEmail,
          p_user_id: user.id
        })

        if (!inviteError && inviteResult?.success) {
          // Successfully marked invite as used (or found already-used invite)
          inviteId = inviteResult.invite_id || null
        } else {
          // Invite might already be used or there was an error
          // We'll still try to create profile without invite_id
          console.warn('Could not get invite_id, will create profile without it:', inviteError || inviteResult?.error)
        }

        // Create profile using RPC function (bypasses RLS)
        const { data: profileResult, error: createError } = await supabase.rpc('create_profile_for_invited_user', {
          p_user_id: user.id,
          p_email: userEmail,
          p_invite_id: inviteId,
        })

        if (!createError && profileResult?.success) {
          setIsAuthorized(true)
          setAuthorizationChecked(true)
          logSession('signup')
          return true
        } else if (profileResult?.already_exists) {
          // Profile already exists - user is authorized
          setIsAuthorized(true)
          setAuthorizationChecked(true)
          logSession('login')
          return true
        } else {
          console.error('Failed to create profile:', createError || profileResult?.error)
        }
      }

      // Not invited - unauthorized
      setIsAuthorized(false)
      setAuthorizationChecked(true)
      return false
    } catch (error) {
      console.error('Authorization check failed:', error)
      setIsAuthorized(false)
      setAuthorizationChecked(true)
      return false
    }
  }, [user, logSession])

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('Auth state change:', { event: _event, session: !!session, user: !!session?.user })
      
      // Handle token refresh silently without triggering full state update
      if (_event === 'TOKEN_REFRESHED') {
        console.log('Token refreshed silently')
        setSession((prevSession) => {
          if (prevSession?.user?.id === session?.user?.id) {
            return session
          }
          return session
        })
        return
      }
      
      // For SIGNED_IN and SIGNED_OUT events, always update state
      // This ensures email verification redirects properly trigger authorization checks
      if (_event === 'SIGNED_IN' || _event === 'SIGNED_OUT') {
        console.log('Auth event:', _event, 'Session:', !!session, 'User:', !!session?.user)
        // Always update session and user on SIGNED_IN/SIGNED_OUT to ensure state is fresh
        setSession(session)
        const newUser = session?.user ?? null
        setUser(newUser)
        setLoading(false)
        
        // Reset authorization check when user signs in (including email verification)
        if (_event === 'SIGNED_IN' && newUser && session) {
          setIsAuthorized(null)
          setAuthorizationChecked(false)
          
          // Log OAuth login if user signed in via OAuth provider
          // Check app_metadata.provider or app_metadata.providers to detect OAuth
          const provider = newUser.app_metadata?.provider
          const providers = newUser.app_metadata?.providers || []
          
          // Determine if this is an OAuth login (not email/password)
          const isOAuth = (provider && provider !== 'email') || 
                         (providers.length > 0 && providers.some((p: string) => p !== 'email'))
          
          if (isOAuth) {
            // Determine which OAuth provider (Google or GitHub)
            const oauthProvider = (provider === 'google' || providers.includes('google'))
              ? 'oauth_google' 
              : (provider === 'github' || providers.includes('github'))
              ? 'oauth_github'
              : null
            
            if (oauthProvider) {
              // Log OAuth login directly (fire and forget - doesn't block)
              // We use the session's user directly since logSession depends on user state
              supabase.from('user_sessions').insert({
                user_id: newUser.id,
                email: newUser.email,
                event_type: oauthProvider,
                user_agent: navigator.userAgent,
                metadata: {
                  provider: provider || providers[0],
                  auth_method: 'oauth'
                },
                timestamp: new Date().toISOString()
              }).then(({ error }) => {
                if (error) {
                  console.debug('OAuth login logging (non-critical):', error)
                }
              })
            }
          }
        }
        
        // Reset authorization when user signs out
        if (_event === 'SIGNED_OUT') {
          setIsAuthorized(null)
          setAuthorizationChecked(false)
        }
      } else {
        // For other events (TOKEN_REFRESHED, etc.), use conditional updates
        setSession((prevSession) => {
          const sessionChanged = prevSession?.access_token !== session?.access_token
          if (sessionChanged || !prevSession) {
            console.log('Session updated')
            return session
          }
          console.log('Session unchanged, skipping update')
          return prevSession
        })
        
        setUser((prevUser) => {
          const userChanged = prevUser?.id !== session?.user?.id
          if (userChanged || !prevUser) {
            return session?.user ?? null
          }
          return prevUser
        })
        
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Check authorization when session changes and we have a user
  useEffect(() => {
    if (session && user && !authorizationChecked) {
      const timer = setTimeout(() => {
        checkAuthorization()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [session, user, authorizationChecked, checkAuthorization])

  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })
    return { data, error }
  }

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { data, error }
  }

  const signInWithOAuth = async (provider: 'google' | 'github') => {
    // Use localhost for development, window.location.origin for production
    const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    const baseUrl = isDevelopment
      ? `http://localhost:${window.location.port || '5173'}`
      : window.location.origin

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: baseUrl,
        // Force account picker to show (don't auto-select previous account)
        queryParams: provider === 'google' 
          ? { prompt: 'select_account' }
          : { prompt: 'consent' }, // GitHub uses 'consent' to re-prompt
      },
    })
    return { data, error }
  }

  const signOut = async () => {
    // Log the logout before clearing state
    if (user) {
      logSession('logout')
    }
    
    try {
      // Sign out from all tabs/windows
      await supabase.auth.signOut({ scope: 'global' })
    } catch (error) {
      console.log('Supabase signOut error (but continuing with local signOut):', error)
    }
    
    // Force local sign out regardless of API response
    setSession(null)
    setUser(null)
    setIsAuthorized(null)
    setAuthorizationChecked(false)
  }

  const value = {
    user,
    session,
    loading,
    isAuthorized,
    authorizationChecked,
    signUp,
    signIn,
    signInWithOAuth,
    signOut,
    checkAuthorization,
    logPageVisit,
    logSession,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
