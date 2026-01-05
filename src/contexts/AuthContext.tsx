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

  // Check if user is authorized (has a profile) - uses direct Supabase query for speed
  const checkAuthorization = useCallback(async (): Promise<boolean> => {
    if (!user) {
      setIsAuthorized(false)
      setAuthorizationChecked(true)
      return false
    }

    try {
      // Direct Supabase query - much faster than API endpoint
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single()

      const authorized = !!profile && !error
      setIsAuthorized(authorized)
      setAuthorizationChecked(true)
      
      // Log the login if authorized
      if (authorized) {
        logSession('login')
      }
      
      return authorized
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
        // Update session but don't trigger re-renders if user is the same
        setSession((prevSession) => {
          if (prevSession?.user?.id === session?.user?.id) {
            return session // Just update the tokens
          }
          return session
        })
        return
      }
      
      // For SIGNED_IN and SIGNED_OUT events, update state
      // Prevent unnecessary state updates if session hasn't actually changed
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
      
      // Reset authorization when user signs out
      if (_event === 'SIGNED_OUT') {
        setIsAuthorized(null)
        setAuthorizationChecked(false)
      }
      
      // Reset authorization check when new user signs in
      if (_event === 'SIGNED_IN') {
        setIsAuthorized(null)
        setAuthorizationChecked(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Check authorization when session changes and we have a user
  useEffect(() => {
    if (session && user && !authorizationChecked) {
      // Small delay to ensure session is fully established
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

    // Don't manually update state here - onAuthStateChange will handle it
    // This prevents duplicate state updates and re-renders

    return { data, error }
  }

  const signInWithOAuth = async (provider: 'google' | 'github') => {
    // Check if we're coming from an invite flow
    const inviteToken = localStorage.getItem('invite_token')
    
    // Use localhost for development, window.location.origin for production
    const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    const baseUrl = isDevelopment
      ? `http://localhost:${window.location.port || '5173'}`
      : window.location.origin

    // If there's an invite token, redirect to the complete page
    const redirectUrl = inviteToken 
      ? `${baseUrl}/invite/complete`
      : baseUrl

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: redirectUrl,
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
      await supabase.auth.signOut()
    } catch (error) {
      console.log('Supabase signOut error (but continuing with local signOut):', error)
    }
    // Force local sign out regardless of API response
    setSession(null)
    setUser(null)
    setIsAuthorized(null)
    setAuthorizationChecked(false)
    // Clean up any invite tokens
    localStorage.removeItem('invite_token')
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
