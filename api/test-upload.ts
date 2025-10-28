/**
 * Simple test endpoint to debug file upload issues
 * This helps identify if the problem is with Busboy parsing or something else
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'

export const config = {
  api: {
    bodyParser: false,
  },
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('=== TEST UPLOAD DEBUG ===')
  console.log('Method:', req.method)
  console.log('Headers:', JSON.stringify(req.headers, null, 2))
  console.log('Body type:', typeof req.body)
  console.log('Has pipe?', typeof req.pipe === 'function')
  console.log('Has readable?', req.readable)
  
  if (req.method !== 'POST') {
    return res.status(200).json({ 
      message: 'Send a POST request with a file',
      debug: {
        method: req.method,
        hasPipe: typeof req.pipe === 'function',
        headers: req.headers
      }
    })
  }

  try {
    // Try using formidable instead of busboy
    const formidable = (await import('formidable')).default
    const form = formidable({
      maxFileSize: 50 * 1024 * 1024,
      allowEmptyFiles: false,
    })

    const [fields, files] = await form.parse(req)
    
    console.log('✅ Formidable parsed successfully')
    console.log('Fields:', fields)
    console.log('Files:', Object.keys(files))

    const uploadedFile = files.file?.[0]
    
    if (!uploadedFile) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    return res.status(200).json({
      success: true,
      message: 'File upload works!',
      fileName: uploadedFile.originalFilename,
      fileSize: uploadedFile.size,
      mimeType: uploadedFile.mimetype,
      debug: {
        parser: 'formidable',
        fields: Object.keys(fields),
        files: Object.keys(files)
      }
    })
  } catch (error) {
    console.error('❌ Error:', error)
    return res.status(500).json({
      error: 'File upload failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      debug: {
        errorType: error instanceof Error ? error.constructor.name : typeof error
      }
    })
  }
}

