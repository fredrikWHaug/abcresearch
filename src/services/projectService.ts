/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Project Service
 * Handles project CRUD operations in Supabase
 */

import { supabase } from '@/lib/supabase'

export interface Project {
  id: number
  user_id: string
  name: string
  description?: string
  chat_history?: any[] // Array of chat messages
  created_at: string
  updated_at: string
}

/**
 * Create a new project
 */
export async function createProject(name: string, description?: string): Promise<Project> {
  console.log('🔵 [ProjectService] Starting project creation:', { name, description })
  
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  console.log('🔵 [ProjectService] Auth check:', { 
    hasUser: !!user, 
    userId: user?.id,
    userError: userError?.message 
  })
  
  if (!user) {
    const errorMsg = 'User must be authenticated to create a project'
    console.error('❌ [ProjectService]', errorMsg)
    throw new Error(errorMsg)
  }

  console.log('🔵 [ProjectService] Inserting into database...')

  const { data, error } = await supabase
    .from('projects')
    .insert([
      {
        name,
        description,
        user_id: user.id
      }
    ])
    .select()
    .single()

  if (error) {
    console.error('❌ [ProjectService] Database error:', error)
    console.error('❌ [ProjectService] Error details:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code
    })
    throw error
  }

  console.log('✅ [ProjectService] Project created successfully:', data)
  return data
}

/**
 * Get all projects for the current user
 */
export async function getUserProjects(): Promise<Project[]> {
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    throw new Error('User must be authenticated')
  }

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('Error fetching projects:', error)
    throw error
  }

  return data || []
}

/**
 * Get a single project by ID
 */
export async function getProject(id: number): Promise<Project | null> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching project:', error)
    return null
  }

  return data
}

/**
 * Update a project
 */
export async function updateProject(id: number, updates: { name?: string, description?: string }): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating project:', error)
    throw error
  }

  return data
}

/**
 * Delete a project
 */
export async function deleteProject(id: number): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting project:', error)
    throw error
  }
}

/**
 * Save chat history for a project
 */
export async function saveChatHistory(projectId: number, chatHistory: any[]): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .update({
      chat_history: chatHistory,
      updated_at: new Date().toISOString()
    })
    .eq('id', projectId)

  if (error) {
    console.error('[ProjectService] Error saving chat history:', error)
    throw error
  }
}

/**
 * Load chat history for a project
 */
export async function loadChatHistory(projectId: number): Promise<any[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('chat_history')
    .eq('id', projectId)
    .single()

  if (error) {
    console.error('[ProjectService] Error loading chat history:', error)
    return []
  }

  return data?.chat_history || []
}

/**
 * Save search queries for a project
 */
export async function saveSearchQueries(
  projectId: number, 
  searchQueries: { 
    originalQuery: string
    strategies?: any[]
  } | null
): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .update({
      search_queries: searchQueries,
      updated_at: new Date().toISOString()
    })
    .eq('id', projectId)

  if (error) {
    console.error('[ProjectService] Error saving search queries:', error)
    throw error
  }
}

/**
 * Load search queries for a project
 */
export async function loadSearchQueries(projectId: number): Promise<{
  originalQuery: string
  strategies?: any[]
} | null> {
  const { data, error } = await supabase
    .from('projects')
    .select('search_queries')
    .eq('id', projectId)
    .single()

  if (error) {
    console.error('[ProjectService] Error loading search queries:', error)
    return null
  }

  return data?.search_queries || null
}

