import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { getUserProjects, createProject } from '@/services/projectService'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, FolderOpen, Calendar, ArrowRight } from 'lucide-react'
import { CreateProjectModal } from '@/components/CreateProjectModal'
import { AnimatedGradientBackground } from '@/components/AnimatedGradientBackground'
import { motion } from 'framer-motion'

const MotionCard = motion(Card)

interface Project {
  id: number
  name: string
  created_at: string
  updated_at: string
}

// Skeleton loader for project cards
function ProjectCardSkeleton() {
  return (
    <Card className="border border-white/50 bg-white/50 backdrop-blur-xl shadow-lg">
      <CardHeader className="h-48 flex flex-col justify-between">
        <div>
          <div className="rounded-lg bg-gray-200/70 h-12 w-12 mb-4 animate-pulse" />
          <div className="h-5 bg-gray-200/70 rounded w-3/4 mb-2 animate-pulse" />
          <div className="h-4 bg-gray-200/70 rounded w-1/2 animate-pulse" />
        </div>
        <div className="h-3 bg-gray-200/70 rounded w-24 animate-pulse" />
      </CardHeader>
    </Card>
  )
}

export function ProjectsHomePage() {
  const navigate = useNavigate()
  const { isGuest } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)

  useEffect(() => {
    // Only load projects for authenticated users, not guests
    if (!isGuest) {
      loadProjects()
    } else {
      // For guest users, just stop loading and show empty state
      setLoading(false)
    }
  }, [isGuest])

  async function loadProjects() {
    try {
      setLoading(true)
      const allProjects = await getUserProjects()
      setProjects(allProjects)
    } catch (error) {
      console.error('Error loading projects:', error)
      // On error, show empty state
      setProjects([])
    } finally {
      setLoading(false)
    }
  }

  function handleProjectClick(projectId: number) {
    navigate(`/app/project/${projectId}`)
  }

  async function handleCreateProject(name: string) {
    if (isGuest) {
      alert('Guest users cannot create projects. Please sign up or sign in to create projects.')
      return
    }

    try {
      const project = await createProject(name)
      setShowCreateModal(false)
      // Reload projects to show the new one
      await loadProjects()
      // Navigate to the new project
      navigate(`/app/project/${project.id}`)
    } catch (error) {
      console.error('Error creating project:', error)
      alert(`Failed to create project: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  return (
    <div className="h-full flex flex-col relative">
      {/* Animated Gradient Background */}
      <AnimatedGradientBackground />

      {/* Empty State - Centered when no projects */}
      {!loading && projects.length === 0 && (
        <div className="flex-1 flex items-center justify-center px-6 relative z-10">
          <div className="text-center bg-white/70 backdrop-blur-xl rounded-3xl p-12 shadow-2xl border border-white/50">
            <div className="relative inline-block mb-8">
              <div className="absolute inset-0 bg-blue-100 rounded-full blur-3xl opacity-30" />
              <div className="relative rounded-full bg-linear-to-br from-blue-50 to-indigo-50 p-8 w-fit mx-auto">
                <FolderOpen className="h-16 w-16 text-blue-500" />
              </div>
            </div>
            <h3 className="text-2xl font-semibold text-gray-900 mb-3">
              {isGuest ? 'Welcome, Guest!' : 'No projects yet'}
            </h3>
            <p className="text-gray-500 text-lg mb-8 max-w-md mx-auto">
              {isGuest 
                ? 'Sign up to create projects and save your research for later' 
                : 'Create your first project to start researching clinical trials and academic papers'}
            </p>
            {!isGuest && (
              <Button 
                onClick={() => setShowCreateModal(true)} 
                size="lg"
                className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow-md transition-all"
              >
                <Plus className="h-5 w-5 mr-2" />
                Create Your First Project
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Projects Grid - Only show when we have projects OR loading */}
      {(loading || projects.length > 0) && (
        <div className="px-6 py-10 max-w-7xl mx-auto w-full relative z-10">
          {/* Header with frosted glass effect */}
          <div className="mb-10 bg-white/60 backdrop-blur-lg rounded-2xl p-6 shadow-lg border border-white/50">
            <h1 className="text-4xl font-bold text-gray-900 mb-3">
              Your Projects
            </h1>
            <p className="text-gray-600 text-lg">
              {loading ? (
                'Loading...'
              ) : (
                `${projects.length} project${projects.length === 1 ? '' : 's'}`
              )}
            </p>
          </div>

          {/* Loading State - Skeleton Grid */}
          {loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              <ProjectCardSkeleton />
              <ProjectCardSkeleton />
              <ProjectCardSkeleton />
              <ProjectCardSkeleton />
            </div>
          )}

          {/* Projects Grid */}
          {!loading && projects.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {/* Create New Project Card */}
              <MotionCard
                className="border-2 border-dashed border-white/40 hover:border-blue-400/60 hover:shadow-2xl bg-white/40 backdrop-blur-xl cursor-pointer group relative overflow-hidden"
                onClick={() => setShowCreateModal(true)}
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                <CardHeader className="flex flex-col items-center justify-center h-48 text-center relative z-10">
                  <div className="rounded-full bg-blue-100/60 backdrop-blur-sm p-4 mb-4 group-hover:bg-blue-200/70 group-hover:scale-110 transition-all duration-300 shadow-lg">
                    <Plus className="h-8 w-8 text-blue-600" />
                  </div>
                  <CardTitle className="text-lg font-semibold text-gray-900 mb-1">
                    Create New Project
                  </CardTitle>
                  <CardDescription className="text-gray-600">
                    Start a fresh research project
                  </CardDescription>
                </CardHeader>
                {/* Subtle gradient on hover */}
                <div className="absolute inset-0 bg-linear-to-br from-blue-100/0 to-blue-100/0 group-hover:from-blue-100/40 group-hover:to-purple-100/30 transition-all duration-300 pointer-events-none" />
              </MotionCard>

              {/* Existing Project Cards */}
              {projects.map((project) => (
                <MotionCard
                  key={project.id}
                  className="group border border-white/50 hover:border-white/70 hover:shadow-2xl bg-white/50 backdrop-blur-xl cursor-pointer relative overflow-hidden"
                  onClick={() => handleProjectClick(project.id)}
                  whileHover={{ scale: 1.05, y: -5 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                >
                  <CardHeader className="h-48 flex flex-col justify-between p-6 relative z-10">
                    <div>
                      <div className="rounded-xl bg-linear-to-br from-blue-100/70 to-indigo-100/70 backdrop-blur-sm p-2 w-fit mb-4 group-hover:from-blue-200/80 group-hover:to-indigo-200/80 transition-all duration-300 shadow-lg">
                        <FolderOpen className="h-5 w-5 text-blue-700" />
                      </div>
                      <CardTitle className="text-lg font-semibold text-gray-900 line-clamp-2 mb-2 group-hover:text-blue-700 transition-colors">
                        {project.name}
                      </CardTitle>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>
                          {new Date(project.updated_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </span>
                      </div>
                      <ArrowRight className="h-4 w-4 text-gray-500 group-hover:text-blue-700 group-hover:translate-x-2 transition-all" />
                    </div>
                  </CardHeader>
                  {/* Dynamic gradient overlay on hover */}
                  <div className="absolute inset-0 bg-linear-to-br from-blue-100/0 to-purple-100/0 group-hover:from-blue-100/30 group-hover:to-purple-100/30 transition-all duration-500 pointer-events-none" />
                </MotionCard>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Project Modal */}
      <CreateProjectModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onConfirm={handleCreateProject}
      />
    </div>
  )
}

