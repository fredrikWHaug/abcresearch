/**
 * API Route: Retry Failed PDF Extraction Job
 * 
 * Resubmits a failed job for processing
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
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

    const { jobId } = req.body

    if (!jobId) {
      return res.status(400).json({
        success: false,
        error: 'Missing jobId'
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

    // Check if job can be retried
    if (job.status !== 'failed') {
      return res.status(400).json({
        success: false,
        error: 'Only failed jobs can be retried'
      })
    }

    if (job.retry_count >= job.max_retries) {
      return res.status(400).json({
        success: false,
        error: 'Maximum retry attempts reached'
      })
    }

    // Reset job to pending and increment retry count
    const { data: updatedJob, error: updateError } = await supabase
      .from('pdf_extraction_jobs')
      .update({
        status: 'pending',
        progress: 0,
        current_stage: 'initializing',
        error_message: null,
        retry_count: job.retry_count + 1,
        started_at: null,
        completed_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)
      .select()
      .single()

    if (updateError) {
      throw new Error('Failed to update job')
    }

    // Re-upload file if it was deleted
    // For simplicity, we'll assume the file still exists in storage
    // In production, you might want to ask user to re-upload if file is missing

    // Trigger worker
    const fileKey = `pdf-jobs/${user.id}/${job.created_at}-${job.file_name}`
    const workerUrl = `${req.headers.host?.includes('localhost') ? 'http' : 'https'}://${req.headers.host}/api/process-pdf-job`
    
    fetch(workerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-key': process.env.INTERNAL_API_KEY || 'dev-key'
      },
      body: JSON.stringify({
        jobId: updatedJob.id,
        fileKey: fileKey
      })
    }).catch(err => {
      console.error('Failed to trigger worker:', err)
    })

    return res.status(200).json({
      success: true,
      job: updatedJob
    })

  } catch (error) {
    console.error('Error in retry-pdf-job:', error)
    
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to retry job'
    })
  }
}

