/**
 * Manual Worker Trigger for Stuck Jobs
 * 
 * Manually triggers the worker for a job that's stuck in pending/initializing
 * 
 * Usage: GET /api/trigger-stuck-job?jobId=xxx
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const jobId = req.query.jobId as string

    if (!jobId) {
      return res.status(400).json({ error: 'Missing jobId parameter' })
    }

    // Get Supabase credentials
    const supabaseUrl = process.env.VITE_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ error: 'Server configuration error' })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get job details
    const { data: job, error: jobError } = await supabase
      .from('pdf_extraction_jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      return res.status(404).json({ error: 'Job not found' })
    }

    console.log('Found job:', job.id, 'Status:', job.status)

    // Reconstruct file key
    const fileKey = `pdf-jobs/${job.user_id}/${job.created_at.replace(/[:.]/g, '-').replace('T', '-').split('-').slice(0, 6).join('')}-${job.file_name}`
    
    console.log('File key:', fileKey)

    // Try multiple possible file keys (since timestamp format might vary)
    const possibleKeys = [
      fileKey,
      // Try with milliseconds timestamp
      `pdf-jobs/${job.user_id}/${new Date(job.created_at).getTime()}-${job.file_name}`
    ]

    // Find the actual file in storage
    let actualFileKey = null
    for (const key of possibleKeys) {
      const { data, error } = await supabase
        .storage
        .from('pdf-uploads')
        .list(`pdf-jobs/${job.user_id}`)

      if (data) {
        const matchingFile = data.find(f => f.name.includes(job.file_name))
        if (matchingFile) {
          actualFileKey = `pdf-jobs/${job.user_id}/${matchingFile.name}`
          console.log('Found file:', actualFileKey)
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

    // Trigger worker
    const workerUrl = `${req.headers.host?.includes('localhost') ? 'http' : 'https'}://${req.headers.host}/api/process-pdf-job`
    
    console.log('Triggering worker:', workerUrl)
    
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
    
    console.log('Worker response:', workerResult)

    return res.status(200).json({
      success: true,
      message: 'Worker triggered',
      jobId: job.id,
      fileKey: actualFileKey,
      workerStatus: workerResponse.status,
      workerResult
    })

  } catch (error) {
    console.error('Error triggering worker:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to trigger worker'
    })
  }
}

