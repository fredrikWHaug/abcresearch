import React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/contexts/AuthContext'

export function Dashboard() {
  const { user, signOut } = useAuth()

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-3xl font-bold text-foreground">
                Welcome to Your Dashboard!
              </CardTitle>
              <CardDescription className="text-lg">
                You're successfully authenticated
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center space-y-2">
                <p className="text-muted-foreground">
                  Logged in as:
                </p>
                <p className="font-semibold text-lg">
                  {user?.email}
                </p>
              </div>
              
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-3">User Information</h3>
                <div className="space-y-2 text-sm">
                  <p><span className="font-medium">User ID:</span> {user?.id}</p>
                  <p><span className="font-medium">Email Confirmed:</span> {user?.email_confirmed_at ? 'Yes' : 'No'}</p>
                  <p><span className="font-medium">Created:</span> {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown'}</p>
                </div>
              </div>

              <div className="flex justify-center pt-4">
                <Button onClick={signOut} variant="outline">
                  Sign Out
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
