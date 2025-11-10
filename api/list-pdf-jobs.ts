/**
 * API Route: List PDF Extraction Jobs
 * 
 * Returns list of user's extraction jobs with optional filtering
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    // Get Supabase credentials
    const supabaseUrl = process.env.VITE_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ 
        success: false, 
        error: 'Server configuration error' 
      })
    }

    // Get user from Authorization header
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        error: 'Unauthorized' 
      })
    }

    const token = authHeader.split(' ')[1]
    
    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Verify user token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid or expired token' 
      })
    }

    // Get query parameters
    const status = req.query.status as string | undefined
    const projectId = req.query.projectId as string | undefined
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50

    // Build query
    let query = supabase
      .from('pdf_extraction_jobs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    // Apply filters
    if (status) {
      query = query.eq('status', status)
    }

    if (projectId) {
      query = query.eq('project_id', parseInt(projectId, 10))
    }

    const { data: jobs, error: jobsError } = await query

    if (jobsError) {
      throw new Error('Failed to fetch jobs')
    }

    return res.status(200).json({
      success: true,
      jobs: jobs || []
    })

  } catch (error) {
    console.error('Error in list-pdf-jobs:', error)
    
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list jobs'
    })
  }
}

