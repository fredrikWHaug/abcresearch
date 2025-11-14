/**
 * Consolidated PDF Extraction Job API
 * 
 * Handles PDF job operations (except submit which needs file upload):
 * - GET /api/pdf-jobs?jobId=xxx - Get single job
 * - GET /api/pdf-jobs?action=list&status=xxx&projectId=xxx - List jobs
 * - POST /api/pdf-jobs?action=retry - Retry failed job (requires JSON body)
 * - GET /api/pdf-jobs?action=trigger&jobId=xxx - Trigger stuck job
 * 
 * Note: Submit is handled by submit-pdf-job.ts (requires multipart/form-data)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

// This consolidated endpoint handles GET requests (get, list, trigger) and POST with JSON (retry)
// Submit action is kept separate in submit-pdf-job.ts because it needs multipart/form-data parsing

// Helper to get authenticated user
async function getAuthenticatedUser(req: VercelRequest, supabaseUrl: string, supabaseServiceKey: string) {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { user: null, error: 'Unauthorized' }
  }

  const token = authHeader.split(' ')[1]
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  
  if (authError || !user) {
    return { user: null, error: 'Invalid or expired token' }
  }

  return { user, error: null }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
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

    const action = req.query.action as string || (req.method === 'GET' && req.query.jobId ? 'get' : req.method === 'POST' ? 'submit' : 'list')

    // Handle different actions
    if (action === 'get' || (req.method === 'GET' && req.query.jobId && !req.query.action)) {
      // GET /api/pdf-jobs?jobId=xxx
      const { user, error: authError } = await getAuthenticatedUser(req, supabaseUrl, supabaseServiceKey)
      
      if (authError || !user) {
        return res.status(401).json({ 
          success: false, 
          error: authError || 'Unauthorized' 
        })
      }

      const jobId = req.query.jobId as string
      
      if (!jobId) {
        return res.status(400).json({
          success: false,
          error: 'Missing jobId parameter'
        })
      }

      const supabase = createClient(supabaseUrl, supabaseServiceKey)
      
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

      let result = null
      if (job.status === 'completed') {
        const { data: resultData } = await supabase
          .from('pdf_extraction_results')
          .select('*')
          .eq('job_id', jobId)
          .single()

        if (resultData) {
          result = resultData
        }
      }

      return res.status(200).json({
        success: true,
        job,
        result
      })

    } else if (action === 'list' || (req.method === 'GET' && !req.query.jobId && !req.query.action)) {
      // GET /api/pdf-jobs?action=list&status=xxx&projectId=xxx
      const { user, error: authError } = await getAuthenticatedUser(req, supabaseUrl, supabaseServiceKey)
      
      if (authError || !user) {
        return res.status(401).json({ 
          success: false, 
          error: authError || 'Unauthorized' 
        })
      }

      const status = req.query.status as string | undefined
      const projectId = req.query.projectId as string | undefined
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50

      const supabase = createClient(supabaseUrl, supabaseServiceKey)
      
      let query = supabase
        .from('pdf_extraction_jobs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit)

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

    } else if (action === 'retry') {
      // POST /api/pdf-jobs?action=retry
      const { user, error: authError } = await getAuthenticatedUser(req, supabaseUrl, supabaseServiceKey)
      
      if (authError || !user) {
        return res.status(401).json({ 
          success: false, 
          error: authError || 'Unauthorized' 
        })
      }

      // Parse JSON body for retry action
      let body: { jobId?: string } = {}
      if (typeof req.body === 'string') {
        body = JSON.parse(req.body)
      } else if (req.body) {
        body = req.body as { jobId?: string }
      }

      const { jobId } = body

      if (!jobId) {
        return res.status(400).json({
          success: false,
          error: 'Missing jobId'
        })
      }

      const supabase = createClient(supabaseUrl, supabaseServiceKey)
      
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

    } else if (action === 'trigger') {
      // GET /api/pdf-jobs?action=trigger&jobId=xxx
      const jobId = req.query.jobId as string

      if (!jobId) {
        return res.status(400).json({ error: 'Missing jobId parameter' })
      }

      const supabase = createClient(supabaseUrl, supabaseServiceKey)

      const { data: job, error: jobError } = await supabase
        .from('pdf_extraction_jobs')
        .select('*')
        .eq('id', jobId)
        .single()

      if (jobError || !job) {
        return res.status(404).json({ error: 'Job not found' })
      }

      const fileKey = `pdf-jobs/${job.user_id}/${job.created_at.replace(/[:.]/g, '-').replace('T', '-').split('-').slice(0, 6).join('')}-${job.file_name}`
      
      const possibleKeys = [
        fileKey,
        `pdf-jobs/${job.user_id}/${new Date(job.created_at).getTime()}-${job.file_name}`
      ]

      let actualFileKey = null
      for (const key of possibleKeys) {
        const { data } = await supabase
          .storage
          .from('pdf-uploads')
          .list(`pdf-jobs/${job.user_id}`)

        if (data) {
          const matchingFile = data.find(f => f.name.includes(job.file_name))
          if (matchingFile) {
            actualFileKey = `pdf-jobs/${job.user_id}/${matchingFile.name}`
            break
          }
        }
      }

      if (!actualFileKey) {
        return res.status(404).json({ 
          error: 'File not found in storage',
          jobId: job.id,
          triedKeys: possibleKeys 
        })
      }

      const workerUrl = `${req.headers.host?.includes('localhost') ? 'http' : 'https'}://${req.headers.host}/api/process-pdf-job`
      
      const workerResponse = await fetch(workerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-key': process.env.INTERNAL_API_KEY || 'dev-key'
        },
        body: JSON.stringify({
          jobId: job.id,
          fileKey: actualFileKey
        })
      })

      const workerResult = await workerResponse.json()

      return res.status(200).json({
        success: true,
        message: 'Worker triggered',
        jobId: job.id,
        fileKey: actualFileKey,
        workerStatus: workerResponse.status,
        workerResult
      })

    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid action. Use: get, list, submit, retry, or trigger'
      })
    }

  } catch (error) {
    console.error('Error in pdf-jobs:', error)
    
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    })
  }
}

