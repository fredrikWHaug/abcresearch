import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

/**
 * Hook to track page visits
 * Automatically logs page visits to user_sessions table
 */
export function usePageTracking() {
  const location = useLocation()
  const { logPageVisit, user, isAuthorized } = useAuth()

  useEffect(() => {
    // Only track if user is authenticated and authorized
    if (!user || !isAuthorized) {
      return
    }

    // Log page visit
    logPageVisit(location.pathname, {
      search: location.search,
      hash: location.hash,
    })
  }, [location.pathname, location.search, location.hash, user, isAuthorized, logPageVisit])
}

