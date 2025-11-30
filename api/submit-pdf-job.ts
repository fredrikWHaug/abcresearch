 
/**
 * API Route: Submit PDF Extraction Job
 * 
 * Creates a job record and immediately returns job ID for async processing.
 * The actual PDF processing happens in the background worker.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import formidable from 'formidable'
import { createClient } from '@supabase/supabase-js'

// Disable body parsing for file uploads
export const config = {
  api: {
    bodyParser: false,
  },
}

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

// Parse multipart form data
async function parseForm(req: VercelRequest): Promise<{
  file: Buffer
  fileName: string
  options: {
    projectId?: number | null
    enableGraphify: boolean
    forceOCR: boolean
    maxGraphifyImages: number
  }
}> {
  const form = formidable({
    maxFileSize: MAX_FILE_SIZE,
    allowEmptyFiles: false,
    filename: () => 'upload.pdf'
  })

  try {
    const [fields, files] = await form.parse(req)
    
    // Extract options from fields
    const options = {
      projectId: fields.projectId?.[0] ? parseInt(fields.projectId[0], 10) : null,
      enableGraphify: (fields.enableGraphify?.[0] ?? 'true') === 'true',
      forceOCR: (fields.forceOCR?.[0] ?? 'false') === 'true',
      maxGraphifyImages: fields.maxGraphifyImages?.[0] ? parseInt(fields.maxGraphifyImages[0], 10) : 10
    }

    // Get uploaded file
    const uploadedFile = files.file?.[0]
    if (!uploadedFile) {
      throw new Error('No file uploaded')
    }

    // Read file into buffer
    const fs = await import('fs')
    const fileBuffer = await fs.promises.readFile(uploadedFile.filepath)
    const fileName = uploadedFile.originalFilename || 'unknown.pdf'

    // Clean up temp file
    await fs.promises.unlink(uploadedFile.filepath).catch(() => {})

    if (fileBuffer.length > MAX_FILE_SIZE) {
      throw new Error(`File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`)
    }

    return { file: fileBuffer, fileName, options }
  } catch (error) {
    console.error('Error parsing form:', error)
    throw error
  }
}

// Main handler
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
      console.error('Missing Supabase configuration')
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
    
    // Create Supabase client with service role (for admin operations)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
    
    // Verify user token
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    
    if (authError || !user) {
      console.error('Authentication error:', authError)
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid or expired token' 
      })
    }

    console.log('Authenticated user:', user.id)

    // Parse form data
    const { file, fileName, options } = await parseForm(req)
    console.log(`Received file: ${fileName} (${file.length} bytes)`)
    console.log('Options:', options)

    // Store file in Supabase Storage (for worker to access)
    const fileKey = `pdf-jobs/${user.id}/${Date.now()}-${fileName}`
    
    const { error: uploadError } = await supabaseAdmin
      .storage
      .from('pdf-uploads')
      .upload(fileKey, file, {
        contentType: 'application/pdf',
        upsert: false
      })

    if (uploadError) {
      console.error('File upload error:', uploadError)
      return res.status(500).json({
        success: false,
        error: 'Failed to upload file to storage'
      })
    }

    console.log('File uploaded to storage:', fileKey)

    // Create job record in database (store fileKey in datalab_check_url for easy retrieval)
    const { data: job, error: jobError } = await supabaseAdmin
      .from('pdf_extraction_jobs')
      .insert({
        user_id: user.id,
        project_id: options.projectId,
        file_name: fileName,
        file_size: file.length,
        enable_graphify: options.enableGraphify,
        force_ocr: options.forceOCR,
        max_graphify_images: options.maxGraphifyImages,
        status: 'pending',
        progress: 0,
        current_stage: 'initializing',
        retry_count: 0,
        max_retries: 3,
        datalab_check_url: fileKey  // Store the file key for easy retrieval
      })
      .select()
      .single()

    if (jobError) {
      console.error('Job creation error:', jobError)
      
      // Clean up uploaded file
      await supabaseAdmin.storage.from('pdf-uploads').remove([fileKey])
      
      return res.status(500).json({
        success: false,
        error: 'Failed to create extraction job'
      })
    }

    console.log('Job created:', job.id)
    console.log('File key stored in job:', fileKey)

    // The worker will be triggered from the client-side
    // This avoids Vercel's limitation where serverless functions can't call each other
    
    return res.status(200).json({
      success: true,
      job: job
    })

  } catch (error) {
    console.error('Error in submit-pdf-job:', error)
    
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to submit job'
    })
  }
}

