/**
 * Tests for PDFExtractionJobService
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PDFExtractionJobService } from '../pdfExtractionJobService'
import { supabase } from '@/lib/supabase'

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn()
    }
  }
}))

// Mock fetch
global.fetch = vi.fn()

describe('PDFExtractionJobService', () => {
  const mockSession = {
    access_token: 'mock-token',
    user: { id: 'user-123' }
  }

  const mockJob = {
    id: 'job-123',
    user_id: 'user-123',
    file_name: 'test.pdf',
    file_size: 1024,
    status: 'pending',
    progress: 0,
    enable_graphify: true,
    force_ocr: false,
    max_graphify_images: 10,
    retry_count: 0,
    max_retries: 3,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: mockSession },
      error: null
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('submitJob', () => {
    it('should submit a PDF job successfully', async () => {
      const mockFile = new File(['test'], 'test.pdf', { type: 'application/pdf' })
      
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, job: mockJob })
      } as Response)

      const result = await PDFExtractionJobService.submitJob(mockFile, {
        enableGraphify: true,
        maxGraphifyImages: 10
      })

      expect(result.success).toBe(true)
      expect(result.job).toEqual(mockJob)
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/submit-pdf-job',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Authorization': 'Bearer mock-token'
          }
        })
      )
    })

    it('should handle submission errors', async () => {
      const mockFile = new File(['test'], 'test.pdf', { type: 'application/pdf' })
      
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Upload failed' })
      } as Response)

      const result = await PDFExtractionJobService.submitJob(mockFile)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Upload failed')
    })

    it('should handle authentication errors', async () => {
      const mockFile = new File(['test'], 'test.pdf', { type: 'application/pdf' })
      
      vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({
        data: { session: null },
        error: null
      })

      const result = await PDFExtractionJobService.submitJob(mockFile)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Not authenticated')
    })
  })

  describe('getJob', () => {
    it('should get job status successfully', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 
          success: true, 
          job: { ...mockJob, status: 'completed' },
          result: {
            id: 'result-123',
            job_id: 'job-123',
            markdown_content: '# Test',
            images_found: 5,
            graphs_detected: 2
          }
        })
      } as Response)

      const result = await PDFExtractionJobService.getJob('job-123')

      expect(result.success).toBe(true)
      expect(result.job?.status).toBe('completed')
      expect(result.result).toBeDefined()
    })

    it('should handle get errors', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Job not found' })
      } as Response)

      const result = await PDFExtractionJobService.getJob('invalid-id')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Job not found')
    })
  })

  describe('listJobs', () => {
    it('should list user jobs successfully', async () => {
      const mockJobs = [mockJob, { ...mockJob, id: 'job-456' }]
      
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, jobs: mockJobs })
      } as Response)

      const result = await PDFExtractionJobService.listJobs()

      expect(result.success).toBe(true)
      expect(result.jobs).toHaveLength(2)
    })

    it('should filter jobs by status', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, jobs: [mockJob] })
      } as Response)

      await PDFExtractionJobService.listJobs({ status: 'completed' })

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('status=completed'),
        expect.any(Object)
      )
    })
  })

  describe('retryJob', () => {
    it('should retry a failed job successfully', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 
          success: true, 
          job: { ...mockJob, status: 'pending', retry_count: 1 }
        })
      } as Response)

      const result = await PDFExtractionJobService.retryJob('job-123')

      expect(result.success).toBe(true)
      expect(result.job?.retry_count).toBe(1)
    })

    it('should handle retry errors', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Max retries reached' })
      } as Response)

      const result = await PDFExtractionJobService.retryJob('job-123')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Max retries reached')
    })
  })

  describe('pollJobUntilComplete', () => {
    it('should poll until job completes', async () => {
      let callCount = 0
      vi.mocked(global.fetch).mockImplementation(async () => {
        callCount++
        const status = callCount < 3 ? 'processing' : 'completed'
        return {
          ok: true,
          json: async () => ({ 
            success: true, 
            job: { ...mockJob, status, progress: callCount * 33 },
            result: status === 'completed' ? { id: 'result-123' } : undefined
          })
        } as Response
      })

      const progressUpdates: any[] = []
      const result = await PDFExtractionJobService.pollJobUntilComplete(
        'job-123',
        (job) => progressUpdates.push(job),
        100, // Fast polling for tests
        5000
      )

      expect(result.success).toBe(true)
      expect(result.job?.status).toBe('completed')
      expect(progressUpdates.length).toBeGreaterThan(0)
    })

    it('should timeout if job takes too long', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ 
          success: true, 
          job: { ...mockJob, status: 'processing' }
        })
      } as Response)

      const result = await PDFExtractionJobService.pollJobUntilComplete(
        'job-123',
        undefined,
        100,
        500 // Short timeout
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('timeout')
    })
  })

  describe('convertResultToBlobs', () => {
    it('should convert result to downloadable blobs', () => {
      const mockResult = {
        id: 'result-123',
        job_id: 'job-123',
        user_id: 'user-123',
        markdown_content: '# Test Markdown',
        original_images: { 'img1.png': 'base64data' },
        response_json: { success: true },
        graphify_results: [{ imageName: 'img1.png', isGraph: true }],
        images_found: 1,
        graphs_detected: 1,
        tables_found: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      const blobs = PDFExtractionJobService.convertResultToBlobs(mockResult)

      expect(blobs.markdownBlob).toBeInstanceOf(Blob)
      expect(blobs.originalImagesBlob).toBeInstanceOf(Blob)
      expect(blobs.responseJsonBlob).toBeInstanceOf(Blob)
      expect(blobs.graphifyJsonBlob).toBeInstanceOf(Blob)
    })

    it('should handle missing optional fields', () => {
      const mockResult = {
        id: 'result-123',
        job_id: 'job-123',
        user_id: 'user-123',
        images_found: 0,
        graphs_detected: 0,
        tables_found: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      const blobs = PDFExtractionJobService.convertResultToBlobs(mockResult)

      expect(blobs.markdownBlob).toBeUndefined()
      expect(blobs.originalImagesBlob).toBeUndefined()
    })
  })
})

