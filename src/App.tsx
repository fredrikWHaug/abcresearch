import React, { useState } from 'react'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { AuthForm } from '@/components/auth/AuthForm'
import { Dashboard } from '@/components/Dashboard'
import { EntryChoice } from '@/components/EntryChoice'

function AppContent() {
  const { user, loading, isGuest } = useAuth()
  const [hasChosenEntry, setHasChosenEntry] = useState(false)
  const [showSavedMaps, setShowSavedMaps] = useState(false)

  // Reset entry choice when user logs out
  React.useEffect(() => {
    if (!user && !isGuest) {
      setHasChosenEntry(false)
      setShowSavedMaps(false)
    }
  }, [user, isGuest])

  // Debug logging
  console.log('App render:', { user: !!user, loading, isGuest, shouldShowDashboard: !!(user || isGuest) })

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

  // If not authenticated, show auth form
  if (!user && !isGuest) {
    return <AuthForm />
  }

  // If authenticated but hasn't chosen entry, show entry choice
  if (!hasChosenEntry) {
    return (
      <EntryChoice
        onOpenExisting={() => {
          setShowSavedMaps(true)
          setHasChosenEntry(true)
        }}
        onStartNew={() => {
          setShowSavedMaps(false)
          setHasChosenEntry(true)
        }}
      />
    )
  }

  // Show dashboard with saved maps preference
  return <Dashboard initialShowSavedMaps={showSavedMaps} />
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
