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
    <div className="h-screen flex flex-col bg-gray-50/50 overflow-hidden font-sans text-foreground antialiased selection:bg-primary/20 selection:text-primary">
      {/* Top Navigation Bar */}
      <nav className="flex-shrink-0 bg-white/70 backdrop-blur-xl border-b border-white/20 shadow-sm z-50 sticky top-0 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          {/* Left: Logo/Home Button */}
          <button
            onClick={() => navigate('/app/home')}
            className="group flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 transition-opacity hover:opacity-80 cursor-pointer"
          >
            <span className="bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
              ABCresearch
            </span>
          </button>

          {/* Center: Project View Tabs (only show when on a project page) */}
          {isProjectPage && (
            <div className="hidden md:flex rounded-full bg-gray-100/50 p-1.5 gap-1 border border-black/5 shadow-inner backdrop-blur-sm">
              <button
                onClick={() => navigate(`/app/project/${projectId}/research`)}
                className={`py-2 px-5 rounded-full text-sm font-medium transition-all duration-300 ease-out whitespace-nowrap cursor-pointer ${
                  currentView === 'research'
                    ? 'bg-white text-gray-900 shadow-sm scale-100'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-white/50'
                }`}
              >
                Research
              </button>
              <button
                onClick={() => navigate(`/app/project/${projectId}/pipeline`)}
                className={`py-2 px-5 rounded-full text-sm font-medium transition-all duration-300 ease-out whitespace-nowrap cursor-pointer ${
                  currentView === 'pipeline'
                    ? 'bg-white text-gray-900 shadow-sm scale-100'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-white/50'
                }`}
              >
                Pipeline
              </button>
              <button
                onClick={() => navigate(`/app/project/${projectId}/marketmap`)}
                className={`py-2 px-5 rounded-full text-sm font-medium transition-all duration-300 ease-out whitespace-nowrap cursor-pointer ${
                  currentView === 'marketmap'
                    ? 'bg-white text-gray-900 shadow-sm scale-100'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-white/50'
                }`}
              >
                Market Map
              </button>
              <button
                onClick={() => navigate(`/app/project/${projectId}/extraction`)}
                className={`py-2 px-5 rounded-full text-sm font-medium transition-all duration-300 ease-out whitespace-nowrap cursor-pointer ${
                  currentView === 'extraction'
                    ? 'bg-white text-gray-900 shadow-sm scale-100'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-white/50'
                }`}
              >
                Extraction
              </button>
              <button
                onClick={() => navigate(`/app/project/${projectId}/feed`)}
                className={`py-2 px-5 rounded-full text-sm font-medium transition-all duration-300 ease-out whitespace-nowrap cursor-pointer ${
                  currentView === 'feed'
                    ? 'bg-white text-gray-900 shadow-sm scale-100'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-white/50'
                }`}
              >
                Feed
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
                className="rounded-full hover:bg-gray-100/80 text-gray-600"
              >
                <Home className="h-4 w-4" />
                <span className="hidden sm:inline ml-2">Home</span>
              </Button>
            )}

            {/* Guest Mode: Show Sign Up button */}
            {isGuest && (
              <>
                <div className="flex items-center gap-2 px-4 py-1.5 bg-amber-50/80 border border-amber-200/50 rounded-full backdrop-blur-sm">
                  <div className="h-2 w-2 bg-amber-500 rounded-full animate-pulse" />
                  <span className="text-xs text-amber-700 font-medium uppercase tracking-wide">
                    Guest
                  </span>
                </div>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    exitGuestMode()
                    navigate('/auth')
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-0.5"
                >
                  <span>Sign Up</span>
                </Button>
              </>
            )}

            {/* Authenticated User: Show email and Sign Out */}
            {user && !isGuest && (
              <>
                <div className="hidden md:flex items-center gap-2 px-4 py-1.5 bg-gray-100/80 border border-gray-200/50 rounded-full backdrop-blur-sm">
                  <div className="h-2 w-2 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                  <span className="text-sm text-gray-700 font-medium">
                    {user.email?.split('@')[0]}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={signOut}
                  className="rounded-full hover:bg-gray-100/80 text-gray-600 hover:text-red-600 transition-colors"
                >
                  <LogOut className="h-4 w-4 md:mr-2" />
                  <span className="hidden md:inline">Sign Out</span>
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content Area - fills remaining height and allows scrolling */}
      <main className="flex-1 min-h-0 overflow-y-auto scroll-smooth">
        <div className="animate-fade-in h-full">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

