/**
 * PDF Extraction Service
 * 
 * This service handles PDF content extraction using Datalab Marker API
 * and GPT Vision for graph detection.
 */

import type { PDFExtractionResult, ExtractionOptions } from '@/types/extraction'

export type { PDFExtractionResult, ExtractionOptions }

export class PDFExtractionService {
  /**
   * Extract content from a PDF file
   * 
   * @param file - The PDF file to process
   * @param options - Extraction options (graphify, OCR, max images)
   * @returns Promise<PDFExtractionResult> - Extraction result with markdown, JSON, and GPT analysis
   */
  static async extractContent(
    file: File, 
    options: ExtractionOptions = {}
  ): Promise<PDFExtractionResult> {
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('enableGraphify', String(options.enableGraphify ?? true))
      formData.append('forceOCR', String(options.forceOCR ?? false))
      formData.append('maxGraphifyImages', String(options.maxGraphifyImages ?? 10))

      console.log('Uploading PDF to extraction API...', {
        fileName: file.name,
        fileSize: file.size,
        options
      })

      const response = await fetch('/api/extract-pdf-content', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || errorData.error || 'Extraction failed')
      }

      const data = await response.json()
      console.log('Extraction API response:', data)

      // Convert base64 blobs to Blob objects
      const result: PDFExtractionResult = {
        success: data.success,
        jobId: data.jobId,
        markdownContent: data.markdown,
        markdownBlob: data.markdownBlob 
          ? this.base64ToBlob(data.markdownBlob, 'text/markdown') 
          : undefined,
        responseJson: data.responseJson,
        responseJsonBlob: data.responseJsonBlob 
          ? this.base64ToBlob(data.responseJsonBlob, 'application/json') 
          : undefined,
        originalImagesBlob: data.originalImagesBlob
          ? this.base64ToBlob(data.originalImagesBlob, 'application/json')
          : undefined,
        graphifyResults: data.graphifyResults ? {
          summary: data.graphifyResults.summary,
          graphifyJsonBlob: data.graphifyResults.graphifyJsonBlob
            ? this.base64ToBlob(data.graphifyResults.graphifyJsonBlob, 'application/json')
            : undefined
        } : undefined,
        stats: data.stats,
        message: data.message
      }

      return result
    } catch (error) {
      console.error('Error in PDFExtractionService:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to extract PDF content'
      }
    }
  }

  /**
   * Convert base64 string to Blob
   */
  private static base64ToBlob(base64: string, mimeType: string): Blob {
    try {
      const byteCharacters = atob(base64)
      const byteNumbers = new Array(byteCharacters.length)
      
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      
      const byteArray = new Uint8Array(byteNumbers)
      return new Blob([byteArray], { type: mimeType })
    } catch (error) {
      console.error('Error converting base64 to blob:', error)
      throw new Error('Failed to convert data to downloadable file')
    }
  }

  /**
   * Trigger download of a blob
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
}

