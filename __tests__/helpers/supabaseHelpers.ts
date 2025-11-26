/**
 * Supabase Test Helpers
 * Utilities for database operations in tests
 */

import { createClient } from '@supabase/supabase-js'
import { testConfig } from '../setup/testEnv'

/**
 * Get Supabase client for tests
 * Uses service role key if available (CI), otherwise anon key
 */
export function getTestSupabaseClient() {
  const key = testConfig.hasServiceRoleKey 
    ? testConfig.supabaseServiceRoleKey! 
    : testConfig.supabaseAnonKey

  return createClient(testConfig.supabaseUrl, key)
}

/**
 * Create a test user
 * Note: Requires service role key or authenticated session
 */
export async function createTestUser(overrides?: { email?: string; password?: string }) {
  const supabase = getTestSupabaseClient()
  
  const email = overrides?.email || `test-${Date.now()}@abcresearch.test`
  const password = overrides?.password || 'TestPassword123!'

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  })

  if (error) {
    throw new Error(`Failed to create test user: ${error.message}`)
  }

  return { user: data.user!, email, password }
}

/**
 * Create a test project
 */
export async function createTestProject(userId: string, overrides?: { name?: string; description?: string }) {
  const supabase = getTestSupabaseClient()

  const { data, error } = await supabase
    .from('projects')
    .insert({
      user_id: userId,
      name: overrides?.name || `${testConfig.testPrefix}Project ${Date.now()}`,
      description: overrides?.description || 'Test project',
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create test project: ${error.message}`)
  }

  return data
}

/**
 * Clean up test data by user ID
 */
export async function cleanupTestDataByUserId(userId: string) {
  const supabase = getTestSupabaseClient()

  // Delete in correct order (respecting foreign keys)
  await supabase.from('project_trials').delete().eq('project_id', userId)
  await supabase.from('project_papers').delete().eq('project_id', userId)
  await supabase.from('project_drugs').delete().eq('project_id', userId)
  await supabase.from('market_maps').delete().eq('user_id', userId)
  await supabase.from('projects').delete().eq('user_id', userId)
  
  // Note: User deletion requires service role key
  if (testConfig.hasServiceRoleKey) {
    await supabase.auth.admin.deleteUser(userId)
  }
}

/**
 * Clean up test project and related data
 */
export async function cleanupTestProject(projectId: number) {
  const supabase = getTestSupabaseClient()

  // Delete related data first
  await supabase.from('project_trials').delete().eq('project_id', projectId)
  await supabase.from('project_papers').delete().eq('project_id', projectId)
  await supabase.from('project_drugs').delete().eq('project_id', projectId)
  await supabase.from('market_maps').delete().eq('project_id', projectId)
  await supabase.from('projects').delete().eq('id', projectId)
}

/**
 * Clean up all test data (use with caution!)
 * Only deletes records with TEST_ prefix
 */
export async function cleanupAllTestData() {
  const supabase = getTestSupabaseClient()

  // Clean up projects with test prefix
  const { data: testProjects } = await supabase
    .from('projects')
    .select('id')
    .like('name', `${testConfig.testPrefix}%`)

  if (testProjects) {
    for (const project of testProjects) {
      await cleanupTestProject(project.id)
    }
  }
}

/**
 * Check if we can bypass RLS (have service role key)
 */
export function canBypassRLS() {
  return testConfig.hasServiceRoleKey
}

/**
 * Skip test if RLS bypass not available
 */
export function skipIfNoServiceRoleKey(test: () => void | Promise<void>) {
  if (!canBypassRLS()) {
    return () => {
      console.warn('Test skipped: Requires SUPABASE_SERVICE_ROLE_KEY')
    }
  }
  return test
}

