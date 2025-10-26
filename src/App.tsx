import React, { useState } from 'react'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { AuthForm } from '@/components/auth/AuthForm'
import { Dashboard } from '@/components/Dashboard'
import { EntryChoice } from '@/components/EntryChoice'
import { CreateProjectModal } from '@/components/CreateProjectModal'

function AppContent() {
  const { user, loading, isGuest } = useAuth()
  const [hasChosenEntry, setHasChosenEntry] = useState(false)
  const [showSavedMaps, setShowSavedMaps] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [projectName, setProjectName] = useState('')

  // Reset entry choice when user logs out
  React.useEffect(() => {
    if (!user && !isGuest) {
      setHasChosenEntry(false)
      setShowSavedMaps(false)
      setProjectName('')
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
      <>
        <EntryChoice
          onOpenExisting={() => {
            setShowSavedMaps(true)
            setHasChosenEntry(true)
          }}
          onStartNew={() => {
            setShowCreateModal(true)
          }}
        />
        
        <CreateProjectModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onConfirm={(name) => {
            setProjectName(name)
            setShowCreateModal(false)
            setShowSavedMaps(false)
            setHasChosenEntry(true)
          }}
        />
      </>
    )
  }

  // Show dashboard with saved maps preference
  return <Dashboard initialShowSavedMaps={showSavedMaps} projectName={projectName} />
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
