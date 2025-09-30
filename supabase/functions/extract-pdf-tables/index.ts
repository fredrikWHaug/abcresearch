// Supabase Edge Function - runs in Deno runtime
// @ts-nocheck
// @deno-types="https://deno.land/std@0.168.0/http/server.ts"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get the authorization header (optional for local testing)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.log('No authorization header provided - proceeding for local testing')
      // For local testing, we'll allow requests without auth
      // In production, you'd want to require authentication
    }

    // Parse the request body
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return new Response(
        JSON.stringify({ error: 'No file provided' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Validate file type
    if (file.type !== 'application/pdf') {
      return new Response(
        JSON.stringify({ error: 'File must be a PDF' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Convert file to base64 for Python API
    const arrayBuffer = await file.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)
    const base64 = btoa(String.fromCharCode(...uint8Array))

    // Call Vercel Python API
    // Use environment variable or fallback to production URL
    const vercelApiUrl = Deno.env.get('VERCEL_PYTHON_API_URL') || 'https://abcresearch.vercel.app/api/extract_tables'
    console.log('Calling Vercel Python API:', vercelApiUrl)
    
    const pythonResponse = await fetch(vercelApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pdf_data: base64,
        filename: file.name
      })
    })

    if (!pythonResponse.ok) {
      const errorText = await pythonResponse.text()
      console.error('Python API error:', errorText)
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'PDF processing failed', 
          details: errorText 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const result = await pythonResponse.json()
    console.log('Python API response:', { success: result.success, tableCount: result.tables?.length || 0 })

    // Check if the Python API returned an error
    if (!result.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: result.error || 'PDF processing failed',
          tables: []
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Return the result from Python API
    return new Response(
      JSON.stringify({
        success: true,
        tables: result.tables || [],
        excel_data: result.excel_data,
        message: result.message || 'Tables extracted successfully'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})