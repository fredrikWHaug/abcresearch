import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

/**
 * Global registry of active AbortControllers for in-flight requests.
 * Used to cancel pending requests when the app closes.
 */
const activeAbortControllers = new Set<AbortController>()

/**
 * Create a tracked AbortController that will be automatically cancelled
 * when the app closes (window beforeunload event).
 * 
 * Usage:
 * const controller = createTrackedAbortController()
 * try {
 *   await fetch(url, { signal: controller.signal })
 * } finally {
 *   releaseAbortController(controller)
 * }
 */
export function createTrackedAbortController(): AbortController {
  const controller = new AbortController()
  activeAbortControllers.add(controller)
  return controller
}

/**
 * Remove an AbortController from tracking (call when request completes).
 */
export function releaseAbortController(controller: AbortController): void {
  activeAbortControllers.delete(controller)
}

/**
 * Cancel all in-flight requests. Called automatically on app close.
 */
export function cancelAllRequests(): void {
  console.log(`[Supabase] Cancelling ${activeAbortControllers.size} in-flight requests`)
  activeAbortControllers.forEach(controller => {
    try {
      controller.abort()
    } catch {
      // Ignore abort errors
    }
  })
  activeAbortControllers.clear()
}

// Cancel all pending requests when user closes the app/tab
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    cancelAllRequests()
  })
  
  // Also cancel on page visibility change (tab hidden for extended period)
  // This helps with mobile browsers that may keep tabs in background
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      // Note: We don't cancel immediately on hide, only on unload
      // This prevents canceling requests when user briefly switches tabs
    }
  })
}
