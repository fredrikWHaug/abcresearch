/**
 * Type definitions for PDF content extraction
 * Shared between frontend and backend
 */

export interface GraphifyResult {
  imageName: string
  isGraph: boolean
  graphType?: string
  reason?: string
  pythonCode?: string
  data?: Record<string, unknown>
  assumptions?: string
  error?: string
}

export interface ExtractionStats {
  imagesFound: number
  graphsDetected: number
  processingTimeMs: number
}

export interface PDFExtractionResult {
  success: boolean
  jobId?: string
  markdownContent?: string
  markdownBlob?: Blob
  responseJson?: Record<string, unknown>
  responseJsonBlob?: Blob
  originalImagesBlob?: Blob
  graphifyResults?: {
    summary: GraphifyResult[]
    graphifyJsonBlob?: Blob
  }
  stats?: ExtractionStats
  message?: string
}

export interface ExtractionOptions {
  enableGraphify?: boolean
  forceOCR?: boolean
  maxGraphifyImages?: number
}

// Backend-specific types (not used in frontend)
export interface DatalabJobSubmission {
  success: boolean
  request_id?: string
  request_check_url?: string
  error?: string
}

export interface DatalabJobStatus {
  success: boolean
  status: 'pending' | 'processing' | 'complete' | 'failed'
  markdown?: string
  images?: Record<string, unknown>
  error?: string
  [key: string]: unknown  // Allow additional fields
}

export interface GPTVisionResponse {
  is_graph: boolean
  graph_type?: string
  reason?: string
  data?: Record<string, unknown>
  python_code?: string
  assumptions?: string
}

