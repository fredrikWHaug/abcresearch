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

      // No profile - check if their email is in invites table
      const userEmail = user.email?.toLowerCase()
      if (!userEmail) {
        setIsAuthorized(false)
        setAuthorizationChecked(true)
        return false
      }

      const { data: invite } = await supabase
        .from('invites')
        .select('id')
        .ilike('email', userEmail)
        .single()

      if (invite) {
        // Email is invited - create profile for them
        const { error: createError } = await supabase
          .from('profiles')
          .insert({
            user_id: user.id,
            email: userEmail,
          })

        if (!createError) {
          setIsAuthorized(true)
          setAuthorizationChecked(true)
          logSession('signup')
          return true
        } else {
          console.error('Failed to create profile:', createError)
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
      
      // For SIGNED_IN and SIGNED_OUT events, update state
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
