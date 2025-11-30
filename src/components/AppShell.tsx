import React, { useState, useEffect, useRef } from 'react'
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Home, LogOut, ChevronRight, User, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { id: 'research', label: 'Research' },
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'marketmap', label: 'Market Map' },
  { id: 'extraction', label: 'Extraction' },
  { id: 'feed', label: 'Feed' },
] as const

export function AppShell() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, signOut, isGuest, exitGuestMode } = useAuth()
  
  // Detect if we're on a project route
  const projectRouteMatch = location.pathname.match(/^\/app\/project\/([^/]+)(?:\/(.+))?/)
  const projectId = projectRouteMatch ? projectRouteMatch[1] : null
  const currentView = projectRouteMatch ? projectRouteMatch[2] || 'research' : null
  const isProjectPage = !!projectId

  const [projectName, setProjectName] = useState<string | null>(null)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  // Click outside handler for user menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  useEffect(() => {
    async function fetchProjectName() {
      if (projectId) {
        try {
          // Dynamically import to avoid circular dependencies if any
          const { getProject } = await import('@/services/projectService')
          const project = await getProject(parseInt(projectId))
          if (project) {
            setProjectName(project.name)
          }
        } catch (error) {
          console.error('Error fetching project name:', error)
        }
      } else {
        setProjectName(null)
      }
    }

    fetchProjectName()
  }, [projectId])

  return (
    <div className="h-screen flex flex-col bg-gray-50/50 overflow-hidden font-sans text-foreground antialiased selection:bg-primary/20 selection:text-primary">
      {/* Top Navigation Bar */}
      <nav className="shrink-0 bg-white/70 backdrop-blur-xl border-b border-white/20 shadow-sm z-50 sticky top-0 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between relative">
          {/* Left: Logo/Home Button */}
          <div className="flex items-center gap-4">
            <Link
              to="/app/home"
              className="group flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 transition-opacity hover:opacity-80"
            >
              <span className="bg-linear-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                ABCresearch
              </span>
            </Link>

            {isProjectPage && (
              <div className="hidden md:flex items-center gap-1 ml-4 rounded-full bg-blue-50/30 p-1.5 border border-blue-100/50 shadow-inner backdrop-blur-sm h-[46px]">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/app/home')}
                  className="rounded-full hover:bg-white/60 text-gray-600 hover:text-gray-900 h-full px-4 font-medium hover:shadow-sm transition-all"
                >
                  <span className="hidden sm:inline">Home</span>
                </Button>
                
                {projectName && (
                  <>
                    <ChevronRight className="h-4 w-4 text-blue-200" />
                    <div 
                      className="flex items-center px-4 h-full bg-white shadow-sm border border-blue-100 rounded-full max-w-[200px] transition-all duration-300 hover:max-w-[400px] group/name relative"
                      title={projectName}
                    >
                      <span className="text-sm font-semibold text-gray-800 truncate group-hover/name:whitespace-normal group-hover/name:overflow-visible group-hover/name:bg-white z-10">
                        {projectName.length > 20 ? `${projectName.substring(0, 20)}...` : projectName}
                      </span>
                      
                    {/* Full name tooltip on hover if truncated */}
                    {projectName.length > 20 && (
                      <div className="absolute left-0 top-full mt-2 hidden group-hover/name:block min-w-max px-3 py-1.5 bg-gray-900 text-white text-xs rounded-full shadow-lg z-50 whitespace-nowrap animate-in fade-in zoom-in-95 duration-200">
                        {projectName}
                      </div>
                    )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Center: Project View Tabs (only show when on a project page) */}
          {isProjectPage && (
            <div className="hidden md:flex rounded-full bg-gray-100/50 p-1.5 gap-1 border border-black/5 shadow-inner backdrop-blur-sm h-[46px] items-center">
              {NAV_ITEMS.map((item) => (
                <Button
                  key={item.id}
                  variant="ghost"
                  onClick={() => navigate(`/app/project/${projectId}/${item.id}`)}
                  className={cn(
                    "rounded-full px-5 h-full text-sm font-medium transition-all duration-300 ease-out",
                    currentView === item.id
                      ? "bg-white text-gray-900 shadow-sm hover:bg-white"
                      : "text-gray-500 hover:text-gray-900 hover:bg-white/50"
                  )}
                >
                  {item.label}
                </Button>
              ))}
            </div>
          )}

          {/* Right: User Menu */}
          <div className="flex items-center gap-3">
            
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

            {/* Authenticated User: Show email and Sign Out Menu */}
            {user && !isGuest && (
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-2 px-2 md:px-4 py-1.5 bg-gray-100/80 border border-gray-200/50 rounded-full backdrop-blur-sm hover:bg-white/80 hover:shadow-sm transition-all cursor-pointer group"
                >
                  <div className="hidden md:block h-2 w-2 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                  <User className="md:hidden h-4 w-4 text-gray-600" />
                  <span className="hidden md:block text-sm text-gray-700 font-medium group-hover:text-gray-900">
                    {user.email?.split('@')[0]}
                  </span>
                  <ChevronDown className={cn(
                    "h-3 w-3 text-gray-400 transition-transform duration-200",
                    isUserMenuOpen ? "rotate-180" : ""
                  )} />
                </button>

                {/* Dropdown Menu */}
                {isUserMenuOpen && (
                  <div className="absolute top-full right-0 mt-2 w-48 bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 py-1 z-50 animate-in fade-in zoom-in-95 origin-top-right duration-200">
                    <div className="px-4 py-2 border-b border-gray-100 block md:hidden">
                      <p className="text-xs text-gray-500">Signed in as</p>
                      <p className="text-sm font-medium text-gray-900 truncate">{user.email}</p>
                    </div>
                    <div className="p-1">
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setIsUserMenuOpen(false)
                          signOut()
                        }}
                        className="w-full justify-start px-3 py-2 text-gray-600 hover:text-red-600 hover:bg-red-50/50 rounded-xl h-auto font-normal"
                      >
                        <LogOut className="h-4 w-4 mr-2" />
                        Sign Out
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content Area - fills remaining height and allows scrolling */}
      <main className="flex-1 min-h-0 overflow-y-auto scroll-smooth">
        <div className="animate-in fade-in duration-500 h-full">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

