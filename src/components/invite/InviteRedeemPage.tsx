import React, { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useAuth } from '@/contexts/AuthContext'

/**
 * InviteRedeemPage - Landing page for invite links
 * 
 * URL: /invite/redeem?token=xxx
 * 
 * Flow:
 * 1. User arrives with token in URL
 * 2. Token is stored in localStorage
 * 3. User signs in with OAuth or email
 * 4. After auth, they're redirected to /invite/complete
 */
export function InviteRedeemPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user, signInWithOAuth, loading } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [isSigningIn, setIsSigningIn] = useState(false)

  const token = searchParams.get('token')

  // Store token in localStorage when page loads
  useEffect(() => {
    if (token) {
      localStorage.setItem('invite_token', token)
      console.log('Stored invite token')
    }
  }, [token])

  // If user is already authenticated, redirect to complete page
  useEffect(() => {
    if (user && !loading) {
      navigate('/invite/complete', { replace: true })
    }
  }, [user, loading, navigate])

  const handleOAuthLogin = async (provider: 'google' | 'github') => {
    setIsSigningIn(true)
    setError(null)

    try {
      // Set redirect URL to the complete page
      const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      const baseUrl = isDevelopment
        ? `http://localhost:${window.location.port || '5173'}`
        : window.location.origin

      const { error } = await signInWithOAuth(provider)

      if (error) {
        setError(`Failed to sign in with ${provider}. Please try again.`)
        setIsSigningIn(false)
      }
      // If successful, Supabase will redirect to OAuth provider
    } catch (err) {
      console.error('OAuth error:', err)
      setError('An unexpected error occurred. Please try again.')
      setIsSigningIn(false)
    }
  }

  // No token provided
  if (!token && !localStorage.getItem('invite_token')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-destructive">Invalid Invite Link</CardTitle>
            <CardDescription>
              This invite link is missing a token. Please check your link and try again.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground">
              Please contact the administrator for a valid invite link.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76"
              />
            </svg>
          </div>
          <CardTitle className="text-2xl font-bold">You've Been Invited!</CardTitle>
          <CardDescription className="mt-2">
            Welcome to ABCresearch. Sign in to activate your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="text-sm p-3 rounded-md text-red-700 bg-red-50 border border-red-200">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOAuthLogin('google')}
              disabled={isSigningIn}
              className="w-full"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              {isSigningIn ? 'Signing in...' : 'Continue with Google'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOAuthLogin('github')}
              disabled={isSigningIn}
              className="w-full"
            >
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              {isSigningIn ? 'Signing in...' : 'Continue with GitHub'}
            </Button>
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or sign in with email
              </span>
            </div>
          </div>

          <Button
            variant="secondary"
            onClick={() => navigate('/auth?from=invite')}
            className="w-full"
          >
            Sign in with Email
          </Button>

          <p className="text-xs text-center text-muted-foreground mt-4">
            By signing in, you agree to our Terms of Service and Privacy Policy.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

