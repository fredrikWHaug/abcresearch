/**
 * Integration Tests: Project Management
 *
 * These tests verify the complete project CRUD flow:
 * - Creating new projects
 * - Loading user projects
 * - Updating project details
 * - Deleting projects
 * - Saving and loading chat history
 * - Project switching
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  createProject,
  getUserProjects,
  getProject,
  updateProject,
  deleteProject,
  saveChatHistory,
  loadChatHistory,
} from '@/services/projectService'
import { supabase } from '@/lib/supabase'

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
      getSession: vi.fn(),
    },
    from: vi.fn(),
  },
}))

describe('Project Management - Create Project', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should create a new project with name and description', async () => {
    // Given: Authenticated user
    const mockUser = { id: 'user-123', email: 'test@example.com' }
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any)

    const mockProject = {
      id: 1,
      user_id: 'user-123',
      name: 'My Research Project',
      description: 'Testing diabetes drugs',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    }

    const mockFrom = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockProject, error: null }),
    }

    vi.mocked(supabase.from).mockReturnValue(mockFrom as any)

    // When: Creating a project
    const result = await createProject('My Research Project', 'Testing diabetes drugs')

    // Then: Should return the created project
    expect(result).toEqual(mockProject)
    expect(supabase.from).toHaveBeenCalledWith('projects')
    expect(mockFrom.insert).toHaveBeenCalledWith([
      {
        name: 'My Research Project',
        description: 'Testing diabetes drugs',
        user_id: 'user-123',
      },
    ])
  })

  it('should create a project without description', async () => {
    // Given: Authenticated user
    const mockUser = { id: 'user-456', email: 'test@example.com' }
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any)

    const mockProject = {
      id: 2,
      user_id: 'user-456',
      name: 'Quick Project',
      created_at: '2024-01-02T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
    }

    const mockFrom = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockProject, error: null }),
    }

    vi.mocked(supabase.from).mockReturnValue(mockFrom as any)

    // When: Creating a project without description
    const result = await createProject('Quick Project')

    // Then: Should create project with no description
    expect(result.name).toBe('Quick Project')
    expect(result.description).toBeUndefined()
  })

  it('should throw error when user is not authenticated', async () => {
    // Given: No authenticated user
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: null },
      error: null,
    } as any)

    // When/Then: Should throw authentication error
    await expect(createProject('Test Project')).rejects.toThrow(
      'User must be authenticated to create a project'
    )
  })

  it('should throw error when database operation fails', async () => {
    // Given: Authenticated user but DB error
    const mockUser = { id: 'user-789', email: 'test@example.com' }
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any)

    const mockFrom = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' },
      }),
    }

    vi.mocked(supabase.from).mockReturnValue(mockFrom as any)

    // When/Then: Should throw database error
    await expect(createProject('Test Project')).rejects.toThrow()
  })
})

describe('Project Management - Get Projects', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fetch all projects for authenticated user', async () => {
    // Given: Authenticated user with projects
    const mockUser = { id: 'user-123', email: 'test@example.com' }
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any)

    const mockProjects = [
      {
        id: 1,
        user_id: 'user-123',
        name: 'Project A',
        description: 'First project',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-03T00:00:00Z',
      },
      {
        id: 2,
        user_id: 'user-123',
        name: 'Project B',
        description: 'Second project',
        created_at: '2024-01-02T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
      },
    ]

    const mockFrom = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockProjects, error: null }),
    }

    vi.mocked(supabase.from).mockReturnValue(mockFrom as any)

    // When: Fetching user projects
    const result = await getUserProjects()

    // Then: Should return all user projects
    expect(result).toEqual(mockProjects)
    expect(mockFrom.select).toHaveBeenCalledWith('*')
    expect(mockFrom.eq).toHaveBeenCalledWith('user_id', 'user-123')
    expect(mockFrom.order).toHaveBeenCalledWith('updated_at', { ascending: false })
  })

  it('should return empty array when user has no projects', async () => {
    // Given: Authenticated user with no projects
    const mockUser = { id: 'user-new', email: 'new@example.com' }
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any)

    const mockFrom = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    }

    vi.mocked(supabase.from).mockReturnValue(mockFrom as any)

    // When: Fetching projects
    const result = await getUserProjects()

    // Then: Should return empty array
    expect(result).toEqual([])
  })

  it('should order projects by most recently updated first', async () => {
    // Given: Multiple projects with different update times
    const mockUser = { id: 'user-123', email: 'test@example.com' }
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any)

    const mockFrom = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockImplementation((field, options) => {
        expect(field).toBe('updated_at')
        expect(options.ascending).toBe(false)
        return Promise.resolve({ data: [], error: null })
      }),
    }

    vi.mocked(supabase.from).mockReturnValue(mockFrom as any)

    // When: Fetching projects
    await getUserProjects()

    // Then: Should order by updated_at descending
    expect(mockFrom.order).toHaveBeenCalledWith('updated_at', { ascending: false })
  })
})

describe('Project Management - Get Single Project', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fetch a specific project by ID', async () => {
    // Given: Project exists in database
    const mockProject = {
      id: 42,
      user_id: 'user-123',
      name: 'Specific Project',
      description: 'Test description',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    }

    const mockFrom = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockProject, error: null }),
    }

    vi.mocked(supabase.from).mockReturnValue(mockFrom as any)

    // When: Fetching project by ID
    const result = await getProject(42)

    // Then: Should return the specific project
    expect(result).toEqual(mockProject)
    expect(mockFrom.eq).toHaveBeenCalledWith('id', 42)
  })

  it('should return null when project does not exist', async () => {
    // Given: Project not found
    const mockFrom = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      }),
    }

    vi.mocked(supabase.from).mockReturnValue(mockFrom as any)

    // When: Fetching non-existent project
    const result = await getProject(999)

    // Then: Should return null
    expect(result).toBeNull()
  })
})

describe('Project Management - Update Project', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should update project name', async () => {
    // Given: Existing project
    const updatedProject = {
      id: 1,
      user_id: 'user-123',
      name: 'Updated Name',
      description: 'Original description',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-05T00:00:00Z',
    }

    const mockFrom = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: updatedProject, error: null }),
    }

    vi.mocked(supabase.from).mockReturnValue(mockFrom as any)

    // When: Updating project name
    const result = await updateProject(1, { name: 'Updated Name' })

    // Then: Should return updated project
    expect(result.name).toBe('Updated Name')
    expect(mockFrom.update).toHaveBeenCalled()
    expect(mockFrom.eq).toHaveBeenCalledWith('id', 1)
  })

  it('should update project description', async () => {
    // Given: Existing project
    const updatedProject = {
      id: 2,
      user_id: 'user-123',
      name: 'Project Name',
      description: 'New description',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-05T00:00:00Z',
    }

    const mockFrom = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: updatedProject, error: null }),
    }

    vi.mocked(supabase.from).mockReturnValue(mockFrom as any)

    // When: Updating description
    const result = await updateProject(2, { description: 'New description' })

    // Then: Should update description
    expect(result.description).toBe('New description')
  })

  it('should update both name and description', async () => {
    // Given: Existing project
    const updatedProject = {
      id: 3,
      user_id: 'user-123',
      name: 'Completely New Name',
      description: 'Completely new description',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-05T00:00:00Z',
    }

    const mockFrom = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: updatedProject, error: null }),
    }

    vi.mocked(supabase.from).mockReturnValue(mockFrom as any)

    // When: Updating both fields
    const result = await updateProject(3, {
      name: 'Completely New Name',
      description: 'Completely new description',
    })

    // Then: Should update both fields
    expect(result.name).toBe('Completely New Name')
    expect(result.description).toBe('Completely new description')
  })

  it('should update the updated_at timestamp', async () => {
    // Given: Project being updated
    let capturedUpdate: any = null

    const mockFrom = {
      update: vi.fn().mockImplementation((updates) => {
        capturedUpdate = updates
        return mockFrom
      }),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 1, updated_at: '2024-01-05T00:00:00Z' },
        error: null,
      }),
    }

    vi.mocked(supabase.from).mockReturnValue(mockFrom as any)

    // When: Updating project
    await updateProject(1, { name: 'New Name' })

    // Then: Should include updated_at timestamp
    expect(capturedUpdate).toHaveProperty('updated_at')
    expect(capturedUpdate.updated_at).toBeTruthy()
  })
})

describe('Project Management - Delete Project', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should delete a project by ID', async () => {
    // Given: Existing project
    const mockFrom = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    }

    vi.mocked(supabase.from).mockReturnValue(mockFrom as any)

    // When: Deleting project
    await deleteProject(123)

    // Then: Should call delete with correct ID
    expect(supabase.from).toHaveBeenCalledWith('projects')
    expect(mockFrom.delete).toHaveBeenCalled()
    expect(mockFrom.eq).toHaveBeenCalledWith('id', 123)
  })

  it('should throw error when delete fails', async () => {
    // Given: Delete operation fails
    const mockFrom = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        error: { message: 'Cannot delete project' },
      }),
    }

    vi.mocked(supabase.from).mockReturnValue(mockFrom as any)

    // When/Then: Should throw error
    await expect(deleteProject(456)).rejects.toThrow()
  })
})

describe('Project Management - Chat History', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should save chat history to project', async () => {
    // Given: Project with chat messages
    const chatHistory = [
      { type: 'user', message: 'Hello' },
      { type: 'assistant', message: 'Hi there!' },
    ]

    const mockFrom = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    }

    vi.mocked(supabase.from).mockReturnValue(mockFrom as any)

    // When: Saving chat history
    await saveChatHistory(1, chatHistory)

    // Then: Should update project with chat history
    expect(mockFrom.update).toHaveBeenCalledWith(
      expect.objectContaining({
        chat_history: chatHistory,
      })
    )
    expect(mockFrom.eq).toHaveBeenCalledWith('id', 1)
  })

  it('should load chat history from project', async () => {
    // Given: Project with saved chat history
    const savedChatHistory = [
      { type: 'user', message: 'Previous conversation' },
      { type: 'assistant', message: 'Response' },
    ]

    const mockProject = {
      id: 1,
      chat_history: savedChatHistory,
    }

    const mockFrom = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockProject, error: null }),
    }

    vi.mocked(supabase.from).mockReturnValue(mockFrom as any)

    // When: Loading chat history
    const result = await loadChatHistory(1)

    // Then: Should return saved chat history
    expect(result).toEqual(savedChatHistory)
  })

  it('should return empty array when no chat history exists', async () => {
    // Given: Project without chat history
    const mockProject = {
      id: 1,
      chat_history: null,
    }

    const mockFrom = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockProject, error: null }),
    }

    vi.mocked(supabase.from).mockReturnValue(mockFrom as any)

    // When: Loading chat history
    const result = await loadChatHistory(1)

    // Then: Should return empty array
    expect(result).toEqual([])
  })
})
