import React from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Home, LogOut } from 'lucide-react'

export function AppShell() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, signOut } = useAuth()
  const isHomePage = location.pathname === '/app/home'

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

          {/* Right: User Menu */}
          <div className="flex items-center gap-3">
            {!isHomePage && (
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

            {user && (
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

      {/* Main Content Area - fills remaining height */}
      <main className="flex-1 min-h-0 overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}

