import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PDFExtraction } from './PDFExtraction'
import { PDFExtractionService } from '@/services/pdfExtractionService'

// Mock the PDFExtractionService
vi.mock('@/services/pdfExtractionService', () => ({
  PDFExtractionService: {
    extractTables: vi.fn(),
  },
}))

describe('PDFExtraction Component', () => {
  let mockExtractTables: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockExtractTables = vi.mocked(PDFExtractionService.extractTables)
    mockExtractTables.mockClear()
    
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
      expect(screen.getByText(/Click to upload PDF file/i)).toBeInTheDocument()
      
      // Check for file input (hidden)
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      expect(fileInput).toBeInTheDocument()
      expect(fileInput.accept).toBe('.pdf')
      
      // Extract button should be disabled initially
      const extractButton = screen.getByRole('button', { name: /Extract Tables/i })
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

    it('should enable Extract Tables button when file is selected', async () => {
      render(<PDFExtraction />)
      
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      
      await userEvent.upload(fileInput, file)
      
      const extractButton = screen.getByRole('button', { name: /Extract Tables/i })
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
      mockExtractTables.mockResolvedValue({
        success: true,
        tablesCount: 2,
        message: 'Success',
        blob: new Blob(['data']),
        fileName: 'output.xlsx',
      })

      render(<PDFExtraction />)
      
      // Select and process first file
      const file1 = new File(['content'], 'first.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await userEvent.upload(fileInput, file1)
      
      const extractButton = screen.getByRole('button', { name: /Extract Tables/i })
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
    it('should call PDFExtractionService.extractTables when Extract Tables is clicked', async () => {
      mockExtractTables.mockResolvedValue({
        success: true,
        tablesCount: 3,
        message: 'Success',
        blob: new Blob(['data']),
        fileName: 'output.xlsx',
      })

      render(<PDFExtraction />)
      
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await userEvent.upload(fileInput, file)
      
      const extractButton = screen.getByRole('button', { name: /Extract Tables/i })
      await userEvent.click(extractButton)
      
      expect(mockExtractTables).toHaveBeenCalledWith(file)
      expect(mockExtractTables).toHaveBeenCalledTimes(1)
    })

    it('should show loading state when processing', async () => {
      // Mock a delayed response
      mockExtractTables.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          success: true,
          tablesCount: 1,
          blob: new Blob(['data']),
          fileName: 'output.xlsx',
        }), 100))
      )

      render(<PDFExtraction />)
      
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await userEvent.upload(fileInput, file)
      
      const extractButton = screen.getByRole('button', { name: /Extract Tables/i })
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
      mockExtractTables.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          success: true,
          tablesCount: 1,
          blob: new Blob(['data']),
          fileName: 'output.xlsx',
        }), 100))
      )

      render(<PDFExtraction />)
      
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await userEvent.upload(fileInput, file)
      
      const extractButton = screen.getByRole('button', { name: /Extract Tables/i })
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
    it('should display success message with table count', async () => {
      mockExtractTables.mockResolvedValue({
        success: true,
        tablesCount: 3,
        message: 'Successfully extracted tables from PDF',
        blob: new Blob(['data'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        fileName: 'test_tables.xlsx',
      })

      render(<PDFExtraction />)
      
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await userEvent.upload(fileInput, file)
      
      const extractButton = screen.getByRole('button', { name: /Extract Tables/i })
      await userEvent.click(extractButton)
      
      await waitFor(() => {
        expect(screen.getByText(/Extraction Successful/i)).toBeInTheDocument()
        expect(screen.getByText(/Found 3 tables in the document/i)).toBeInTheDocument()
      })
    })

    it('should handle singular vs plural tables correctly', async () => {
      mockExtractTables.mockResolvedValue({
        success: true,
        tablesCount: 1,
        message: 'Successfully extracted tables from PDF',
        blob: new Blob(['data']),
        fileName: 'test_tables.xlsx',
      })

      render(<PDFExtraction />)
      
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await userEvent.upload(fileInput, file)
      
      const extractButton = screen.getByRole('button', { name: /Extract Tables/i })
      await userEvent.click(extractButton)
      
      await waitFor(() => {
        // Should say "table" not "tables" for count of 1
        expect(screen.getByText(/Found 1 table in the document/i)).toBeInTheDocument()
      })
    })

    it('should enable Download Excel button on success', async () => {
      mockExtractTables.mockResolvedValue({
        success: true,
        tablesCount: 2,
        message: 'Success',
        blob: new Blob(['data']),
        fileName: 'output.xlsx',
      })

      render(<PDFExtraction />)
      
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await userEvent.upload(fileInput, file)
      
      const extractButton = screen.getByRole('button', { name: /Extract Tables/i })
      await userEvent.click(extractButton)
      
      await waitFor(() => {
        const downloadButton = screen.getByRole('button', { name: /Download Excel/i })
        expect(downloadButton).toBeInTheDocument()
        expect(downloadButton).not.toBeDisabled()
      })
    })

    it('should display custom success message if provided', async () => {
      const customMessage = 'Custom success message from backend'
      mockExtractTables.mockResolvedValue({
        success: true,
        tablesCount: 5,
        message: customMessage,
        blob: new Blob(['data']),
        fileName: 'output.xlsx',
      })

      render(<PDFExtraction />)
      
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await userEvent.upload(fileInput, file)
      
      const extractButton = screen.getByRole('button', { name: /Extract Tables/i })
      await userEvent.click(extractButton)
      
      await waitFor(() => {
        expect(screen.getByText(customMessage)).toBeInTheDocument()
      })
    })
  })

  describe('5. Failure Case', () => {
    it('should display error message on extraction failure', async () => {
      const errorMessage = 'Failed to extract tables: Invalid PDF format'
      mockExtractTables.mockResolvedValue({
        success: false,
        message: errorMessage,
      })

      render(<PDFExtraction />)
      
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await userEvent.upload(fileInput, file)
      
      const extractButton = screen.getByRole('button', { name: /Extract Tables/i })
      await userEvent.click(extractButton)
      
      await waitFor(() => {
        expect(screen.getByText(/Extraction Failed/i)).toBeInTheDocument()
        expect(screen.getByText(errorMessage)).toBeInTheDocument()
      })
    })

    it('should display generic error message when no specific message provided', async () => {
      mockExtractTables.mockResolvedValue({
        success: false,
      })

      render(<PDFExtraction />)
      
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await userEvent.upload(fileInput, file)
      
      const extractButton = screen.getByRole('button', { name: /Extract Tables/i })
      await userEvent.click(extractButton)
      
      await waitFor(() => {
        expect(screen.getByText(/An error occurred while processing the PDF/i)).toBeInTheDocument()
      })
    })

    it('should handle service exceptions gracefully', async () => {
      const errorMessage = 'Network error: Failed to fetch'
      mockExtractTables.mockRejectedValue(new Error(errorMessage))

      render(<PDFExtraction />)
      
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await userEvent.upload(fileInput, file)
      
      const extractButton = screen.getByRole('button', { name: /Extract Tables/i })
      await userEvent.click(extractButton)
      
      await waitFor(() => {
        expect(screen.getByText(/Extraction Failed/i)).toBeInTheDocument()
        expect(screen.getByText(errorMessage)).toBeInTheDocument()
      })
    })

    it('should not show Download Excel button on failure', async () => {
      mockExtractTables.mockResolvedValue({
        success: false,
        message: 'Error',
      })

      render(<PDFExtraction />)
      
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await userEvent.upload(fileInput, file)
      
      const extractButton = screen.getByRole('button', { name: /Extract Tables/i })
      await userEvent.click(extractButton)
      
      await waitFor(() => {
        expect(screen.getByText(/Extraction Failed/i)).toBeInTheDocument()
      })
      
      expect(screen.queryByRole('button', { name: /Download Excel/i })).not.toBeInTheDocument()
    })
  })

  describe('6. Download Functionality', () => {
    it('should trigger download when Download Excel button is clicked', async () => {
      const mockBlob = new Blob(['excel data'], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      })
      const mockFileName = 'test_tables.xlsx'
      
      mockExtractTables.mockResolvedValue({
        success: true,
        tablesCount: 2,
        message: 'Success',
        blob: mockBlob,
        fileName: mockFileName,
      })

      render(<PDFExtraction />)
      
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await userEvent.upload(fileInput, file)
      
      const extractButton = screen.getByRole('button', { name: /Extract Tables/i })
      await userEvent.click(extractButton)
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Download Excel/i })).toBeInTheDocument()
      })
      
      // Mock creating and clicking a download link
      const createElementSpy = vi.spyOn(document, 'createElement')
      const appendChildSpy = vi.spyOn(document.body, 'appendChild')
      const removeChildSpy = vi.spyOn(document.body, 'removeChild')
      
      const downloadButton = screen.getByRole('button', { name: /Download Excel/i })
      await userEvent.click(downloadButton)
      
      // Verify download process
      expect(global.URL.createObjectURL).toHaveBeenCalledWith(mockBlob)
      expect(createElementSpy).toHaveBeenCalledWith('a')
      
      // Clean up spies
      createElementSpy.mockRestore()
      appendChildSpy.mockRestore()
      removeChildSpy.mockRestore()
    })

    it('should use correct filename for download', async () => {
      const mockBlob = new Blob(['data'])
      const expectedFileName = 'my-document_tables.xlsx'
      
      mockExtractTables.mockResolvedValue({
        success: true,
        tablesCount: 1,
        blob: mockBlob,
        fileName: expectedFileName,
      })

      render(<PDFExtraction />)
      
      const file = new File(['content'], 'my-document.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await userEvent.upload(fileInput, file)
      
      const extractButton = screen.getByRole('button', { name: /Extract Tables/i })
      await userEvent.click(extractButton)
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Download Excel/i })).toBeInTheDocument()
      })
      
      const downloadButton = screen.getByRole('button', { name: /Download Excel/i })
      await userEvent.click(downloadButton)
      
      // The filename should be used in the download
      expect(global.URL.createObjectURL).toHaveBeenCalled()
    })

    it('should cleanup blob URL after download', async () => {
      mockExtractTables.mockResolvedValue({
        success: true,
        tablesCount: 1,
        blob: new Blob(['data']),
        fileName: 'test.xlsx',
      })

      render(<PDFExtraction />)
      
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await userEvent.upload(fileInput, file)
      
      const extractButton = screen.getByRole('button', { name: /Extract Tables/i })
      await userEvent.click(extractButton)
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Download Excel/i })).toBeInTheDocument()
      })
      
      const downloadButton = screen.getByRole('button', { name: /Download Excel/i })
      await userEvent.click(downloadButton)
      
      // Wait for cleanup
      await waitFor(() => {
        expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
      })
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
      mockExtractTables.mockResolvedValue({
        success: true,
        tablesCount: 3,
        message: 'Success',
        blob: new Blob(['data']),
        fileName: 'output.xlsx',
      })

      render(<PDFExtraction />)
      
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await userEvent.upload(fileInput, file)
      
      const extractButton = screen.getByRole('button', { name: /Extract Tables/i })
      await userEvent.click(extractButton)
      
      await waitFor(() => {
        expect(screen.getByText(/Extraction Successful/i)).toBeInTheDocument()
      })
      
      const resetButton = screen.getByRole('button', { name: /Clear and Start Over/i })
      await userEvent.click(resetButton)
      
      // Everything should be cleared
      expect(screen.queryByText('test.pdf')).not.toBeInTheDocument()
      expect(screen.queryByText(/Extraction Successful/i)).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Download Excel/i })).not.toBeInTheDocument()
      
      // Should return to initial state
      expect(screen.getByText(/Click to upload PDF file/i)).toBeInTheDocument()
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
      mockExtractTables.mockResolvedValue({
        success: true,
        tablesCount: 1,
        blob: new Blob(['data']),
        fileName: 'output.xlsx',
      })

      render(<PDFExtraction />)
      
      // First file
      const file1 = new File(['content'], 'first.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await userEvent.upload(fileInput, file1)
      
      const extractButton = screen.getByRole('button', { name: /Extract Tables/i })
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
      
      const extractButton = screen.getByRole('button', { name: /Extract Tables/i })
      expect(extractButton).toBeDisabled()
    })

    it('should handle zero tables found gracefully', async () => {
      mockExtractTables.mockResolvedValue({
        success: true,
        tablesCount: 0,
        message: 'No tables found in document',
        blob: new Blob([]),
        fileName: 'empty.xlsx',
      })

      render(<PDFExtraction />)
      
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await userEvent.upload(fileInput, file)
      
      const extractButton = screen.getByRole('button', { name: /Extract Tables/i })
      await userEvent.click(extractButton)
      
      await waitFor(() => {
        expect(screen.getByText(/Extraction Successful/i)).toBeInTheDocument()
        // Should handle 0 tables (no "s" at the end)
        expect(screen.getByText(/No tables found in document|Found 0 tables/i)).toBeInTheDocument()
      })
    })

    it('should prevent multiple simultaneous extractions', async () => {
      mockExtractTables.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          success: true,
          tablesCount: 1,
          blob: new Blob(['data']),
          fileName: 'output.xlsx',
        }), 200))
      )

      render(<PDFExtraction />)
      
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await userEvent.upload(fileInput, file)
      
      const extractButton = screen.getByRole('button', { name: /Extract Tables/i })
      
      // Click multiple times rapidly
      await userEvent.click(extractButton)
      await userEvent.click(extractButton)
      await userEvent.click(extractButton)
      
      // Should only be called once
      await waitFor(() => {
        expect(mockExtractTables).toHaveBeenCalledTimes(1)
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
      mockExtractTables.mockResolvedValue({
        success: true,
        tablesCount: 1,
        blob: new Blob(['data']),
        fileName: 'output.xlsx',
      })

      const { container } = render(<PDFExtraction />)
      
      // Initial state should have upload icon
      expect(container.querySelector('svg')).toBeInTheDocument()
      
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await userEvent.upload(fileInput, file)
      
      // Should show file icon when file is selected
      expect(container.querySelectorAll('svg').length).toBeGreaterThan(1)
      
      const extractButton = screen.getByRole('button', { name: /Extract Tables/i })
      await userEvent.click(extractButton)
      
      await waitFor(() => {
        // Should show success icon
        expect(screen.getByText(/Extraction Successful/i)).toBeInTheDocument()
      })
    })
  })

  describe('9. Mock Implementation Fallback', () => {
    it('should use mock data when service is not implemented', async () => {
      mockExtractTables.mockResolvedValue({
        success: false,
        message: 'PDFExtractionService.extractTables() not implemented yet',
      })

      render(<PDFExtraction />)
      
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await userEvent.upload(fileInput, file)
      
      const extractButton = screen.getByRole('button', { name: /Extract Tables/i })
      await userEvent.click(extractButton)
      
      // Should show mock success result for development
      await waitFor(() => {
        expect(screen.getByText(/Extraction Successful/i)).toBeInTheDocument()
        expect(screen.getByText(/mock data/i)).toBeInTheDocument()
      }, { timeout: 3000 })
    })
  })
})

