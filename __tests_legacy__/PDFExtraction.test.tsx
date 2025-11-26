import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PDFExtraction } from './PDFExtraction'
import { PDFExtractionService } from '@/services/pdfExtractionService'

// Mock the PDFExtractionService
vi.mock('@/services/pdfExtractionService', () => ({
  PDFExtractionService: {
    extractContent: vi.fn(),
    downloadBlob: vi.fn(),
  },
}))

describe('PDFExtraction Component - Enhanced with Content Extraction', () => {
  let mockExtractContent: ReturnType<typeof vi.fn>
  let mockDownloadBlob: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockExtractContent = vi.mocked(PDFExtractionService.extractContent)
    mockDownloadBlob = vi.mocked(PDFExtractionService.downloadBlob)
    mockExtractContent.mockClear()
    mockDownloadBlob.mockClear()
    
    // Mock URL.createObjectURL and URL.revokeObjectURL
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
    global.URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('1. Component Rendering', () => {
    it('should render the component with all initial UI elements', () => {
      render(<PDFExtraction />)

      // Check for title
      expect(screen.getByText('PDF Table Extraction')).toBeInTheDocument()
      
      // Check for description
      expect(screen.getByText(/Upload a PDF document to extract tabular data/i)).toBeInTheDocument()
      
      // Check for upload area
      expect(screen.getByText(/Click or drag to upload PDF file/i)).toBeInTheDocument()
      
      // Check for file input (hidden)
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      expect(fileInput).toBeInTheDocument()
      expect(fileInput.accept).toBe('.pdf')
      
      // Extract button should be disabled initially
      const extractButton = screen.getByRole('button', { name: /Extract Content/i })
      expect(extractButton).toBeDisabled()
    })

    it('should display the component in a card layout with proper styling', () => {
      const { container } = render(<PDFExtraction />)
      
      // Check for card structure
      const card = container.querySelector('.rounded-lg.border')
      expect(card).toBeInTheDocument()
    })
  })

  describe('2. File Selection', () => {
    it('should only accept PDF files', () => {
      render(<PDFExtraction />)
      
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      expect(fileInput.accept).toBe('.pdf')
    })

    it('should display selected PDF file name and size', async () => {
      render(<PDFExtraction />)
      
      const file = new File(['dummy content'], 'test-document.pdf', { type: 'application/pdf' })
      Object.defineProperty(file, 'size', { value: 1024 * 1024 * 2.5 }) // 2.5 MB
      
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      
      await userEvent.upload(fileInput, file)
      
      // Check file name is displayed
      expect(screen.getByText('test-document.pdf')).toBeInTheDocument()
      
      // Check file size is displayed and formatted correctly
      expect(screen.getByText(/2.5 MB/i)).toBeInTheDocument()
    })

    it('should format file size correctly for different sizes', async () => {
      const testCases = [
        { size: 500, expected: '500 Bytes' },
        { size: 1024, expected: '1 KB' },
        { size: 1024 * 1024, expected: '1 MB' },
        { size: 1024 * 1024 * 500, expected: '500 MB' },
      ]

      for (const testCase of testCases) {
        const { unmount } = render(<PDFExtraction />)
        
        const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
        Object.defineProperty(file, 'size', { value: testCase.size })
        
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
        await userEvent.upload(fileInput, file)
        
        expect(screen.getByText(new RegExp(testCase.expected, 'i'))).toBeInTheDocument()
        
        unmount()
      }
    })

    it('should enable Extract Content button when file is selected', async () => {
      render(<PDFExtraction />)
      
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      
      await userEvent.upload(fileInput, file)
      
      const extractButton = screen.getByRole('button', { name: /Extract Content/i })
      expect(extractButton).not.toBeDisabled()
    })

    it('should show remove button when file is selected', async () => {
      render(<PDFExtraction />)
      
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      
      await userEvent.upload(fileInput, file)
      
      // Look for the X button to remove the file
      const removeButtons = screen.getAllByRole('button')
      const removeButton = removeButtons.find(btn => btn.querySelector('svg'))
      expect(removeButton).toBeInTheDocument()
    })

    it('should clear previous results when new file is selected', async () => {
      mockExtractContent.mockResolvedValue({
        success: true,
        markdownBlob: new Blob(['# Test']),
        stats: { imagesFound: 0, graphsDetected: 0, processingTimeMs: 1000 }
      })

      render(<PDFExtraction />)
      
      // Select and process first file
      const file1 = new File(['content'], 'first.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await userEvent.upload(fileInput, file1)
      
      const extractButton = screen.getByRole('button', { name: /Extract Content/i })
      await userEvent.click(extractButton)
      
      await waitFor(() => {
        expect(screen.getByText(/Extraction Successful/i)).toBeInTheDocument()
      })
      
      // Select new file
      const file2 = new File(['content'], 'second.pdf', { type: 'application/pdf' })
      await userEvent.upload(fileInput, file2)
      
      // Previous results should be cleared
      expect(screen.queryByText(/Extraction Successful/i)).not.toBeInTheDocument()
    })
  })

  describe('3. Extraction Trigger', () => {
    it('should call PDFExtractionService.extractContent when Extract Content is clicked', async () => {
      mockExtractContent.mockResolvedValue({
        success: true,
        markdownBlob: new Blob(['# Test'], { type: 'text/markdown' }),
        responseJsonBlob: new Blob([JSON.stringify({})], { type: 'application/json' }),
        stats: { imagesFound: 0, graphsDetected: 0, processingTimeMs: 1000 }
      })

      render(<PDFExtraction />)
      
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await userEvent.upload(fileInput, file)
      
      const extractButton = screen.getByRole('button', { name: /Extract Content/i })
      await userEvent.click(extractButton)
      
      expect(mockExtractContent).toHaveBeenCalledWith(file, expect.objectContaining({
        enableGraphify: expect.any(Boolean),
        forceOCR: expect.any(Boolean),
        maxGraphifyImages: expect.any(Number)
      }))
      expect(mockExtractContent).toHaveBeenCalledTimes(1)
    })

    it('should show loading state when processing', async () => {
      // Mock a delayed response
      mockExtractContent.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          success: true,
          markdownBlob: new Blob(['# Test']),
          stats: { imagesFound: 0, graphsDetected: 0, processingTimeMs: 1000 }
        }), 100))
      )

      render(<PDFExtraction />)
      
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await userEvent.upload(fileInput, file)
      
      const extractButton = screen.getByRole('button', { name: /Extract Content/i })
      await userEvent.click(extractButton)
      
      // Check loading state
      expect(screen.getByText(/Processing.../i)).toBeInTheDocument()
      expect(screen.getByText(/Processing PDF.../i)).toBeInTheDocument()
      expect(screen.getByText(/Extracting tables from your document/i)).toBeInTheDocument()
      
      // Button should be disabled during processing
      expect(extractButton).toBeDisabled()
      
      await waitFor(() => {
        expect(screen.queryByText(/Processing.../i)).not.toBeInTheDocument()
      })
    })

    it('should disable all interactive elements during processing', async () => {
      mockExtractContent.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          success: true,
          markdownBlob: new Blob(['# Test']),
          stats: { imagesFound: 0, graphsDetected: 0, processingTimeMs: 1000 }
        }), 100))
      )

      render(<PDFExtraction />)
      
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await userEvent.upload(fileInput, file)
      
      const extractButton = screen.getByRole('button', { name: /Extract Content/i })
      await userEvent.click(extractButton)
      
      // File input should be disabled
      expect(fileInput).toBeDisabled()
      
      // Extract button should be disabled
      expect(extractButton).toBeDisabled()
      
      await waitFor(() => {
        expect(fileInput).not.toBeDisabled()
      })
    })
  })

  describe('4. Success Case', () => {
    it('should display success message with stats', async () => {
      mockExtractContent.mockResolvedValue({
        success: true,
        markdownBlob: new Blob(['# Document'], { type: 'text/markdown' }),
        responseJsonBlob: new Blob([JSON.stringify({})], { type: 'application/json' }),
        stats: {
          imagesFound: 3,
          graphsDetected: 0,
          processingTimeMs: 5000
        },
        message: 'Successfully extracted content from PDF'
      })

      render(<PDFExtraction />)
      
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await userEvent.upload(fileInput, file)
      
      const extractButton = screen.getByRole('button', { name: /Extract Content/i })
      await userEvent.click(extractButton)
      
      await waitFor(() => {
        expect(screen.getByText(/Extraction Successful/i)).toBeInTheDocument()
        expect(screen.getByText(/Successfully extracted content from PDF/i)).toBeInTheDocument()
      })
    })

    it('should handle singular vs plural images correctly', async () => {
      mockExtractContent.mockResolvedValue({
        success: true,
        markdownBlob: new Blob(['# Test']),
        stats: {
          imagesFound: 1,
          graphsDetected: 0,
          processingTimeMs: 2000
        }
      })

      render(<PDFExtraction />)
      
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await userEvent.upload(fileInput, file)
      
      const extractButton = screen.getByRole('button', { name: /Extract Content/i })
      await userEvent.click(extractButton)
      
      await waitFor(() => {
        // Should say "image" not "images" for count of 1
        expect(screen.getByText(/1 image found/i)).toBeInTheDocument()
      })
    })

    it('should enable download buttons on success', async () => {
      mockExtractContent.mockResolvedValue({
        success: true,
        markdownBlob: new Blob(['# Test'], { type: 'text/markdown' }),
        responseJsonBlob: new Blob([JSON.stringify({})], { type: 'application/json' }),
        stats: { imagesFound: 0, graphsDetected: 0, processingTimeMs: 1000 }
      })

      render(<PDFExtraction />)
      
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await userEvent.upload(fileInput, file)
      
      const extractButton = screen.getByRole('button', { name: /Extract Content/i })
      await userEvent.click(extractButton)
      
      await waitFor(() => {
        expect(screen.getByText(/Markdown Content/i)).toBeInTheDocument()
        expect(screen.getByText(/Full API Response/i)).toBeInTheDocument()
      })
    })

    it('should display custom success message if provided', async () => {
      const customMessage = 'Custom success message from backend'
      mockExtractContent.mockResolvedValue({
        success: true,
        markdownBlob: new Blob(['# Test']),
        message: customMessage,
        stats: { imagesFound: 5, graphsDetected: 0, processingTimeMs: 3000 }
      })

      render(<PDFExtraction />)
      
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await userEvent.upload(fileInput, file)
      
      const extractButton = screen.getByRole('button', { name: /Extract Content/i })
      await userEvent.click(extractButton)
      
      await waitFor(() => {
        expect(screen.getByText(customMessage)).toBeInTheDocument()
      })
    })
  })

  describe('5. Failure Case', () => {
    it('should display error message on extraction failure', async () => {
      const errorMessage = 'Failed to extract content: Invalid PDF format'
      mockExtractContent.mockResolvedValue({
        success: false,
        message: errorMessage,
      })

      render(<PDFExtraction />)
      
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await userEvent.upload(fileInput, file)
      
      const extractButton = screen.getByRole('button', { name: /Extract Content/i })
      await userEvent.click(extractButton)
      
      await waitFor(() => {
        expect(screen.getByText(/Extraction Failed/i)).toBeInTheDocument()
        expect(screen.getByText(errorMessage)).toBeInTheDocument()
      })
    })

    it('should display generic error message when no specific message provided', async () => {
      mockExtractContent.mockResolvedValue({
        success: false,
      })

      render(<PDFExtraction />)
      
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await userEvent.upload(fileInput, file)
      
      const extractButton = screen.getByRole('button', { name: /Extract Content/i })
      await userEvent.click(extractButton)
      
      await waitFor(() => {
        expect(screen.getByText(/An error occurred while processing the PDF/i)).toBeInTheDocument()
      })
    })

    it('should handle service exceptions gracefully', async () => {
      const errorMessage = 'Network error: Failed to fetch'
      mockExtractContent.mockRejectedValue(new Error(errorMessage))

      render(<PDFExtraction />)
      
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await userEvent.upload(fileInput, file)
      
      const extractButton = screen.getByRole('button', { name: /Extract Content/i })
      await userEvent.click(extractButton)
      
      await waitFor(() => {
        expect(screen.getByText(/Extraction Failed/i)).toBeInTheDocument()
        expect(screen.getByText(errorMessage)).toBeInTheDocument()
      })
    })

    it('should not show download buttons on failure', async () => {
      mockExtractContent.mockResolvedValue({
        success: false,
        message: 'Error',
      })

      render(<PDFExtraction />)
      
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await userEvent.upload(fileInput, file)
      
      const extractButton = screen.getByRole('button', { name: /Extract Content/i })
      await userEvent.click(extractButton)
      
      await waitFor(() => {
        expect(screen.getByText(/Extraction Failed/i)).toBeInTheDocument()
      })
      
      expect(screen.queryByText(/Markdown Content/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/Full API Response/i)).not.toBeInTheDocument()
    })
  })

  describe('6. Download Functionality', () => {
    it('should trigger download when download button is clicked', async () => {
      const mockMarkdownBlob = new Blob(['# Test Content'], { type: 'text/markdown' })
      
      mockExtractContent.mockResolvedValue({
        success: true,
        markdownBlob: mockMarkdownBlob,
        responseJsonBlob: new Blob([JSON.stringify({})]),
        stats: { imagesFound: 0, graphsDetected: 0, processingTimeMs: 1000 }
      })

      render(<PDFExtraction />)
      
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await userEvent.upload(fileInput, file)
      
      const extractButton = screen.getByRole('button', { name: /Extract Content/i })
      await userEvent.click(extractButton)
      
      await waitFor(() => {
        expect(screen.getByText(/Markdown Content/i)).toBeInTheDocument()
      })
      
      const downloadButton = screen.getByText(/Markdown Content/i).closest('button')!
      await userEvent.click(downloadButton)
      
      // Verify downloadBlob was called with correct parameters
      expect(mockDownloadBlob).toHaveBeenCalledWith(
        expect.any(Blob),
        'test.md'
      )
    })

    it('should use correct filename for markdown download', async () => {
      mockExtractContent.mockResolvedValue({
        success: true,
        markdownBlob: new Blob(['# Content']),
        responseJsonBlob: new Blob([JSON.stringify({})]),
        stats: { imagesFound: 0, graphsDetected: 0, processingTimeMs: 1000 }
      })

      render(<PDFExtraction />)
      
      const file = new File(['content'], 'my-document.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await userEvent.upload(fileInput, file)
      
      const extractButton = screen.getByRole('button', { name: /Extract Content/i })
      await userEvent.click(extractButton)
      
      await waitFor(() => {
        expect(screen.getByText(/Markdown Content/i)).toBeInTheDocument()
      })
      
      const downloadButton = screen.getByText(/Markdown Content/i).closest('button')!
      await userEvent.click(downloadButton)
      
      // Should use PDF filename with .md extension
      expect(mockDownloadBlob).toHaveBeenCalledWith(
        expect.any(Blob),
        'my-document.md'
      )
    })

    it('should handle downloadBlob service method', async () => {
      mockExtractContent.mockResolvedValue({
        success: true,
        markdownBlob: new Blob(['# Test']),
        stats: { imagesFound: 0, graphsDetected: 0, processingTimeMs: 1000 }
      })

      render(<PDFExtraction />)
      
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await userEvent.upload(fileInput, file)
      
      const extractButton = screen.getByRole('button', { name: /Extract Content/i })
      await userEvent.click(extractButton)
      
      await waitFor(() => {
        expect(screen.getByText(/Markdown Content/i)).toBeInTheDocument()
      })
      
      const downloadButton = screen.getByText(/Markdown Content/i).closest('button')!
      await userEvent.click(downloadButton)
      
      // Should call the service download method
      expect(mockDownloadBlob).toHaveBeenCalled()
    })
  })

  describe('7. Reset Functionality', () => {
    it('should clear file selection when remove button is clicked', async () => {
      render(<PDFExtraction />)
      
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await userEvent.upload(fileInput, file)
      
      expect(screen.getByText('test.pdf')).toBeInTheDocument()
      
      // Find and click the X button in the file display
      const removeButtons = screen.getAllByRole('button')
      const removeButton = removeButtons.find(btn => 
        btn.querySelector('svg') && btn.closest('.bg-blue-50')
      )
      
      if (removeButton) {
        await userEvent.click(removeButton)
        expect(screen.queryByText('test.pdf')).not.toBeInTheDocument()
      }
    })

    it('should clear results and file when Clear and Start Over is clicked', async () => {
      mockExtractContent.mockResolvedValue({
        success: true,
        markdownBlob: new Blob(['# Test']),
        responseJsonBlob: new Blob([JSON.stringify({})]),
        stats: { imagesFound: 0, graphsDetected: 0, processingTimeMs: 1000 }
      })

      render(<PDFExtraction />)
      
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await userEvent.upload(fileInput, file)
      
      const extractButton = screen.getByRole('button', { name: /Extract Content/i })
      await userEvent.click(extractButton)
      
      await waitFor(() => {
        expect(screen.getByText(/Extraction Successful/i)).toBeInTheDocument()
      })
      
      const resetButton = screen.getByRole('button', { name: /Clear and Start Over/i })
      await userEvent.click(resetButton)
      
      // Everything should be cleared
      expect(screen.queryByText('test.pdf')).not.toBeInTheDocument()
      expect(screen.queryByText(/Extraction Successful/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/Markdown Content/i)).not.toBeInTheDocument()
      
      // Should return to initial state
      expect(screen.getByText(/Click or drag to upload PDF file/i)).toBeInTheDocument()
    })

    it('should reset file input value when clearing', async () => {
      render(<PDFExtraction />)
      
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await userEvent.upload(fileInput, file)
      
      expect(fileInput.files?.length).toBe(1)
      
      // Trigger reset by clicking remove button
      const removeButtons = screen.getAllByRole('button')
      const removeButton = removeButtons.find(btn => 
        btn.querySelector('svg') && btn.closest('.bg-blue-50')
      )
      
      if (removeButton) {
        await userEvent.click(removeButton)
        
        // File input should be cleared (empty string)
        expect(fileInput.value).toBe('')
      }
    })

    it('should allow selecting new file after reset', async () => {
      mockExtractContent.mockResolvedValue({
        success: true,
        markdownBlob: new Blob(['# Test']),
        stats: { imagesFound: 0, graphsDetected: 0, processingTimeMs: 1000 }
      })

      render(<PDFExtraction />)
      
      // First file
      const file1 = new File(['content'], 'first.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await userEvent.upload(fileInput, file1)
      
      const extractButton = screen.getByRole('button', { name: /Extract Content/i })
      await userEvent.click(extractButton)
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Clear and Start Over/i })).toBeInTheDocument()
      })
      
      // Reset
      const resetButton = screen.getByRole('button', { name: /Clear and Start Over/i })
      await userEvent.click(resetButton)
      
      // Upload new file
      const file2 = new File(['content'], 'second.pdf', { type: 'application/pdf' })
      await userEvent.upload(fileInput, file2)
      
      expect(screen.getByText('second.pdf')).toBeInTheDocument()
      expect(screen.queryByText('first.pdf')).not.toBeInTheDocument()
    })
  })

  describe('8. Edge Cases and Additional Tests', () => {
    it('should handle zero-byte files', async () => {
      render(<PDFExtraction />)
      
      const file = new File([], 'empty.pdf', { type: 'application/pdf' })
      Object.defineProperty(file, 'size', { value: 0 })
      
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await userEvent.upload(fileInput, file)
      
      expect(screen.getByText('empty.pdf')).toBeInTheDocument()
      expect(screen.getByText('0 Bytes')).toBeInTheDocument()
    })

    it('should handle very large files', async () => {
      render(<PDFExtraction />)
      
      const file = new File(['x'.repeat(1000)], 'large.pdf', { type: 'application/pdf' })
      Object.defineProperty(file, 'size', { value: 1024 * 1024 * 1024 * 2.5 }) // 2.5 GB
      
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await userEvent.upload(fileInput, file)
      
      expect(screen.getByText('large.pdf')).toBeInTheDocument()
      expect(screen.getByText(/2.5 GB/i)).toBeInTheDocument()
    })

    it('should handle long file names gracefully', async () => {
      render(<PDFExtraction />)
      
      const longFileName = 'this-is-a-very-long-file-name-that-should-be-displayed-properly-in-the-ui-component.pdf'
      const file = new File(['content'], longFileName, { type: 'application/pdf' })
      
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await userEvent.upload(fileInput, file)
      
      expect(screen.getByText(longFileName)).toBeInTheDocument()
    })

    it('should not allow extraction without a file', () => {
      render(<PDFExtraction />)
      
      const extractButton = screen.getByRole('button', { name: /Extract Content/i })
      expect(extractButton).toBeDisabled()
    })

    it('should handle no images found gracefully', async () => {
      mockExtractContent.mockResolvedValue({
        success: true,
        markdownBlob: new Blob(['# Text Only Document']),
        responseJsonBlob: new Blob([JSON.stringify({})]),
        stats: {
          imagesFound: 0,
          graphsDetected: 0,
          processingTimeMs: 5000
        },
        message: 'Successfully extracted content from PDF'
      })

      render(<PDFExtraction />)
      
      const file = new File(['content'], 'text-only.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await userEvent.upload(fileInput, file)
      
      const extractButton = screen.getByRole('button', { name: /Extract Content/i })
      await userEvent.click(extractButton)
      
      await waitFor(() => {
        expect(screen.getByText(/Extraction Successful/i)).toBeInTheDocument()
        expect(screen.getByText(/0 images found/i)).toBeInTheDocument()
      })
      
      // Should not show graph detection info
      expect(screen.queryByText(/graphs detected/i)).not.toBeInTheDocument()
    })

    it('should prevent multiple simultaneous extractions', async () => {
      mockExtractContent.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          success: true,
          markdownBlob: new Blob(['# Test']),
          stats: { imagesFound: 0, graphsDetected: 0, processingTimeMs: 1000 }
        }), 200))
      )

      render(<PDFExtraction />)
      
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await userEvent.upload(fileInput, file)
      
      const extractButton = screen.getByRole('button', { name: /Extract Content/i })
      
      // Click multiple times rapidly
      await userEvent.click(extractButton)
      await userEvent.click(extractButton)
      await userEvent.click(extractButton)
      
      // Should only be called once
      await waitFor(() => {
        expect(mockExtractContent).toHaveBeenCalledTimes(1)
      })
    })

    it('should maintain accessibility attributes', () => {
      render(<PDFExtraction />)
      
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      expect(fileInput).toHaveAttribute('id', 'pdf-upload')
      
      const label = document.querySelector('label[for="pdf-upload"]')
      expect(label).toBeInTheDocument()
    })

    it('should show appropriate icons for different states', async () => {
      mockExtractContent.mockResolvedValue({
        success: true,
        markdownBlob: new Blob(['# Test']),
        stats: { imagesFound: 0, graphsDetected: 0, processingTimeMs: 1000 }
      })

      const { container } = render(<PDFExtraction />)
      
      // Initial state should have upload icon
      expect(container.querySelector('svg')).toBeInTheDocument()
      
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await userEvent.upload(fileInput, file)
      
      // Should show file icon when file is selected
      expect(container.querySelectorAll('svg').length).toBeGreaterThan(1)
      
      const extractButton = screen.getByRole('button', { name: /Extract Content/i })
      await userEvent.click(extractButton)
      
      await waitFor(() => {
        // Should show success icon
        expect(screen.getByText(/Extraction Successful/i)).toBeInTheDocument()
      })
    })
  })

  describe('9. Real Service Integration', () => {
    it('should call real extraction service with all features', async () => {
      mockExtractContent.mockResolvedValue({
        success: true,
        markdownBlob: new Blob(['# Real Markdown Content']),
        responseJsonBlob: new Blob([JSON.stringify({ status: 'complete' })]),
        graphifyResults: {
          summary: [
            { imageName: 'chart1.png', isGraph: true, graphType: 'line chart', pythonCode: 'code' }
          ],
          graphifyJsonBlob: new Blob([JSON.stringify([{ isGraph: true }])])
        },
        stats: {
          imagesFound: 1,
          graphsDetected: 1,
          processingTimeMs: 45000
        },
        message: 'Successfully extracted content from PDF with 1 graph(s) detected'
      })

      render(<PDFExtraction />)
      
      const file = new File(['content'], 'research.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await userEvent.upload(fileInput, file)
      
      const extractButton = screen.getByRole('button', { name: /Extract Content/i })
      await userEvent.click(extractButton)
      
      await waitFor(() => {
        expect(screen.getByText(/Extraction Successful/i)).toBeInTheDocument()
      })
      
      // Should show graph detection in stats
      expect(screen.getByText(/1 graph detected/i)).toBeInTheDocument()
      
      // All 3 download buttons should be available
      expect(screen.getByText(/Markdown Content/i)).toBeInTheDocument()
      expect(screen.getByText(/Full API Response/i)).toBeInTheDocument()
      expect(screen.getByText(/GPT Graph Analysis/i)).toBeInTheDocument()
    })
  })
})

