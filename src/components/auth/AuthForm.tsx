import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

export function AuthForm() {
  const [isLogin, setIsLogin] = useState(true) // Default to sign in
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const { signIn, signUp, signInWithOAuth, user } = useAuth()

  // Redirect when user is authenticated
  useEffect(() => {
    if (user) {
      setEmail('')
      setPassword('')
      setMessage('')
    }
  }, [user])

  // Check if email is in the invites table (for signup only)
  // Uses RPC function to bypass RLS on invites table
  const checkEmailInvited = async (emailToCheck: string): Promise<boolean> => {
    const { data, error } = await supabase.rpc('check_email_invited', {
      p_email: emailToCheck.trim()
    })
    
    if (error) {
      console.error('Error checking invite:', error)
      return false
    }
    
    return data === true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      // For signup, check if email is in invites table
      if (!isLogin) {
        const isInvited = await checkEmailInvited(email)
        if (!isInvited) {
          setMessage('This app is invite-only. Your email is not on the invite list. Please contact the administrator.')
          setLoading(false)
          return
        }
      }

      const { data, error } = isLogin 
        ? await signIn(email, password)
        : await signUp(email, password)

      if (error) {
        if (error.message.includes('User already registered') || 
            error.message.includes('already exists') ||
            error.message.includes('duplicate key value')) {
          setMessage('An account with this email already exists. Try signing in instead.')
        } else if (error.message.includes('Invalid login credentials')) {
          setMessage('Invalid email or password. Please check your credentials.')
        } else if (error.message.includes('Email not confirmed')) {
          setMessage('Please check your email and click the confirmation link.')
        } else if (error.message.includes('Signup requires a valid password')) {
          setMessage('Password must be at least 6 characters long.')
        } else {
          setMessage(error.message)
        }
      } else if (!isLogin) {
        // For signup success
        if (data.user) {
          if (!data.session && !data.user.email_confirmed_at) {
            setMessage('Account created! Check your email for the confirmation link.')
          } else if (data.session) {
            setMessage('Account created successfully!')
          } else {
            setMessage('Account created! Please check your email to confirm.')
          }
        } else {
          setMessage('Account creation failed. Please try again.')
        }
      } else if (isLogin) {
        if (data?.session) {
          setMessage('Welcome back!')
        } else {
          setMessage('Login failed. Please try again.')
        }
      }
    } catch (error) {
      console.error('Auth error:', error)
      setMessage('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleOAuthLogin = async (provider: 'google' | 'github') => {
    setLoading(true)
    setMessage('')

    try {
      const { error } = await signInWithOAuth(provider)

      if (error) {
        setMessage(`Failed to sign in with ${provider}. Please try again.`)
      }
      // If successful, user will be redirected to OAuth provider
      // The invite check for OAuth happens after authentication via the authorization flow
    } catch (error) {
      console.error('OAuth error:', error)
      setMessage('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const isErrorMessage = (msg: string) => {
    return msg.includes('error') || 
           msg.includes('Invalid') || 
           msg.includes('failed') ||
           msg.includes('already exists') ||
           msg.includes('unexpected') ||
           msg.includes('invite-only') ||
           msg.includes('not on the invite')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">
            {isLogin ? 'ABCresearch Portal' : 'Create Account'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {message && (
              <div className={`text-sm p-3 rounded-md ${
                isErrorMessage(message)
                  ? 'text-red-700 bg-red-50 border border-red-200' 
                  : 'text-green-700 bg-green-50 border border-green-200'
              }`}>
                {message}
              </div>
            )}
            <Button type="submit" className="w-full bg-black hover:bg-gray-800 text-white" disabled={loading}>
              {loading ? 'Loading...' : isLogin ? 'Sign In' : 'Sign Up'}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              {isLogin
                ? <>Don't have an account? <span className="underline">Sign up</span></>
                : <>Already have an account? <span className="underline">Sign in</span></>
              }
            </button>
          </div>

          {/* OAuth Login Section */}
          <div className="mt-6 pt-6 border-t border-border">
            <div className="text-center mb-4">
              <span className="text-sm text-muted-foreground">Or continue with</span>
            </div>
            <div className="space-y-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOAuthLogin('google')}
                disabled={loading}
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
                Continue with Google
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOAuthLogin('github')}
                disabled={loading}
                className="w-full"
              >
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                Continue with GitHub
              </Button>
            </div>
          </div>

        </CardContent>
      </Card>
    </div>
  )
}
