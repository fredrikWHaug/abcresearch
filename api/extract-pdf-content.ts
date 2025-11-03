/**
 * Vercel API Route for PDF Content Extraction
 * 
 * Integrates Datalab Marker API for PDF → Markdown conversion
 * and GPT Vision API for graph detection and reconstruction
 * 
 * Mirrors functionality of extraction_scripts/datalab_marker.py + graphify_images.py
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import formidable from 'formidable'

// Disable body parsing for file uploads
export const config = {
  api: {
    bodyParser: false,
  },
}

// Constants
const DATALAB_MARKER_URL = 'https://www.datalab.to/api/v1/marker'
const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000 // 15 minutes
const POLL_INTERVAL_MS = 2000 // 2 seconds
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

// Types
interface DatalabJobSubmission {
  success: boolean
  request_id?: string
  request_check_url?: string
  error?: string
}

interface DatalabJobStatus {
  success: boolean
  status: 'pending' | 'processing' | 'complete' | 'failed'
  markdown?: string
  images?: Record<string, Record<string, unknown> | string>
  error?: string
  [key: string]: unknown
}

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

interface GPTVisionResponse {
  is_graph: boolean
  graph_type?: string
  reason?: string
  data?: Record<string, unknown>
  python_code?: string
  assumptions?: string
}

// Parse multipart form data using formidable (more Vercel-compatible)
async function parseForm(req: VercelRequest): Promise<{
  file: Buffer
  fileName: string
  options: {
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

// Submit PDF to Datalab Marker API
async function submitToDatalab(
  fileBuffer: Buffer,
  fileName: string,
  apiKey: string,
  forceOCR: boolean
): Promise<DatalabJobSubmission> {
  // Create a Blob from the buffer (convert Buffer to Uint8Array for TypeScript compatibility)
  const blob = new Blob([new Uint8Array(fileBuffer)], { type: 'application/pdf' })
  
  // Use FormData (globally available in Node.js 18+)
  const form = new FormData()
  form.append('file', blob, fileName)
  form.append('output_format', 'markdown')
  form.append('force_ocr', forceOCR.toString())
  form.append('paginate', 'false')
  form.append('disable_image_extraction', 'false')

  console.log('Submitting to Datalab with:')
  console.log('- File:', fileName, `(${fileBuffer.length} bytes)`)
  console.log('- force_ocr:', forceOCR)

  const response = await fetch(DATALAB_MARKER_URL, {
    method: 'POST',
    headers: {
      'X-Api-Key': apiKey,
    },
    body: form
  })

  const data = await response.json()
  
  console.log('Datalab response status:', response.status)
  console.log('Datalab response data:', JSON.stringify(data, null, 2))

  if (!response.ok || !data.success) {
    const errorMessage = data.error || data.message || data.detail || `HTTP ${response.status}`
    console.error('Datalab API error:', errorMessage)
    console.error('Full response:', data)
    throw new Error(`Datalab API error: ${errorMessage}`)
  }

  if (!data.request_check_url) {
    throw new Error('Missing request_check_url in Datalab response')
  }

  return data as DatalabJobSubmission
}

// Poll Datalab job until complete
async function pollDatalabJob(
  checkUrl: string,
  apiKey: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<DatalabJobStatus> {
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

    if (data.status === 'complete') {
      if (!data.success) {
        throw new Error(data.error || 'Datalab job failed')
      }
      return data as DatalabJobStatus
    }

    if (data.status === 'failed') {
      throw new Error(data.error || 'Datalab job failed')
    }

    // Continue polling for 'pending' or 'processing' status
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
    // Build data URL (imageData might be base64 or URL)
    let dataUrl: string
    if (imageData.startsWith('data:')) {
      dataUrl = imageData
    } else if (imageData.startsWith('http')) {
      // External URL - use as is
      dataUrl = imageData
    } else {
      // Assume base64
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

    const parsed: GPTVisionResponse = JSON.parse(content)

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

// Process multiple images with GPT (with concurrency limit)
async function processImagesWithGPT(
  images: Record<string, Record<string, unknown> | string>,
  maxImages: number,
  gptApiKey: string,
  gptModel: string = 'gpt-4o-mini'
): Promise<GraphifyResult[]> {
  const imageEntries = Object.entries(images).slice(0, maxImages)
  const results: GraphifyResult[] = []
  
  // Process with concurrency limit of 3
  const CONCURRENCY = 3
  for (let i = 0; i < imageEntries.length; i += CONCURRENCY) {
    const batch = imageEntries.slice(i, i + CONCURRENCY)
    const batchPromises = batch.map(([name, data]) => 
      processImageWithGPT(data as string, name, gptApiKey, gptModel)
    )
    const batchResults = await Promise.all(batchPromises)
    results.push(...batchResults)
  }

  return results
}

// Main handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const startTime = Date.now()

  try {
    // Get API keys
    const datalabApiKey = process.env.DATALAB_API_KEY
    const gptApiKey = process.env.OPENAI_API_KEY
    const gptModel = process.env.GPT_MODEL || 'gpt-4o-mini'

    console.log('Environment check:')
    console.log('- DATALAB_API_KEY:', datalabApiKey ? `Set (${datalabApiKey.substring(0, 10)}...)` : 'MISSING')
    console.log('- OPENAI_API_KEY:', gptApiKey ? `Set (${gptApiKey.substring(0, 10)}...)` : 'Not set')
    console.log('- GPT_MODEL:', gptModel)

    if (!datalabApiKey) {
      console.error('❌ Datalab API key not configured')
      return res.status(500).json({ 
        success: false,
        error: 'Datalab API key not configured',
        message: 'Please add DATALAB_API_KEY to your environment variables'
      })
    }

    // Parse form data
    console.log('Parsing multipart form data...')
    const { file, fileName, options } = await parseForm(req)
    console.log(`Received file: ${fileName} (${file.length} bytes)`)
    console.log('Options:', options)

    // Submit to Datalab
    console.log('Submitting to Datalab Marker API...')
    const submission = await submitToDatalab(file, fileName, datalabApiKey, options.forceOCR)
    const jobId = submission.request_id || 'unknown'
    const checkUrl = submission.request_check_url!

    console.log(`Job submitted. ID: ${jobId}`)
    console.log(`Poll URL: ${checkUrl}`)

    // Poll for completion
    console.log('Polling for completion...')
    const result = await pollDatalabJob(checkUrl, datalabApiKey)
    console.log('Job complete!')

    // Extract markdown
    const markdown = result.markdown || ''
    const markdownBlob = Buffer.from(markdown).toString('base64')

    // Extract images
    const images = result.images || {}
    const imagesFound = Object.keys(images).length
    console.log(`Found ${imagesFound} images`)

    // Full response JSON
    const responseJsonBlob = Buffer.from(JSON.stringify(result, null, 2)).toString('base64')

    // Original images blob (separate from full response for easier access)
    const originalImagesBlob = imagesFound > 0 
      ? Buffer.from(JSON.stringify(images, null, 2)).toString('base64')
      : undefined

    // Process images with GPT if enabled
    let graphifyResults: GraphifyResult[] = []
    let graphsDetected = 0

    if (options.enableGraphify && imagesFound > 0 && gptApiKey) {
      console.log(`Processing up to ${options.maxGraphifyImages} images with GPT Vision...`)
      graphifyResults = await processImagesWithGPT(
        images,
        options.maxGraphifyImages,
        gptApiKey,
        gptModel
      )
      graphsDetected = graphifyResults.filter(r => r.isGraph).length
      console.log(`Detected ${graphsDetected} graphs`)
    } else if (options.enableGraphify && !gptApiKey) {
      console.warn('Graphify enabled but OpenAI API key not configured')
    }

    const processingTimeMs = Date.now() - startTime

    // Build response
    const response = {
      success: true,
      jobId,
      markdown,
      markdownBlob,
      responseJson: result,
      responseJsonBlob,
      originalImagesBlob,
      graphifyResults: graphifyResults.length > 0 ? {
        summary: graphifyResults,
        graphifyJsonBlob: Buffer.from(JSON.stringify(graphifyResults, null, 2)).toString('base64')
      } : undefined,
      stats: {
        imagesFound,
        graphsDetected,
        processingTimeMs
      },
      message: `Successfully extracted content from PDF${graphsDetected > 0 ? ` with ${graphsDetected} graph(s) detected` : ''}`
    }

    console.log(`Extraction complete in ${processingTimeMs}ms`)
    return res.status(200).json(response)

  } catch (error) {
    console.error('Error in extract-pdf-content:', error)
    
    const processingTimeMs = Date.now() - startTime
    
    return res.status(500).json({
      success: false,
      error: 'Extraction failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      stats: {
        imagesFound: 0,
        graphsDetected: 0,
        processingTimeMs
      }
    })
  }
}

