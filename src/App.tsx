import React from 'react'
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { AuthForm } from '@/components/auth/AuthForm'
import { Dashboard } from '@/components/Dashboard'
import { AppShell } from '@/components/AppShell'
import { ProjectsHomePage } from '@/components/ProjectsHomePage'
import '@/utils/runMigration' // Makes window.runMigration() available in console

// Protected route wrapper for authenticated users
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isGuest } = useAuth()

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

  if (!user && !isGuest) {
    return <Navigate to="/auth" replace />
  }

  return <>{children}</>
}

// Guest redirect - guests shouldn't access home page, send them to Dashboard
function GuestRedirect({ children }: { children: React.ReactNode }) {
  const { isGuest } = useAuth()
  
  if (isGuest) {
    return <Navigate to="/app/project/null" replace />
  }
  
  return <>{children}</>
}

// Root redirect - sends to appropriate page based on auth status
function RootRedirect() {
  const { user, loading, isGuest } = useAuth()

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

  // Guest users go directly to Dashboard (original fix - bypass project selection)
  if (isGuest) {
    return <Navigate to="/app/project/null" replace />
  }

  // Authenticated users go to home page (project cards)
  if (user) {
    return <Navigate to="/app/home" replace />
  }

  // Not authenticated - show auth form
  return <Navigate to="/auth" replace />
}

// Project route wrapper - passes project ID to Dashboard
function ProjectRoute() {
  const { projectId } = useParams<{ projectId: string }>()
  
  // Convert string projectId to number, or null if not provided or "null" string
  const numericProjectId = projectId && projectId !== 'null' ? parseInt(projectId, 10) : null

  return <Dashboard projectId={numericProjectId} />
}

function AppContent() {
  return (
    <Routes>
      {/* Root - redirect based on auth status */}
      <Route path="/" element={<RootRedirect />} />

      {/* Auth route */}
      <Route path="/auth" element={<AuthForm />} />

      {/* Protected app routes */}
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        {/* Projects home page - redirect guests to Dashboard */}
        <Route 
          path="home" 
          element={
            <GuestRedirect>
              <ProjectsHomePage />
            </GuestRedirect>
          } 
        />

        {/* Individual project view */}
        <Route path="project/:projectId" element={<ProjectRoute />} />

        {/* Redirect /app to /app/home */}
        <Route index element={<Navigate to="/app/home" replace />} />
      </Route>

      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
