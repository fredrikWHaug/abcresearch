import React from 'react'
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { AuthForm } from '@/components/auth/AuthForm'
import { Dashboard } from '@/components/Dashboard'
import { AppShell } from '@/components/AppShell'
import { ProjectsHomePage } from '@/components/ProjectsHomePage'
import { usePageTracking } from '@/hooks/usePageTracking'
import '@/utils/runMigration' // Makes window.runMigration() available in console

// Protected route wrapper for authenticated AND authorized users
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isAuthorized, authorizationChecked } = useAuth()

  // Show loading while checking auth
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

  // Not authenticated - redirect to auth
  if (!user) {
    return <Navigate to="/auth" replace />
  }

  // Authenticated but still checking authorization
  if (!authorizationChecked || isAuthorized === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Checking access...</p>
        </div>
      </div>
    )
  }

  // Authenticated but NOT authorized (no profile)
  if (!isAuthorized) {
    return <Navigate to="/unauthorized" replace />
  }

  // Authenticated AND authorized
  return <>{children}</>
}

// Unauthorized page - shown when user is authenticated but doesn't have a profile
function UnauthorizedPage() {
  const { user, signOut, isAuthorized, loading, authorizationChecked, logSession } = useAuth()

  // Log invite check failure when page is shown (only once per mount)
  React.useEffect(() => {
    if (user && authorizationChecked && !isAuthorized) {
      logSession('invite_check_failed', {
        user_email: user.email,
        reason: 'authenticated_but_no_profile',
      })
    }
  }, [user, authorizationChecked, isAuthorized, logSession])

  // If not authenticated, redirect to auth
  if (!loading && !user) {
    return <Navigate to="/auth" replace />
  }

  // If authorized, redirect to home
  if (authorizationChecked && isAuthorized) {
    return <Navigate to="/app/home" replace />
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 h-16 w-16 rounded-full bg-yellow-100 flex items-center justify-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8 text-yellow-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold mb-2">Invite Only</h1>
        <p className="text-muted-foreground mb-6">
          ABCresearch is currently invite-only. Your email is not on the invite list.
          Please contact the administrator for access.
        </p>
        {user && (
          <p className="text-sm text-muted-foreground mb-6">
            Signed in as: {user.email}
          </p>
        )}
        <button
          onClick={() => signOut()}
          className="w-full px-4 py-2 border border-border rounded-md hover:bg-muted transition-colors"
        >
          Sign Out
        </button>
      </div>
    </div>
  )
}

// Root redirect - sends to appropriate page based on auth status
function RootRedirect() {
  const { user, loading, isAuthorized, authorizationChecked } = useAuth()

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

  // Not authenticated - show auth form
  if (!user) {
    return <Navigate to="/auth" replace />
  }

  // Authenticated but still checking authorization
  if (!authorizationChecked || isAuthorized === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Checking access...</p>
        </div>
      </div>
    )
  }

  // Authenticated but not authorized
  if (!isAuthorized) {
    return <Navigate to="/unauthorized" replace />
  }

  // Authenticated and authorized - go to home
  return <Navigate to="/app/home" replace />
}

// Project route wrapper - passes project ID and view mode to Dashboard
function ProjectRoute({ view = 'research' }: { view?: string }) {
  const { projectId } = useParams<{ projectId: string }>()
  
  // Convert string projectId to number, or null if not provided or "null" string
  const numericProjectId = projectId && projectId !== 'null' ? parseInt(projectId, 10) : null

  // Hide Dashboard's internal header since AppShell now handles everything
  return <Dashboard projectId={numericProjectId} showHeader={false} insideAppShell={true} initialView={view} />
}

// Auth route wrapper - redirects if already authenticated and authorized
function AuthRoute() {
  const { user, loading, isAuthorized, authorizationChecked } = useAuth()

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

  // If authenticated, check authorization
  if (user) {
    // Still checking authorization
    if (!authorizationChecked || isAuthorized === null) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Checking access...</p>
          </div>
        </div>
      )
    }
    
    // Authorized - redirect to home
    if (isAuthorized) {
      return <Navigate to="/app/home" replace />
    }
    
    // Not authorized - redirect to unauthorized page
    return <Navigate to="/unauthorized" replace />
  }

  // Not authenticated - show auth form
  return <AuthForm />
}

// Page tracking wrapper component
function PageTrackingWrapper({ children }: { children: React.ReactNode }) {
  usePageTracking()
  return <>{children}</>
}

function AppContent() {
  return (
    <PageTrackingWrapper>
      <Routes>
      {/* Root - redirect based on auth status */}
      <Route path="/" element={<RootRedirect />} />

      {/* Auth route - redirects if already authenticated */}
      <Route path="/auth" element={<AuthRoute />} />

      {/* Unauthorized page - for authenticated users without profile */}
      <Route path="/unauthorized" element={<UnauthorizedPage />} />

      {/* Protected app routes */}
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        {/* Projects home page */}
        <Route path="home" element={<ProjectsHomePage />} />

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
    </PageTrackingWrapper>
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
