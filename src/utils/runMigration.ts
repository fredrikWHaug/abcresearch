/**
 * Admin utility to run database migrations
 * Can be called from browser console: window.runMigration()
 * Also exposes: window.supabase for manual queries
 */

import { migrateToNormalizedTables } from '@/scripts/migrateToNormalizedTables'
import { supabase } from '@/lib/supabase'

export async function runMigration() {
  console.log('[Migration] Starting migration from JSONB to normalized tables...')
  console.log('[Migration] This will take a few minutes depending on data volume')
  
  try {
    const result = await migrateToNormalizedTables()
    
    console.log('[Migration] ✅ Migration complete!')
    console.log(`[Migration] Migrated ${result.trials} trials and ${result.papers} papers`)
    
    if (result.errors.length > 0) {
      console.warn(`[Migration] ⚠️ ${result.errors.length} errors encountered:`)
      result.errors.forEach(err => console.warn(`  - ${err}`))
    }
    
    return result
  } catch (error) {
    console.error('[Migration] ❌ Migration failed:', error)
    throw error
  }
}

// Expose to window for console access
if (typeof window !== 'undefined') {
  (window as any).runMigration = runMigration;
  (window as any).supabase = supabase;
  console.log('[Migration Utility] Available commands:');
  console.log('  - window.runMigration() - Run migration from JSONB to normalized tables');
  console.log('  - window.supabase - Direct Supabase client for manual queries');
}

