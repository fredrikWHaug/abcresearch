/* eslint-disable */
import React, { createContext, useContext, useEffect, useState } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  isGuest: boolean
  signUp: (email: string, password: string) => Promise<any>
  signIn: (email: string, password: string) => Promise<any>
  signInWithOAuth: (provider: 'google' | 'github') => Promise<any>
  signOut: () => Promise<void>
  enterGuestMode: () => void
  exitGuestMode: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [isGuest, setIsGuest] = useState(false)

  useEffect(() => {
    // Check for guest mode in localStorage
    const guestMode = localStorage.getItem('isGuestMode') === 'true'
    if (guestMode) {
      setIsGuest(true)
      setLoading(false)
      return
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
      
      // If there's an existing session, exit guest mode
      if (session?.user) {
        setIsGuest(false)
        localStorage.removeItem('isGuestMode')
      }
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('Auth state change:', { event: _event, session: !!session, user: !!session?.user })
      
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
      
      // If user successfully authenticates, exit guest mode
      if (session?.user) {
        console.log('User authenticated, exiting guest mode')
        setIsGuest(false)
        localStorage.removeItem('isGuestMode')
      }
    })

    return () => subscription.unsubscribe()
  }, [])

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

    // Immediately update context state if login succeeds
    if (data?.session && data?.user) {
      console.log('SignIn successful, updating context state')
      setSession(data.session)
      setUser(data.user)
      setIsGuest(false)
      localStorage.removeItem('isGuestMode')
    }

    return { data, error }
  }

  const signInWithOAuth = async (provider: 'google' | 'github') => {
    // Use localhost for development, window.location.origin for production
    const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    const redirectUrl = isDevelopment
      ? `http://localhost:${window.location.port || '5173'}`
      : window.location.origin

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: redirectUrl,
      },
    })
    return { data, error }
  }

  const signOut = async () => {
    try {
      await supabase.auth.signOut()
    } catch (error) {
      console.log('Supabase signOut error (but continuing with local signOut):', error)
    }
    // Force local sign out regardless of API response
    setSession(null)
    setUser(null)
    setIsGuest(false)
    localStorage.removeItem('isGuestMode')
  }

  const enterGuestMode = () => {
    setIsGuest(true)
    localStorage.setItem('isGuestMode', 'true')
  }

  const exitGuestMode = () => {
    setIsGuest(false)
    localStorage.removeItem('isGuestMode')
  }

  const value = {
    user,
    session,
    loading,
    isGuest,
    signUp,
    signIn,
    signInWithOAuth,
    signOut,
    enterGuestMode,
    exitGuestMode,
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
