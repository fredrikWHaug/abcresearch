import React from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Home, LogOut } from 'lucide-react'

export function AppShell() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, signOut, isGuest, exitGuestMode } = useAuth()
  const isHomePage = location.pathname === '/app/home'
  
  // Detect if we're on a project route
  const projectRouteMatch = location.pathname.match(/^\/app\/project\/([^/]+)(?:\/(.+))?/)
  const projectId = projectRouteMatch ? projectRouteMatch[1] : null
  const currentView = projectRouteMatch ? projectRouteMatch[2] || 'research' : null
  const isProjectPage = !!projectId

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* Top Navigation Bar */}
      <nav className="flex-shrink-0 border-b border-gray-200 bg-white shadow-sm backdrop-blur-sm bg-white/95">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          {/* Left: Logo/Home Button */}
          <button
            onClick={() => navigate('/app/home')}
            className="flex items-center gap-2 text-2xl font-bold text-gray-900 hover:text-blue-600 transition-colors"
          >
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              ABCresearch
            </span>
          </button>

          {/* Center: Project View Tabs (only show when on a project page) */}
          {isProjectPage && (
            <div className="flex rounded-lg bg-gray-100 p-1 gap-1">
              <button
                onClick={() => navigate(`/app/project/${projectId}/research`)}
                className={`py-2 px-4 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                  currentView === 'research'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Research
              </button>
              <button
                onClick={() => navigate(`/app/project/${projectId}/pipeline`)}
                className={`py-2 px-4 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                  currentView === 'pipeline'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Asset Pipeline
              </button>
              <button
                onClick={() => navigate(`/app/project/${projectId}/marketmap`)}
                className={`py-2 px-4 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                  currentView === 'marketmap'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Market Map
              </button>
              <button
                onClick={() => navigate(`/app/project/${projectId}/extraction`)}
                className={`py-2 px-4 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                  currentView === 'extraction'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Data Extraction
              </button>
              <button
                onClick={() => navigate(`/app/project/${projectId}/feed`)}
                className={`py-2 px-4 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                  currentView === 'feed'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Realtime Feed
              </button>
            </div>
          )}

          {/* Right: User Menu */}
          <div className="flex items-center gap-3">
            {!isHomePage && !isGuest && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/app/home')}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              >
                <Home className="h-4 w-4" />
                <span className="hidden sm:inline">Home</span>
              </Button>
            )}

            {/* Guest Mode: Show Sign Up button */}
            {isGuest && (
              <>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="h-2 w-2 bg-amber-500 rounded-full" />
                  <span className="text-sm text-amber-700 font-medium">
                    Guest Mode
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    exitGuestMode()
                    navigate('/auth')
                  }}
                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 font-medium"
                >
                  <span>Sign Up</span>
                </Button>
              </>
            )}

            {/* Authenticated User: Show email and Sign Out */}
            {user && !isGuest && (
              <>
                <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg">
                  <div className="h-2 w-2 bg-green-500 rounded-full" />
                  <span className="text-sm text-gray-700 font-medium">
                    {user.email?.split('@')[0]}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={signOut}
                  className="text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Sign Out</span>
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content Area - fills remaining height and allows scrolling */}
      <main className="flex-1 min-h-0 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}

