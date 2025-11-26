/**
 * Test Environment Configuration
 * Provides test-specific environment setup
 */

// Ensure test environment variables are set
if (!process.env.VITE_SUPABASE_URL) {
  throw new Error(
    'VITE_SUPABASE_URL not set in test environment. ' +
    'Add it to .env.test or GitHub secrets for CI'
  )
}

if (!process.env.VITE_SUPABASE_ANON_KEY) {
  throw new Error(
    'VITE_SUPABASE_ANON_KEY not set in test environment. ' +
    'Add it to .env.test or GitHub secrets for CI'
  )
}

// Service role key is optional (for CI/CD to bypass RLS)
export const isCI = process.env.CI === 'true'
export const hasServiceRoleKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY

export const testConfig = {
  supabaseUrl: process.env.VITE_SUPABASE_URL,
  supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  isCI,
  hasServiceRoleKey,
  // Test data prefixes to identify test records
  testPrefix: 'TEST_',
  testUserEmail: 'test@abcresearch.local',
} as const

// Log configuration in CI for debugging
if (isCI) {
  console.log('Test Environment Configuration:', {
    hasSupabaseUrl: !!testConfig.supabaseUrl,
    hasAnonKey: !!testConfig.supabaseAnonKey,
    hasServiceRoleKey,
    isCI,
  })
}

