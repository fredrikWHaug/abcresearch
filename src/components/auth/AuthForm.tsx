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
          // Check if email confirmation is required
          if (!data.session && !data.user.email_confirmed_at) {
            // This is normal - user created but needs email confirmation
            setMessage('Account created! Check your email for the confirmation link.')
          } else if (data.session) {
            // User created and automatically logged in (when email confirmation is disabled)
            setMessage('Account created successfully!')
          } else {
            // User exists but still show success message since signup didn't error
            setMessage('Account created! Please check your email to confirm.')
          }
        } else {
          setMessage('Account creation failed. Please try again.')
        }
      } else if (isLogin) {
        // Successful login - only show message if we have a session
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

  const handleGuestMode = () => {
    enterGuestMode()
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
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
