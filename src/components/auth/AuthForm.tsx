import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/contexts/AuthContext'

export function AuthForm() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const { signIn, signUp, enterGuestMode } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const { data, error } = isLogin 
        ? await signIn(email, password)
        : await signUp(email, password)

      // Debug logging
      console.log('Auth response:', { data, error, isLogin })
      if (data?.user) {
        console.log('User data:', {
          id: data.user.id,
          email: data.user.email,
          created_at: data.user.created_at,
          email_confirmed_at: data.user.email_confirmed_at
        })
      }

      if (error) {
        // Handle specific error cases
        if (error.message.includes('User already registered')) {
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
        // For signup: if no session is created, it means the user already exists
        if (data.user && !data.session) {
          setMessage('An account with this email already exists. Try signing in instead.')
        } else if (data.user && data.session) {
          // New user created and logged in
          setMessage('Account created successfully!')
        } else if (data.user && !data.user.email_confirmed_at) {
          // User created but needs email confirmation
          setMessage('Check your email for the confirmation link!')
        } else {
          setMessage('Account creation failed. Please try again.')
        }
      } else {
        // Successful login
        setMessage('Welcome back!')
      }
    } catch (error) {
      console.error('Auth error:', error)
      setMessage('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleGuestMode = () => {
    enterGuestMode()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </CardTitle>
          <CardDescription>
            {isLogin 
              ? 'Sign in to your account to continue' 
              : 'Sign up for a new account to get started'
            }
          </CardDescription>
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
                message.includes('error') || 
                message.includes('Invalid') || 
                message.includes('failed') ||
                message.includes('already exists') ||
                message.includes('unexpected error')
                  ? 'text-red-700 bg-red-50 border border-red-200' 
                  : 'text-green-700 bg-green-50 border border-green-200'
              }`}>
                {message}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Loading...' : isLogin ? 'Sign In' : 'Sign Up'}
            </Button>
          </form>
          
          {/* Guest Mode Section */}
          <div className="mt-6 pt-6 border-t border-border">
            <div className="text-center space-y-3">
              <div className="text-sm text-muted-foreground">
                Want to try the app without creating an account?
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleGuestMode}
                className="w-full"
              >
                Continue as Guest
              </Button>
              <div className="text-xs text-muted-foreground">
                <div className="flex items-center justify-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  Your data won't be saved
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              {isLogin 
                ? "Don't have an account? Sign up" 
                : "Already have an account? Sign in"
              }
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
