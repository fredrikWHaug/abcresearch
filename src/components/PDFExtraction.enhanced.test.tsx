import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PDFExtraction } from './PDFExtraction'
import { PDFExtractionService } from '@/services/pdfExtractionService'

// Mock the service
vi.mock('@/services/pdfExtractionService', () => ({
  PDFExtractionService: {
    extractContent: vi.fn(),
    downloadBlob: vi.fn(),
  },
}))

describe('PDFExtraction - Enhanced Features', () => {
  let mockExtractContent: ReturnType<typeof vi.fn>
  let mockDownloadBlob: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockExtractContent = vi.mocked(PDFExtractionService.extractContent)
    mockDownloadBlob = vi.mocked(PDFExtractionService.downloadBlob)
    mockExtractContent.mockClear()
    mockDownloadBlob.mockClear()
  })

  describe('Options UI', () => {
    it('should display options panel when file is selected', async () => {
      render(<PDFExtraction />)
      
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await userEvent.upload(fileInput, file)
      
      // Options panel should appear
      expect(screen.getByText('Extraction Options:')).toBeInTheDocument()
      expect(screen.getByText(/Enable graph detection with GPT Vision/i)).toBeInTheDocument()
    })

    it('should toggle graphify option', async () => {
      render(<PDFExtraction />)
      
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await userEvent.upload(fileInput, file)
      
      const checkbox = screen.getByRole('checkbox') as HTMLInputElement
      expect(checkbox.checked).toBe(true) // Default enabled
      
      await userEvent.click(checkbox)
      expect(checkbox.checked).toBe(false)
    })

    it('should show max images slider when graphify enabled', async () => {
      render(<PDFExtraction />)
      
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await userEvent.upload(fileInput, file)
      
      expect(screen.getByText(/Max images to analyze:/i)).toBeInTheDocument()
      expect(screen.getByText('10')).toBeInTheDocument() // Default value
    })

    it('should adjust max images with slider', async () => {
      render(<PDFExtraction />)
      
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await userEvent.upload(fileInput, file)
      
      const slider = screen.getByRole('slider') as HTMLInputElement
      expect(slider.value).toBe('10')
      
      fireEvent.change(slider, { target: { value: '15' } })
      expect(slider.value).toBe('15')
    })

    it('should hide slider when graphify disabled', async () => {
      render(<PDFExtraction />)
      
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await userEvent.upload(fileInput, file)
      
      const checkbox = screen.getByRole('checkbox')
      await userEvent.click(checkbox) // Disable
      
      expect(screen.queryByRole('slider')).not.toBeInTheDocument()
    })

    it('should pass options to service when extracting', async () => {
      mockExtractContent.mockResolvedValue({
        success: true,
        markdownBlob: new Blob(['markdown']),
        stats: { imagesFound: 0, graphsDetected: 0, processingTimeMs: 1000 }
      })

      render(<PDFExtraction />)
      
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await userEvent.upload(fileInput, file)
      
      // Change options
      const checkbox = screen.getByRole('checkbox')
      await userEvent.click(checkbox) // Disable graphify
      
      const extractButton = screen.getByRole('button', { name: /Extract Content/i })
      await userEvent.click(extractButton)
      
      await waitFor(() => {
        expect(mockExtractContent).toHaveBeenCalledWith(file, {
          enableGraphify: false,
          forceOCR: false,
          maxGraphifyImages: 10
        })
      })
    })
  })

  describe('Download Functionality - Enhanced', () => {
    it('should show markdown download button on success', async () => {
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
      })
    })

    it('should show all 3 download buttons when all data available', async () => {
      mockExtractContent.mockResolvedValue({
        success: true,
        markdownBlob: new Blob(['# Test'], { type: 'text/markdown' }),
        responseJsonBlob: new Blob([JSON.stringify({})], { type: 'application/json' }),
        graphifyResults: {
          summary: [{ imageName: 'fig1.png', isGraph: true, graphType: 'line chart' }],
          graphifyJsonBlob: new Blob([JSON.stringify([])], { type: 'application/json' })
        },
        stats: { imagesFound: 1, graphsDetected: 1, processingTimeMs: 2000 }
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
        expect(screen.getByText(/GPT Graph Analysis/i)).toBeInTheDocument()
      })
    })

    it('should trigger markdown download with correct filename', async () => {
      mockExtractContent.mockResolvedValue({
        success: true,
        markdownBlob: new Blob(['# Test'], { type: 'text/markdown' }),
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
      
      expect(mockDownloadBlob).toHaveBeenCalledWith(
        expect.any(Blob),
        'my-document.md'
      )
    })

    it('should trigger JSON response download', async () => {
      mockExtractContent.mockResolvedValue({
        success: true,
        markdownBlob: new Blob(['# Test']),
        responseJsonBlob: new Blob([JSON.stringify({ test: 'data' })]),
        stats: { imagesFound: 0, graphsDetected: 0, processingTimeMs: 1000 }
      })

      render(<PDFExtraction />)
      
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await userEvent.upload(fileInput, file)
      
      const extractButton = screen.getByRole('button', { name: /Extract Content/i })
      await userEvent.click(extractButton)
      
      await waitFor(() => {
        expect(screen.getByText(/Full API Response/i)).toBeInTheDocument()
      })
      
      const downloadButton = screen.getByText(/Full API Response/i).closest('button')!
      await userEvent.click(downloadButton)
      
      expect(mockDownloadBlob).toHaveBeenCalledWith(
        expect.any(Blob),
        'test-response.json'
      )
    })

    it('should trigger GPT analysis download', async () => {
      mockExtractContent.mockResolvedValue({
        success: true,
        markdownBlob: new Blob(['# Test']),
        responseJsonBlob: new Blob([JSON.stringify({})]),
        graphifyResults: {
          summary: [{ imageName: 'fig1.png', isGraph: true, graphType: 'bar chart' }],
          graphifyJsonBlob: new Blob([JSON.stringify([{ isGraph: true }])])
        },
        stats: { imagesFound: 1, graphsDetected: 1, processingTimeMs: 2000 }
      })

      render(<PDFExtraction />)
      
      const file = new File(['content'], 'research.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await userEvent.upload(fileInput, file)
      
      const extractButton = screen.getByRole('button', { name: /Extract Content/i })
      await userEvent.click(extractButton)
      
      await waitFor(() => {
        expect(screen.getByText(/GPT Graph Analysis/i)).toBeInTheDocument()
      })
      
      const downloadButton = screen.getByText(/GPT Graph Analysis/i).closest('button')!
      await userEvent.click(downloadButton)
      
      expect(mockDownloadBlob).toHaveBeenCalledWith(
        expect.any(Blob),
        'research-gpt-analysis.json'
      )
    })

    it('should hide GPT download when graphify disabled', async () => {
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
      
      // Disable graphify
      const checkbox = screen.getByRole('checkbox')
      await userEvent.click(checkbox)
      
      const extractButton = screen.getByRole('button', { name: /Extract Content/i })
      await userEvent.click(extractButton)
      
      await waitFor(() => {
        expect(screen.getByText(/Extraction Successful/i)).toBeInTheDocument()
      })
      
      expect(screen.queryByText(/GPT Graph Analysis/i)).not.toBeInTheDocument()
    })
  })

  describe('Stats Display', () => {
    it('should display extraction statistics', async () => {
      mockExtractContent.mockResolvedValue({
        success: true,
        markdownBlob: new Blob(['# Test']),
        responseJsonBlob: new Blob([JSON.stringify({})]),
        stats: {
          imagesFound: 5,
          graphsDetected: 2,
          processingTimeMs: 45000
        }
      })

      render(<PDFExtraction />)
      
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await userEvent.upload(fileInput, file)
      
      const extractButton = screen.getByRole('button', { name: /Extract Content/i })
      await userEvent.click(extractButton)
      
      await waitFor(() => {
        expect(screen.getByText(/5 images found/i)).toBeInTheDocument()
        expect(screen.getByText(/2 graphs detected/i)).toBeInTheDocument()
        expect(screen.getByText(/Processed in 45\.0s/i)).toBeInTheDocument()
      })
    })

    it('should handle singular vs plural for images', async () => {
      mockExtractContent.mockResolvedValue({
        success: true,
        markdownBlob: new Blob(['# Test']),
        stats: {
          imagesFound: 1,
          graphsDetected: 0,
          processingTimeMs: 10000
        }
      })

      render(<PDFExtraction />)
      
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await userEvent.upload(fileInput, file)
      
      const extractButton = screen.getByRole('button', { name: /Extract Content/i })
      await userEvent.click(extractButton)
      
      await waitFor(() => {
        expect(screen.getByText(/1 image found/i)).toBeInTheDocument() // Singular
      })
    })

    it('should handle singular vs plural for graphs', async () => {
      mockExtractContent.mockResolvedValue({
        success: true,
        markdownBlob: new Blob(['# Test']),
        graphifyResults: {
          summary: [{ imageName: 'fig1.png', isGraph: true }],
          graphifyJsonBlob: new Blob([JSON.stringify([])])
        },
        stats: {
          imagesFound: 1,
          graphsDetected: 1,
          processingTimeMs: 20000
        }
      })

      render(<PDFExtraction />)
      
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await userEvent.upload(fileInput, file)
      
      const extractButton = screen.getByRole('button', { name: /Extract Content/i })
      await userEvent.click(extractButton)
      
      await waitFor(() => {
        expect(screen.getByText(/1 graph detected/i)).toBeInTheDocument() // Singular
      })
    })
  })

  describe('Graph Detection Summary', () => {
    it('should display graph summary when graphs detected', async () => {
      mockExtractContent.mockResolvedValue({
        success: true,
        markdownBlob: new Blob(['# Test']),
        graphifyResults: {
          summary: [
            { imageName: 'figure1.png', isGraph: true, graphType: 'line chart' },
            { imageName: 'figure2.png', isGraph: true, graphType: 'bar chart' },
            { imageName: 'figure3.png', isGraph: false }
          ],
          graphifyJsonBlob: new Blob([JSON.stringify([])])
        },
        stats: { imagesFound: 3, graphsDetected: 2, processingTimeMs: 30000 }
      })

      render(<PDFExtraction />)
      
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await userEvent.upload(fileInput, file)
      
      const extractButton = screen.getByRole('button', { name: /Extract Content/i })
      await userEvent.click(extractButton)
      
      await waitFor(() => {
        expect(screen.getByText('Graph Detection Summary:')).toBeInTheDocument()
        expect(screen.getByText(/figure1\.png/i)).toBeInTheDocument()
        expect(screen.getByText(/line chart/i)).toBeInTheDocument()
        expect(screen.getByText(/figure2\.png/i)).toBeInTheDocument()
        expect(screen.getByText(/bar chart/i)).toBeInTheDocument()
        // figure3 should not appear (not a graph)
        expect(screen.queryByText(/figure3\.png/i)).not.toBeInTheDocument()
      })
    })

    it('should show "more graphs" indicator when >5 graphs', async () => {
      const manyGraphs = Array.from({ length: 10 }, (_, i) => ({
        imageName: `figure${i + 1}.png`,
        isGraph: true,
        graphType: 'chart'
      }))

      mockExtractContent.mockResolvedValue({
        success: true,
        markdownBlob: new Blob(['# Test']),
        graphifyResults: {
          summary: manyGraphs,
          graphifyJsonBlob: new Blob([JSON.stringify(manyGraphs)])
        },
        stats: { imagesFound: 10, graphsDetected: 10, processingTimeMs: 60000 }
      })

      render(<PDFExtraction />)
      
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await userEvent.upload(fileInput, file)
      
      const extractButton = screen.getByRole('button', { name: /Extract Content/i })
      await userEvent.click(extractButton)
      
      await waitFor(() => {
        expect(screen.getByText(/\+5 more graphs/i)).toBeInTheDocument()
      })
    })

    it('should not show summary when no graphs detected', async () => {
      mockExtractContent.mockResolvedValue({
        success: true,
        markdownBlob: new Blob(['# Test']),
        graphifyResults: {
          summary: [
            { imageName: 'photo1.png', isGraph: false },
            { imageName: 'photo2.png', isGraph: false }
          ],
          graphifyJsonBlob: new Blob([JSON.stringify([])])
        },
        stats: { imagesFound: 2, graphsDetected: 0, processingTimeMs: 15000 }
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
      
      expect(screen.queryByText('Graph Detection Summary:')).not.toBeInTheDocument()
    })
  })

  describe('Service Integration', () => {
    it('should call extractContent with file and options', async () => {
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
      
      expect(mockExtractContent).toHaveBeenCalledWith(file, {
        enableGraphify: true,
        forceOCR: false,
        maxGraphifyImages: 10
      })
    })

    it('should handle service errors gracefully', async () => {
      mockExtractContent.mockResolvedValue({
        success: false,
        message: 'API error: Datalab service unavailable'
      })

      render(<PDFExtraction />)
      
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await userEvent.upload(fileInput, file)
      
      const extractButton = screen.getByRole('button', { name: /Extract Content/i })
      await userEvent.click(extractButton)
      
      await waitFor(() => {
        expect(screen.getByText(/Extraction Failed/i)).toBeInTheDocument()
        expect(screen.getByText(/API error: Datalab service unavailable/i)).toBeInTheDocument()
      })
    })

    it('should handle service exceptions', async () => {
      mockExtractContent.mockRejectedValue(new Error('Network error'))

      render(<PDFExtraction />)
      
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await userEvent.upload(fileInput, file)
      
      const extractButton = screen.getByRole('button', { name: /Extract Content/i })
      await userEvent.click(extractButton)
      
      await waitFor(() => {
        expect(screen.getByText(/Extraction Failed/i)).toBeInTheDocument()
      })
    })
  })

  describe('Edge Cases', () => {
    it('should handle PDF with many images but no graphs', async () => {
      mockExtractContent.mockResolvedValue({
        success: true,
        markdownBlob: new Blob(['# Test']),
        graphifyResults: {
          summary: Array.from({ length: 20 }, (_, i) => ({
            imageName: `image${i}.png`,
            isGraph: false
          })),
          graphifyJsonBlob: new Blob([JSON.stringify([])])
        },
        stats: { imagesFound: 20, graphsDetected: 0, processingTimeMs: 90000 }
      })

      render(<PDFExtraction />)
      
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await userEvent.upload(fileInput, file)
      
      const extractButton = screen.getByRole('button', { name: /Extract Content/i })
      await userEvent.click(extractButton)
      
      await waitFor(() => {
        expect(screen.getByText(/20 images found/i)).toBeInTheDocument()
      })
      
      expect(screen.queryByText(/graphs detected/i)).not.toBeInTheDocument()
    })

    it('should handle long processing times', async () => {
      mockExtractContent.mockResolvedValue({
        success: true,
        markdownBlob: new Blob(['# Large Document']),
        stats: {
          imagesFound: 0,
          graphsDetected: 0,
          processingTimeMs: 240000 // 4 minutes
        }
      })

      render(<PDFExtraction />)
      
      const file = new File(['content'], 'large.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await userEvent.upload(fileInput, file)
      
      const extractButton = screen.getByRole('button', { name: /Extract Content/i })
      await userEvent.click(extractButton)
      
      await waitFor(() => {
        expect(screen.getByText(/Processed in 240\.0s/i)).toBeInTheDocument()
      })
    })

    it('should handle missing optional fields gracefully', async () => {
      mockExtractContent.mockResolvedValue({
        success: true,
        markdownBlob: new Blob(['# Test']),
        // Missing responseJsonBlob, graphifyResults, and stats
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
      
      // Should only show markdown download
      expect(screen.getByText(/Markdown Content/i)).toBeInTheDocument()
      expect(screen.queryByText(/Full API Response/i)).not.toBeInTheDocument()
    })
  })

  describe('User Experience', () => {
    it('should hide options panel during processing', async () => {
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
      
      expect(screen.getByText('Extraction Options:')).toBeInTheDocument()
      
      const extractButton = screen.getByRole('button', { name: /Extract Content/i })
      await userEvent.click(extractButton)
      
      // Options should be hidden during processing
      expect(screen.queryByText('Extraction Options:')).not.toBeInTheDocument()
      
      await waitFor(() => {
        expect(screen.getByText(/Extraction Successful/i)).toBeInTheDocument()
      })
    })

    it('should show options panel after reset', async () => {
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
        expect(screen.getByRole('button', { name: /Clear and Start Over/i })).toBeInTheDocument()
      })
      
      const resetButton = screen.getByRole('button', { name: /Clear and Start Over/i })
      await userEvent.click(resetButton)
      
      // Upload new file
      const file2 = new File(['content'], 'test2.pdf', { type: 'application/pdf' })
      await userEvent.upload(fileInput, file2)
      
      // Options should be shown again
      expect(screen.getByText('Extraction Options:')).toBeInTheDocument()
    })

    it('should update button text from "Extract Tables" to "Extract Content"', () => {
      render(<PDFExtraction />)
      
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      fireEvent.change(fileInput, { target: { files: [file] } })
      
      const extractButton = screen.getByRole('button', { name: /Extract Content/i })
      expect(extractButton).toBeInTheDocument()
    })
  })

  describe('Complex Scenarios', () => {
    it('should handle mixed results (some graphs, some not)', async () => {
      mockExtractContent.mockResolvedValue({
        success: true,
        markdownBlob: new Blob(['# Research Paper']),
        responseJsonBlob: new Blob([JSON.stringify({})]),
        graphifyResults: {
          summary: [
            { imageName: 'chart1.png', isGraph: true, graphType: 'scatter plot' },
            { imageName: 'photo.jpg', isGraph: false },
            { imageName: 'diagram.png', isGraph: false },
            { imageName: 'chart2.png', isGraph: true, graphType: 'histogram' }
          ],
          graphifyJsonBlob: new Blob([JSON.stringify([])])
        },
        stats: { imagesFound: 4, graphsDetected: 2, processingTimeMs: 35000 }
      })

      render(<PDFExtraction />)
      
      const file = new File(['content'], 'research.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await userEvent.upload(fileInput, file)
      
      const extractButton = screen.getByRole('button', { name: /Extract Content/i })
      await userEvent.click(extractButton)
      
      await waitFor(() => {
        expect(screen.getByText(/4 images found/i)).toBeInTheDocument()
        expect(screen.getByText(/2 graphs detected/i)).toBeInTheDocument()
        expect(screen.getByText(/chart1\.png/i)).toBeInTheDocument()
        expect(screen.getByText(/chart2\.png/i)).toBeInTheDocument()
      })
    })

    it('should allow multiple sequential extractions', async () => {
      mockExtractContent.mockResolvedValue({
        success: true,
        markdownBlob: new Blob(['# Test']),
        stats: { imagesFound: 0, graphsDetected: 0, processingTimeMs: 1000 }
      })

      render(<PDFExtraction />)
      
      // First extraction
      const file1 = new File(['content'], 'first.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await userEvent.upload(fileInput, file1)
      
      let extractButton = screen.getByRole('button', { name: /Extract Content/i })
      await userEvent.click(extractButton)
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Clear and Start Over/i })).toBeInTheDocument()
      })
      
      // Reset
      const resetButton = screen.getByRole('button', { name: /Clear and Start Over/i })
      await userEvent.click(resetButton)
      
      // Second extraction
      const file2 = new File(['content'], 'second.pdf', { type: 'application/pdf' })
      await userEvent.upload(fileInput, file2)
      
      extractButton = screen.getByRole('button', { name: /Extract Content/i })
      await userEvent.click(extractButton)
      
      expect(mockExtractContent).toHaveBeenCalledTimes(2)
    })
  })

  describe('Accessibility', () => {
    it('should maintain proper heading hierarchy', () => {
      render(<PDFExtraction />)
      
      // Check for main title
      expect(screen.getByText('PDF Table Extraction')).toBeInTheDocument()
    })

    it('should have accessible form controls', async () => {
      render(<PDFExtraction />)
      
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await userEvent.upload(fileInput, file)
      
      const checkbox = screen.getByRole('checkbox')
      expect(checkbox).toHaveAccessibleName()
      
      const slider = screen.getByRole('slider')
      expect(slider).toBeInTheDocument()
    })

    it('should have proper button labels', async () => {
      mockExtractContent.mockResolvedValue({
        success: true,
        markdownBlob: new Blob(['# Test']),
        responseJsonBlob: new Blob([JSON.stringify({})]),
        graphifyResults: {
          summary: [{ imageName: 'fig1.png', isGraph: true }],
          graphifyJsonBlob: new Blob([JSON.stringify([])])
        },
        stats: { imagesFound: 1, graphsDetected: 1, processingTimeMs: 1000 }
      })

      render(<PDFExtraction />)
      
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      await userEvent.upload(fileInput, file)
      
      const extractButton = screen.getByRole('button', { name: /Extract Content/i })
      await userEvent.click(extractButton)
      
      await waitFor(() => {
        const buttons = screen.getAllByRole('button')
        expect(buttons.length).toBeGreaterThan(0)
      })
    })
  })
})

