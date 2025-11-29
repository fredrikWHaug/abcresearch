/**
 * Type definitions for async PDF extraction job queue
 */

// Job statuses:
// - 'pending': Job created, waiting to start
// - 'processing': Job is being processed
// - 'partial': Markdown/images ready, graph analysis in progress
// - 'completed': All processing finished (including graphs if enabled)
// - 'failed': Job failed
// - 'cancelled': Job was cancelled
export type PDFJobStatus = 'pending' | 'processing' | 'partial' | 'completed' | 'failed' | 'cancelled'

export type PDFJobStage = 
  | 'initializing'
  | 'uploading_to_datalab'
  | 'waiting_for_datalab'
  | 'extracting_markdown'
  | 'extracting_images'
  | 'analyzing_graphs'
  | 'extracting_tables'
  | 'finalizing'
  | 'completed'

export interface PDFExtractionJob {
  id: string
  user_id: string
  project_id?: number | null
  
  // File information
  file_name: string
  file_size: number
  
  // Job configuration
  enable_graphify: boolean
  force_ocr: boolean
  max_graphify_images: number
  
  // Job status and progress
  status: PDFJobStatus
  progress: number  // 0-100
  current_stage?: string | null
  
  // Processing details
  datalab_job_id?: string | null
  datalab_check_url?: string | null
  error_message?: string | null
  retry_count: number
  max_retries: number
  
  // Timestamps
  created_at: string
  started_at?: string | null
  completed_at?: string | null
  updated_at: string
}

export interface PDFExtractionResultRecord {
  id: string
  job_id: string
  user_id: string
  
  // Extracted content
  markdown_content?: string | null
  
  // JSON results
  response_json?: Record<string, unknown> | null
  original_images?: Record<string, unknown> | null
  graphify_results?: unknown[] | null
  tables_data?: unknown[] | null
  
  // Statistics
  images_found: number
  graphs_detected: number
  tables_found: number
  processing_time_ms?: number | null
  
  // Timestamps
  created_at: string
  updated_at: string
}

export interface CreateJobRequest {
  fileName: string
  fileSize: number
  projectId?: number | null
  enableGraphify?: boolean
  forceOCR?: boolean
  maxGraphifyImages?: number
}

export interface CreateJobResponse {
  success: boolean
  job?: PDFExtractionJob
  error?: string
}

export interface JobStatusResponse {
  success: boolean
  job?: PDFExtractionJob
  result?: PDFExtractionResultRecord
  error?: string
}

export interface JobListResponse {
  success: boolean
  jobs: PDFExtractionJob[]
  error?: string
}

export interface RetryJobRequest {
  jobId: string
}

export interface RetryJobResponse {
  success: boolean
  job?: PDFExtractionJob
  error?: string
}

