import React from 'react'
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { AuthForm } from '@/components/auth/AuthForm'
import { Dashboard } from '@/components/Dashboard'
import { AppShell } from '@/components/AppShell'
import { ProjectsHomePage } from '@/components/ProjectsHomePage'
import { AnalystPage } from '@/components/AnalystPage'
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

// Project route wrapper - passes project ID and view mode to Dashboard
function ProjectRoute({ view = 'research' }: { view?: string }) {
  const { projectId } = useParams<{ projectId: string }>()
  
  // Convert string projectId to number, or null if not provided or "null" string
  const numericProjectId = projectId && projectId !== 'null' ? parseInt(projectId, 10) : null

  // Hide Dashboard's internal header since AppShell now handles everything
  return <Dashboard projectId={numericProjectId} showHeader={false} insideAppShell={true} initialView={view} />
}

// Auth route wrapper - redirects if already authenticated
function AuthRoute() {
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

  // If guest, redirect to Dashboard
  if (isGuest) {
    return <Navigate to="/app/project/null" replace />
  }

  // If authenticated, redirect to home
  if (user) {
    return <Navigate to="/app/home" replace />
  }

  // Not authenticated - show auth form
  return <AuthForm />
}

function AppContent() {
  return (
    <Routes>
      {/* Root - redirect based on auth status */}
      <Route path="/" element={<RootRedirect />} />

      {/* Auth route - redirects if already authenticated */}
      <Route path="/auth" element={<AuthRoute />} />

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

        {/* Analyst page */}
        <Route 
          path="analyst" 
          element={
            <GuestRedirect>
              <AnalystPage />
            </GuestRedirect>
          } 
        />

        {/* Individual project views with sub-routes */}
        <Route path="project/:projectId">
          {/* Default to research view */}
          <Route index element={<Navigate to="research" replace />} />
          <Route path="research" element={<ProjectRoute view="research" />} />
          <Route path="pipeline" element={<ProjectRoute view="pipeline" />} />
          <Route path="marketmap" element={<ProjectRoute view="marketmap" />} />
          <Route path="extraction" element={<ProjectRoute view="dataextraction" />} />
          <Route path="feed" element={<ProjectRoute view="realtimefeed" />} />
        </Route>

        {/* Redirect /app to /app/home */}
        <Route index element={<Navigate to="/app/home" replace />} />
      </Route>

      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

// Export AppContent for testing (without BrowserRouter wrapper)
export { AppContent }

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
