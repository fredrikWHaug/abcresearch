/**
 * API Route: Process PDF Extraction Job (Background Worker)
 * 
 * This endpoint processes PDF extraction jobs asynchronously.
 * It should be called internally after job submission.
 * 
 * Processing stages:
 * 1. Upload to Datalab
 * 2. Poll for completion
 * 3. Extract images
 * 4. Analyze graphs with GPT
 * 5. Store results
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

export const config = {
  maxDuration: 300, // 5 minutes (Vercel limit)
}

// Constants
const DATALAB_MARKER_URL = 'https://www.datalab.to/api/v1/marker'
const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000 // 15 minutes
const POLL_INTERVAL_MS = 2000 // 2 seconds

interface GraphifyResult {
  imageName: string
  isGraph: boolean
  graphType?: string
  reason?: string
  pythonCode?: string
  data?: Record<string, unknown>
  assumptions?: string
  error?: string
}

// Update job progress in database
async function updateJobProgress(
  supabase: any,
  jobId: string,
  updates: {
    status?: string
    progress?: number
    current_stage?: string
    datalab_job_id?: string
    datalab_check_url?: string
    started_at?: string
    completed_at?: string
    error_message?: string
  }
) {
  const { error } = await supabase
    .from('pdf_extraction_jobs')
    .update(updates)
    .eq('id', jobId)

  if (error) {
    console.error('Failed to update job progress:', error)
  }
}

// Submit PDF to Datalab Marker API
async function submitToDatalab(
  fileBuffer: Buffer,
  fileName: string,
  apiKey: string,
  forceOCR: boolean
): Promise<{ jobId: string; checkUrl: string }> {
  const blob = new Blob([new Uint8Array(fileBuffer)], { type: 'application/pdf' })
  
  const form = new FormData()
  form.append('file', blob, fileName)
  form.append('output_format', 'markdown')
  form.append('force_ocr', forceOCR.toString())
  form.append('paginate', 'false')
  form.append('disable_image_extraction', 'false')

  console.log('Submitting to Datalab:', { fileName, size: fileBuffer.length, forceOCR })

  const response = await fetch(DATALAB_MARKER_URL, {
    method: 'POST',
    headers: {
      'X-Api-Key': apiKey,
    },
    body: form
  })

  const data = await response.json()

  if (!response.ok || !data.success) {
    const errorMessage = data.error || data.message || data.detail || `HTTP ${response.status}`
    throw new Error(`Datalab API error: ${errorMessage}`)
  }

  if (!data.request_check_url || !data.request_id) {
    throw new Error('Missing request_check_url or request_id in Datalab response')
  }

  return {
    jobId: data.request_id,
    checkUrl: data.request_check_url
  }
}

// Poll Datalab job with progress updates
async function pollDatalabJob(
  checkUrl: string,
  apiKey: string,
  jobId: string,
  supabase: any,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<Record<string, unknown>> {
  const startTime = Date.now()

  while (true) {
    if (Date.now() - startTime > timeoutMs) {
      throw new Error('Datalab job timed out')
    }

    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))

    const response = await fetch(checkUrl, {
      headers: { 'X-Api-Key': apiKey }
    })

    const data = await response.json()

    // Update progress based on time elapsed
    const elapsed = Date.now() - startTime
    const estimatedTotal = 60000 // Assume 60 seconds total
    const progress = Math.min(Math.floor((elapsed / estimatedTotal) * 80), 75) // Cap at 75% until complete

    await updateJobProgress(supabase, jobId, {
      progress,
      current_stage: 'waiting_for_datalab'
    })

    if (data.status === 'complete') {
      if (!data.success) {
        throw new Error(data.error || 'Datalab job failed')
      }
      return data
    }

    if (data.status === 'failed') {
      throw new Error(data.error || 'Datalab job failed')
    }

    console.log(`Polling Datalab job... Status: ${data.status}`)
  }
}

// Process image with GPT Vision
async function processImageWithGPT(
  imageData: string,
  imageName: string,
  gptApiKey: string,
  gptModel: string = 'gpt-4o-mini'
): Promise<GraphifyResult> {
  try {
    let dataUrl: string
    if (imageData.startsWith('data:')) {
      dataUrl = imageData
    } else if (imageData.startsWith('http')) {
      dataUrl = imageData
    } else {
      dataUrl = `data:image/png;base64,${imageData}`
    }

    const prompt = `You are a scientific figure analyzer. Determine if this image is a data visualization (graph/chart/plot).

If yes, extract approximate numeric data and produce Python code to reconstruct it.

Return ONLY a JSON object with these keys:
- is_graph (boolean): true if this is a graph/chart/plot
- graph_type (string): type of graph (e.g., "line chart", "bar chart", "scatter plot")
- reason (string): brief explanation
- data (object): extracted numeric data with arrays/series
- python_code (string): Python function recreate_plot(output_path: str) using matplotlib
- assumptions (string): any assumptions made about ambiguous data

Rules:
- Use simple lists for data (not dataframes)
- Include title/axes/legend when inferable
- Make code self-contained (no external files)
- Use Agg backend for matplotlib
- If not a graph, set is_graph to false and omit other fields`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${gptApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: gptModel,
        temperature: 1,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'You convert static images of figures into approximate datasets and minimal plotting code. When data is ambiguous, make reasonable numeric approximations and note them in assumptions.'
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: dataUrl } }
            ]
          }
        ]
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`GPT Vision API error: ${errorText}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      throw new Error('Empty response from GPT Vision')
    }

    const parsed = JSON.parse(content)

    return {
      imageName,
      isGraph: parsed.is_graph || false,
      graphType: parsed.graph_type,
      reason: parsed.reason,
      pythonCode: parsed.python_code,
      data: parsed.data,
      assumptions: parsed.assumptions
    }
  } catch (error) {
    console.error(`Error processing image ${imageName} with GPT:`, error)
    return {
      imageName,
      isGraph: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// Process multiple images with progress updates
async function processImagesWithGPT(
  images: Record<string, string>,
  maxImages: number,
  gptApiKey: string,
  jobId: string,
  supabase: any,
  gptModel: string = 'gpt-4o-mini'
): Promise<GraphifyResult[]> {
  const imageEntries = Object.entries(images).slice(0, maxImages)
  const results: GraphifyResult[] = []
  
  const CONCURRENCY = 3
  for (let i = 0; i < imageEntries.length; i += CONCURRENCY) {
    const batch = imageEntries.slice(i, i + CONCURRENCY)
    
    // Update progress
    const progressPercent = 80 + Math.floor((i / imageEntries.length) * 15) // 80-95%
    await updateJobProgress(supabase, jobId, {
      progress: progressPercent,
      current_stage: `analyzing_graphs (${i + 1}/${imageEntries.length})`
    })
    
    const batchPromises = batch.map(([name, data]) => 
      processImageWithGPT(data as string, name, gptApiKey, gptModel)
    )
    const batchResults = await Promise.all(batchPromises)
    results.push(...batchResults)
  }

  return results
}

// Main worker handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-internal-key')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  // Verify internal request
  const internalKey = req.headers['x-internal-key']
  if (internalKey !== process.env.INTERNAL_API_KEY && internalKey !== 'dev-key') {
    return res.status(403).json({ success: false, error: 'Forbidden' })
  }

  const startTime = Date.now()

  try {
    const { jobId, fileKey } = req.body

    if (!jobId || !fileKey) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing jobId or fileKey' 
      })
    }

    console.log('Processing job:', jobId)

    // Get API keys
    const datalabApiKey = process.env.DATALAB_API_KEY
    const gptApiKey = process.env.OPENAI_API_KEY
    const gptModel = process.env.GPT_MODEL || 'gpt-4o-mini'

    if (!datalabApiKey) {
      throw new Error('Datalab API key not configured')
    }

    // Initialize Supabase
    const supabaseUrl = process.env.VITE_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch job details
    const { data: job, error: jobFetchError } = await supabase
      .from('pdf_extraction_jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (jobFetchError || !job) {
      throw new Error('Job not found')
    }

    console.log('Job details:', job)

    // Update status to processing
    await updateJobProgress(supabase, jobId, {
      status: 'processing',
      progress: 5,
      current_stage: 'uploading_to_datalab',
      started_at: new Date().toISOString()
    })

    // Download file from storage
    console.log('Downloading file from storage:', fileKey)
    const { data: fileData, error: downloadError } = await supabase
      .storage
      .from('pdf-uploads')
      .download(fileKey)

    if (downloadError || !fileData) {
      throw new Error('Failed to download file from storage')
    }

    const fileBuffer = Buffer.from(await fileData.arrayBuffer())
    console.log('File downloaded:', fileBuffer.length, 'bytes')

    // Submit to Datalab
    await updateJobProgress(supabase, jobId, {
      progress: 10,
      current_stage: 'uploading_to_datalab'
    })

    const { jobId: datalabJobId, checkUrl } = await submitToDatalab(
      fileBuffer,
      job.file_name,
      datalabApiKey,
      job.force_ocr
    )

    console.log('Submitted to Datalab:', datalabJobId)

    await updateJobProgress(supabase, jobId, {
      progress: 15,
      current_stage: 'waiting_for_datalab',
      datalab_job_id: datalabJobId,
      datalab_check_url: checkUrl
    })

    // Poll for completion
    const result = await pollDatalabJob(checkUrl, datalabApiKey, jobId, supabase)
    console.log('Datalab job complete')

    // Extract data
    await updateJobProgress(supabase, jobId, {
      progress: 80,
      current_stage: 'extracting_markdown'
    })

    const markdown = result.markdown as string || ''
    const images = (result.images as Record<string, string>) || {}
    const imagesFound = Object.keys(images).length

    console.log(`Found ${imagesFound} images`)

    // Process images with GPT if enabled
    let graphifyResults: GraphifyResult[] = []
    let graphsDetected = 0

    if (job.enable_graphify && imagesFound > 0 && gptApiKey) {
      await updateJobProgress(supabase, jobId, {
        progress: 85,
        current_stage: 'analyzing_graphs'
      })

      console.log(`Processing up to ${job.max_graphify_images} images with GPT Vision...`)
      graphifyResults = await processImagesWithGPT(
        images,
        job.max_graphify_images,
        gptApiKey,
        jobId,
        supabase,
        gptModel
      )
      graphsDetected = graphifyResults.filter(r => r.isGraph).length
      console.log(`Detected ${graphsDetected} graphs`)
    }

    await updateJobProgress(supabase, jobId, {
      progress: 95,
      current_stage: 'finalizing'
    })

    const processingTimeMs = Date.now() - startTime

    // Store results in database
    const { error: resultError } = await supabase
      .from('pdf_extraction_results')
      .insert({
        job_id: jobId,
        user_id: job.user_id,
        markdown_content: markdown,
        response_json: result,
        original_images: images,
        graphify_results: graphifyResults.length > 0 ? graphifyResults : null,
        tables_data: null, // TODO: Extract tables if needed
        images_found: imagesFound,
        graphs_detected: graphsDetected,
        tables_found: 0,
        processing_time_ms: processingTimeMs
      })

    if (resultError) {
      console.error('Failed to store results:', resultError)
      throw new Error('Failed to store results')
    }

    // Update job to completed
    await updateJobProgress(supabase, jobId, {
      status: 'completed',
      progress: 100,
      current_stage: 'completed',
      completed_at: new Date().toISOString()
    })

    // Clean up file from storage
    await supabase.storage.from('pdf-uploads').remove([fileKey])

    console.log(`Job ${jobId} completed in ${processingTimeMs}ms`)

    return res.status(200).json({
      success: true,
      jobId,
      processingTimeMs
    })

  } catch (error) {
    console.error('Error in process-pdf-job:', error)

    const { jobId } = req.body
    
    if (jobId) {
      const supabaseUrl = process.env.VITE_SUPABASE_URL
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      
      if (supabaseUrl && supabaseServiceKey) {
        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        
        // Update job to failed
        await updateJobProgress(supabase, jobId, {
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
          completed_at: new Date().toISOString()
        })
      }
    }
    
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Processing failed'
    })
  }
}

