/**
 * PDF Extraction Job Service (Async)
 * 
 * Handles async PDF extraction with job queue system
 */

import { supabase } from '@/lib/supabase'
import type { 
  PDFExtractionJob, 
  PDFExtractionResultRecord,
  CreateJobRequest,
  CreateJobResponse,
  JobStatusResponse,
  JobListResponse,
  RetryJobResponse
} from '@/types/pdf-extraction-job'

export class PDFExtractionJobService {
  /**
   * Trigger the worker for a job (client-side)
   */
  private static async triggerWorker(jobId: string, token: string): Promise<void> {
    try {
      // Small delay to ensure job is fully saved in DB
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Get job details to find file key
      const jobResponse = await fetch(`/api/get-pdf-job?jobId=${jobId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (!jobResponse.ok) {
        throw new Error('Failed to get job details')
      }
      
      const { job } = await jobResponse.json()
      
      // The file key is stored in datalab_check_url during job creation
      const fileKey = job.datalab_check_url
      
      if (!fileKey) {
        throw new Error('File key not found in job')
      }
      
      console.log('Triggering worker from client for job:', jobId, 'with fileKey:', fileKey)
      
      // Trigger the worker
      const workerResponse = await fetch('/api/process-pdf-job', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-key': 'dev-key'
        },
        body: JSON.stringify({
          jobId: jobId,
          fileKey: fileKey
        })
      })
      
      if (!workerResponse.ok) {
        const error = await workerResponse.text()
        console.error('Worker response error:', error)
      } else {
        console.log('Worker triggered successfully from client')
      }
    } catch (error) {
      console.error('Error triggering worker:', error)
      // Don't throw - this is a best-effort attempt
    }
  }

  /**
   * Submit a PDF file for async extraction
   */
  static async submitJob(
    file: File,
    options: {
      projectId?: number | null
      enableGraphify?: boolean
      forceOCR?: boolean
      maxGraphifyImages?: number
    } = {}
  ): Promise<CreateJobResponse> {
    try {
      // Get current session
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        return {
          success: false,
          error: 'Not authenticated'
        }
      }

      // Prepare form data
      const formData = new FormData()
      formData.append('file', file)
      formData.append('projectId', String(options.projectId || ''))
      formData.append('enableGraphify', String(options.enableGraphify ?? true))
      formData.append('forceOCR', String(options.forceOCR ?? false))
      formData.append('maxGraphifyImages', String(options.maxGraphifyImages ?? 10))

      console.log('Submitting PDF job...', {
        fileName: file.name,
        fileSize: file.size,
        options
      })

      // Submit job
      const response = await fetch('/api/submit-pdf-job', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        },
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to submit job')
      }

      const data: CreateJobResponse = await response.json()
      
      console.log('Job submitted:', data.job?.id)
      
      // Trigger the worker from client-side (works around Vercel limitation)
      if (data.success && data.job) {
        this.triggerWorker(data.job.id, session.access_token).catch(err => {
          console.error('Failed to trigger worker from client:', err)
        })
      }
      
      return data

    } catch (error) {
      console.error('Error in submitJob:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to submit job'
      }
    }
  }

  /**
   * Get job status and result
   */
  static async getJob(jobId: string): Promise<JobStatusResponse> {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        return {
          success: false,
          error: 'Not authenticated'
        }
      }

      const response = await fetch(`/api/get-pdf-job?jobId=${jobId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to get job')
      }

      return await response.json()

    } catch (error) {
      console.error('Error in getJob:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get job'
      }
    }
  }

  /**
   * List user's jobs
   */
  static async listJobs(filters?: {
    status?: string
    projectId?: number
    limit?: number
  }): Promise<JobListResponse> {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        return {
          success: false,
          jobs: [],
          error: 'Not authenticated'
        }
      }

      // Build query string
      const params = new URLSearchParams()
      if (filters?.status) params.append('status', filters.status)
      if (filters?.projectId) params.append('projectId', String(filters.projectId))
      if (filters?.limit) params.append('limit', String(filters.limit))

      const response = await fetch(`/api/list-pdf-jobs?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to list jobs')
      }

      return await response.json()

    } catch (error) {
      console.error('Error in listJobs:', error)
      return {
        success: false,
        jobs: [],
        error: error instanceof Error ? error.message : 'Failed to list jobs'
      }
    }
  }

  /**
   * Retry a failed job
   */
  static async retryJob(jobId: string): Promise<RetryJobResponse> {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        return {
          success: false,
          error: 'Not authenticated'
        }
      }

      const response = await fetch('/api/retry-pdf-job', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ jobId })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to retry job')
      }

      return await response.json()

    } catch (error) {
      console.error('Error in retryJob:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to retry job'
      }
    }
  }

  /**
   * Poll job status until completion
   */
  static async pollJobUntilComplete(
    jobId: string,
    onProgress?: (job: PDFExtractionJob) => void,
    pollInterval: number = 2000,
    timeout: number = 5 * 60 * 1000 // 5 minutes
  ): Promise<JobStatusResponse> {
    const startTime = Date.now()

    while (true) {
      const response = await this.getJob(jobId)

      if (!response.success || !response.job) {
        return response
      }

      // Call progress callback
      if (onProgress) {
        onProgress(response.job)
      }

      // Check if completed or failed
      if (response.job.status === 'completed' || response.job.status === 'failed') {
        return response
      }

      // Check timeout
      if (Date.now() - startTime > timeout) {
        return {
          success: false,
          error: 'Polling timeout'
        }
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval))
    }
  }

  /**
   * Download result as blob
   */
  static downloadBlob(blob: Blob, fileName: string): void {
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }

  /**
   * Convert result to downloadable blobs
   */
  static convertResultToBlobs(result: PDFExtractionResultRecord) {
    return {
      markdownBlob: result.markdown_content 
        ? new Blob([result.markdown_content], { type: 'text/markdown' })
        : undefined,
      originalImagesBlob: result.original_images
        ? new Blob([JSON.stringify(result.original_images, null, 2)], { type: 'application/json' })
        : undefined,
      responseJsonBlob: result.response_json
        ? new Blob([JSON.stringify(result.response_json, null, 2)], { type: 'application/json' })
        : undefined,
      graphifyJsonBlob: result.graphify_results
        ? new Blob([JSON.stringify(result.graphify_results, null, 2)], { type: 'application/json' })
        : undefined,
      tablesJsonBlob: result.tables_data
        ? new Blob([JSON.stringify(result.tables_data, null, 2)], { type: 'application/json' })
        : undefined
    }
  }
}

