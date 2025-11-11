/**
 * API Route: Get PDF Extraction Job Status and Result
 * 
 * Returns job status, progress, and result if completed
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

    // Get job ID from query
    const jobId = req.query.jobId as string
    
    if (!jobId) {
      return res.status(400).json({
        success: false,
        error: 'Missing jobId parameter'
      })
    }

    // Fetch job
    const { data: job, error: jobError } = await supabase
      .from('pdf_extraction_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .single()

    if (jobError || !job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      })
    }

    // If job is completed, fetch result
    let result = null
    if (job.status === 'completed') {
      const { data: resultData, error: resultError } = await supabase
        .from('pdf_extraction_results')
        .select('*')
        .eq('job_id', jobId)
        .single()

      if (!resultError && resultData) {
        result = resultData
      }
    }

    return res.status(200).json({
      success: true,
      job,
      result
    })

  } catch (error) {
    console.error('Error in get-pdf-job:', error)
    
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get job'
    })
  }
}

