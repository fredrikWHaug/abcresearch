import React, { useState } from 'react'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { AuthForm } from '@/components/auth/AuthForm'
import { Dashboard } from '@/components/Dashboard'
import { EntryChoice } from '@/components/EntryChoice'
import { CreateProjectModal } from '@/components/CreateProjectModal'
import { createProject } from '@/services/projectService'
import '@/utils/runMigration' // Makes window.runMigration() available in console

function AppContent() {
  const { user, loading, isGuest } = useAuth()
  const [hasChosenEntry, setHasChosenEntry] = useState(false)
  const [showSavedMaps, setShowSavedMaps] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [projectId, setProjectId] = useState<number | null>(null)
  const [creatingProject, setCreatingProject] = useState(false)

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
          onConfirm={async (name) => {
            console.log('🟢 [App] CreateProjectModal onConfirm called with name:', name)
            console.log('🟢 [App] Current user state:', { user: !!user, isGuest })
            
            // Block guest users from creating projects
            if (isGuest) {
              console.warn('⚠️ [App] Guest users cannot create projects')
              alert('Guest users cannot create projects. Please sign up or sign in to create projects.')
              return
            }
            
            try {
              setCreatingProject(true)
              console.log('🟢 [App] Calling createProject service...')
              
              // Save project to database
              const project = await createProject(name)
              
              console.log('✅ [App] Project created successfully:', project)
              
              // Set project state
              setProjectName(project.name)
              setProjectId(project.id)
              setShowCreateModal(false)
              setShowSavedMaps(false)
              setHasChosenEntry(true)
            } catch (error) {
              console.error('❌ [App] Error creating project:', error)
              
              const errorMessage = error instanceof Error ? error.message : 'Unknown error'
              alert(`Failed to create project: ${errorMessage}\n\nPlease check the browser console for more details.`)
            } finally {
              setCreatingProject(false)
            }
          }}
        />
      </>
    )
  }

  // Show dashboard with saved maps preference and project ID
  return (
    <Dashboard 
      initialShowSavedMaps={showSavedMaps} 
      projectName={projectName}
      projectId={projectId}
    />
  )
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
