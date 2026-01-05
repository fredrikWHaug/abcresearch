import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

/**
 * WaitlistPage - Public page to request access
 * 
 * URL: /waitlist
 * 
 * Collects name, email, LinkedIn URL, and optional message
 * Submits to /api/waitlist
 */
export function WaitlistPage() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    linkedinUrl: '',
    message: ''
  })
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [responseMessage, setResponseMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('submitting')
    setResponseMessage('')

    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setStatus('success')
        setResponseMessage(data.message)
        
        // If already authorized, redirect to sign in
        if (data.alreadyAuthorized) {
          setTimeout(() => navigate('/auth'), 2000)
        }
      } else {
        setStatus('error')
        setResponseMessage(data.error || 'Something went wrong. Please try again.')
      }
    } catch (error) {
      console.error('Waitlist submission error:', error)
      setStatus('error')
      setResponseMessage('An unexpected error occurred. Please try again.')
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  // Success state
  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
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
            <CardTitle className="text-2xl font-bold text-green-600">Request Received!</CardTitle>
            <CardDescription className="mt-2">
              {responseMessage}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button 
              variant="outline" 
              onClick={() => navigate('/auth')}
              className="mt-4"
            >
              Back to Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Request Access</CardTitle>
          <CardDescription className="mt-2">
            ABCresearch is currently invite-only. Fill out the form below and we'll review your request.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                type="text"
                placeholder="Your full name"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@company.com"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="linkedinUrl">LinkedIn Profile</Label>
              <Input
                id="linkedinUrl"
                name="linkedinUrl"
                type="url"
                placeholder="https://linkedin.com/in/yourprofile"
                value={formData.linkedinUrl}
                onChange={handleChange}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Why are you interested? (optional)</Label>
              <Textarea
                id="message"
                name="message"
                placeholder="Tell us a bit about yourself and what you're looking to accomplish..."
                value={formData.message}
                onChange={handleChange}
                rows={3}
              />
            </div>

            {status === 'error' && (
              <div className="text-sm p-3 rounded-md text-red-700 bg-red-50 border border-red-200">
                {responseMessage}
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full" 
              disabled={status === 'submitting'}
            >
              {status === 'submitting' ? 'Submitting...' : 'Request Access'}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-border text-center">
            <p className="text-sm text-muted-foreground">
              Already have an invite or account?
            </p>
            <Button
              variant="link"
              onClick={() => navigate('/auth')}
              className="mt-1"
            >
              Sign In
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

