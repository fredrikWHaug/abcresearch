import React, { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

/**
 * InviteCompletePage - Finalizes invite redemption after OAuth
 * 
 * URL: /invite/complete
 * 
 * Flow:
 * 1. User arrives after OAuth callback
 * 2. Page retrieves token from localStorage
 * 3. Calls Supabase RPC directly to redeem token (faster than API)
 * 4. On success, clears token and redirects to app immediately
 */
export function InviteCompletePage() {
  const navigate = useNavigate()
  const { user, session, loading: authLoading } = useAuth()
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'no-token'>('loading')
  const [message, setMessage] = useState('')
  const hasAttemptedRef = useRef(false)

  useEffect(() => {
    // Prevent double execution
    if (hasAttemptedRef.current) return
    
    // Wait for auth to be ready
    if (authLoading) return

    // If not authenticated, redirect to invite redeem page
    if (!user || !session) {
      navigate('/invite/redeem', { replace: true })
      return
    }

    // Mark as attempted
    hasAttemptedRef.current = true

    // Get token from localStorage
    const token = localStorage.getItem('invite_token')
    if (!token) {
      // No token - check if user is already authorized
      checkExistingAuthorization()
      return
    }

    // Redeem the invite
    redeemInvite(token)
  }, [user, session, authLoading])

  const checkExistingAuthorization = async () => {
    if (!user) {
      setStatus('no-token')
      setMessage('No invite token found. If you have an invite link, please use it to sign in.')
      return
    }

    try {
      // Direct Supabase query - much faster than API
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (profile && !error) {
        // User is already authorized - redirect immediately
        logUserSession('login_existing')
        navigate('/app/home', { replace: true })
      } else {
        setStatus('no-token')
        setMessage('No invite token found. If you have an invite link, please use it to sign in.')
      }
    } catch (error) {
      console.error('Authorization check error:', error)
      setStatus('no-token')
      setMessage('No invite token found. If you have an invite link, please use it to sign in.')
    }
  }

  const redeemInvite = async (token: string) => {
    if (!user || !session) {
      setStatus('error')
      setMessage('Authentication error. Please try signing in again.')
      return
    }

    try {
      // Call RPC function directly - faster than going through API
      const { data, error } = await supabase.rpc('redeem_invite', {
        p_token: token.trim(),
        p_email: (user.email || '').trim().toLowerCase(),
        p_user_id: user.id
      })

      if (error) {
        console.error('RPC error:', error)
        setStatus('error')
        setMessage(error.message || 'Failed to redeem invite. Please try again.')
        localStorage.removeItem('invite_token')
        return
      }

      const result = data as { success: boolean; error?: string; message?: string; already_authorized?: boolean }

      if (result.success) {
        // Clear the token
        localStorage.removeItem('invite_token')
        
        // Log the session
        logUserSession(result.already_authorized ? 'login_existing' : 'invite_redeemed')
        
        // Redirect immediately - no delay needed!
        navigate('/app/home', { replace: true })
      } else {
        setStatus('error')
        setMessage(result.error || 'Failed to redeem invite. Please try again.')
        localStorage.removeItem('invite_token')
      }
    } catch (error) {
      console.error('Invite redemption error:', error)
      setStatus('error')
      setMessage('An unexpected error occurred. Please try again.')
      localStorage.removeItem('invite_token')
    }
  }

  // Log user session to Supabase (fire and forget)
  const logUserSession = async (eventType: string) => {
    if (!user) return
    
    try {
      await supabase.from('user_sessions').insert({
        user_id: user.id,
        email: user.email,
        event_type: eventType,
        user_agent: navigator.userAgent,
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      // Don't block on logging errors
      console.error('Failed to log session:', error)
    }
  }

  // Loading state
  if (authLoading || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-muted-foreground">Activating your account...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Success state - should rarely be seen now since we redirect immediately
  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md mx-4">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <CardTitle className="text-2xl font-bold text-green-600">Success!</CardTitle>
            <CardDescription>{message}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  // Error state
  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md mx-4">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 text-red-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <CardTitle className="text-2xl font-bold text-red-600">Oops!</CardTitle>
            <CardDescription>{message}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => navigate('/auth')} 
              className="w-full"
            >
              Try Signing In Again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // No token state
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-yellow-100 flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 text-yellow-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <CardTitle className="text-2xl font-bold">No Invite Found</CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={() => navigate('/auth')} 
            className="w-full"
          >
            Sign In
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
