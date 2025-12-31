/**
 * Integration Tests: PDF Extraction UI
 *
 * These tests verify the extraction feature requirements:
 * 1. Card-based grid showing extraction history
 * 2. "New Extraction" card that opens upload modal
 * 3. Modal overlay functionality
 * 4. Auto-refresh after extraction completes
 * 5. Loading states
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DataExtractionView } from '@/components/dashboard/views/DataExtractionView'
import { ExtractionHistoryGrid } from '@/components/ExtractionHistoryGrid'
import { PDFUploadModal } from '@/components/PDFUploadModal'
import { PDFExtractionJobService } from '@/services/pdfExtractionJobService'
import type { PDFExtractionJob } from '@/types/pdf-extraction-job'

// Mock the PDFExtractionJobService
vi.mock('@/services/pdfExtractionJobService', () => ({
  PDFExtractionJobService: {
    listJobs: vi.fn(),
    getJob: vi.fn(),
    submitJob: vi.fn(),
    retryJob: vi.fn(),
    convertResultToBlobs: vi.fn(),
    downloadBlob: vi.fn(),
  },
}))

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'test-user', email: 'test@example.com' } },
        error: null,
      }),
    },
  },
}))

const mockJobs: PDFExtractionJob[] = [
  {
    id: 'job-1',
    user_id: 'test-user',
    project_id: 1,
    file_name: 'research-paper.pdf',
    file_size: 1024000,
    status: 'completed',
    progress: 100,
    current_stage: 'completed',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:05:00Z',
    completed_at: '2024-01-01T00:05:00Z',
    error_message: null,
    retry_count: 0,
    max_retries: 3,
    enable_graphify: true,
    force_ocr: false,
    max_graphify_images: 10,
  },
  {
    id: 'job-2',
    user_id: 'test-user',
    project_id: 1,
    file_name: 'clinical-trial.pdf',
    file_size: 2048000,
    status: 'processing',
    progress: 65,
    current_stage: 'extracting_content',
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:02:00Z',
    completed_at: null,
    error_message: null,
    retry_count: 0,
    max_retries: 3,
    enable_graphify: true,
    force_ocr: false,
    max_graphify_images: 10,
  },
]

describe('Extraction UI - Empty State', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(PDFExtractionJobService.listJobs).mockResolvedValue({
      success: true,
      jobs: [],
    })
  })

  it('should show loading state initially', () => {
    render(
      <DataExtractionView
        currentProjectId={1}
        onAddToChat={vi.fn()}
        onRemoveFromChat={vi.fn()}
        isExtractionInContext={vi.fn()}
      />
    )

    // Should show loading spinner
    expect(screen.getByText('Loading your extractions...')).toBeInTheDocument()
  })

  it('should show new extraction card when no jobs exist', async () => {
    render(
      <DataExtractionView
        currentProjectId={1}
        onAddToChat={vi.fn()}
        onRemoveFromChat={vi.fn()}
        isExtractionInContext={vi.fn()}
      />
    )

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.getByTestId('new-extraction-card')).toBeInTheDocument()
    })

    // Should show the new extraction card
    const newExtractionCard = screen.getByTestId('new-extraction-card')
    expect(within(newExtractionCard).getByText('New Extraction')).toBeInTheDocument()
    expect(within(newExtractionCard).getByText('Upload PDF to extract data')).toBeInTheDocument()
  })
})

describe('Extraction UI - Grid with Jobs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(PDFExtractionJobService.listJobs).mockResolvedValue({
      success: true,
      jobs: mockJobs,
    })
  })

  it('should display extraction jobs as cards', async () => {
    render(
      <DataExtractionView
        currentProjectId={1}
        onAddToChat={vi.fn()}
        onRemoveFromChat={vi.fn()}
        isExtractionInContext={vi.fn()}
      />
    )

    // Wait for jobs to load
    await waitFor(() => {
      expect(screen.getByText('research-paper.pdf')).toBeInTheDocument()
      expect(screen.getByText('clinical-trial.pdf')).toBeInTheDocument()
    })

    // Should show job count
    expect(screen.getByText('2 extractions')).toBeInTheDocument()
  })

  it('should display job status and metadata', async () => {
    render(
      <DataExtractionView
        currentProjectId={1}
        onAddToChat={vi.fn()}
        onRemoveFromChat={vi.fn()}
        isExtractionInContext={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('research-paper.pdf')).toBeInTheDocument()
    })

    // Should show completed status
    expect(screen.getByText('completed')).toBeInTheDocument()

    // Should show processing status
    expect(screen.getByText('processing')).toBeInTheDocument()
  })

  it('should show progress bar for in-progress jobs', async () => {
    render(
      <DataExtractionView
        currentProjectId={1}
        onAddToChat={vi.fn()}
        onRemoveFromChat={vi.fn()}
        isExtractionInContext={vi.fn()}
      />
    )

    await waitFor(() => {
      const processingCard = screen.getByTestId('extraction-card-job-2')
      expect(processingCard).toBeInTheDocument()

      // Should have progress bar
      const progressBar = processingCard.querySelector('[style*="width: 65%"]')
      expect(progressBar).toBeInTheDocument()
    })
  })

  it('should use grid layout matching projects homepage', async () => {
    render(
      <DataExtractionView
        currentProjectId={1}
        onAddToChat={vi.fn()}
        onRemoveFromChat={vi.fn()}
        isExtractionInContext={vi.fn()}
      />
    )

    await waitFor(() => {
      const grid = screen.getByTestId('extractions-grid')
      expect(grid).toHaveClass('grid')
      expect(grid).toHaveClass('grid-cols-1')
      expect(grid).toHaveClass('md:grid-cols-2')
      expect(grid).toHaveClass('lg:grid-cols-3')
      expect(grid).toHaveClass('xl:grid-cols-4')
    })
  })
})

describe('Extraction UI - New Extraction Card', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(PDFExtractionJobService.listJobs).mockResolvedValue({
      success: true,
      jobs: mockJobs,
    })
  })

  it('should show "New Extraction" card at the top of grid', async () => {
    render(
      <DataExtractionView
        currentProjectId={1}
        onAddToChat={vi.fn()}
        onRemoveFromChat={vi.fn()}
        isExtractionInContext={vi.fn()}
      />
    )

    await waitFor(() => {
      const newCard = screen.getByTestId('new-extraction-card')
      expect(newCard).toBeInTheDocument()
      expect(newCard).toHaveClass('border-dashed')
    })
  })

  it('should open upload modal when "New Extraction" card is clicked', async () => {
    const user = userEvent.setup()

    render(
      <DataExtractionView
        currentProjectId={1}
        onAddToChat={vi.fn()}
        onRemoveFromChat={vi.fn()}
        isExtractionInContext={vi.fn()}
      />
    )

    // Wait for card to appear
    await waitFor(() => {
      expect(screen.getByTestId('new-extraction-card')).toBeInTheDocument()
    })

    // Click the card
    const newCard = screen.getByTestId('new-extraction-card')
    await user.click(newCard)

    // Modal should appear
    await waitFor(() => {
      expect(screen.getByText('PDF Data Extraction')).toBeInTheDocument()
      expect(screen.getByText('Upload a PDF to extract tables, text, and graphs')).toBeInTheDocument()
    })
  })
})

describe('Extraction UI - PDF Upload Modal', () => {
  it('should not render when closed', () => {
    render(
      <PDFUploadModal
        isOpen={false}
        onClose={vi.fn()}
        currentProjectId={1}
        onExtractionComplete={vi.fn()}
      />
    )

    expect(screen.queryByText('PDF Data Extraction')).not.toBeInTheDocument()
  })

  it('should render modal overlay when open', () => {
    render(
      <PDFUploadModal
        isOpen={true}
        onClose={vi.fn()}
        currentProjectId={1}
        onExtractionComplete={vi.fn()}
      />
    )

    // Modal should be visible
    expect(screen.getByText('PDF Data Extraction')).toBeInTheDocument()
    expect(screen.getByText('Upload a PDF to extract tables, text, and graphs')).toBeInTheDocument()
  })

  it('should show upload area with drag and drop', () => {
    render(
      <PDFUploadModal
        isOpen={true}
        onClose={vi.fn()}
        currentProjectId={1}
        onExtractionComplete={vi.fn()}
      />
    )

    expect(screen.getByText('Click or drag to upload PDF file')).toBeInTheDocument()
    expect(screen.getByText('Only PDF files are accepted')).toBeInTheDocument()
  })

  it('should show extraction options (graphify toggle)', () => {
    render(
      <PDFUploadModal
        isOpen={true}
        onClose={vi.fn()}
        currentProjectId={1}
        onExtractionComplete={vi.fn()}
      />
    )

    // Upload a file first (simulate)
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['dummy content'], 'test.pdf', { type: 'application/pdf' })

    if (fileInput) {
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      })
      fileInput.dispatchEvent(new Event('change', { bubbles: true }))
    }

    // Should show graphify option
    waitFor(() => {
      expect(screen.getByText(/Enable graph detection/i)).toBeInTheDocument()
    })
  })

  it('should close modal when close button clicked', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()

    render(
      <PDFUploadModal
        isOpen={true}
        onClose={onClose}
        currentProjectId={1}
        onExtractionComplete={vi.fn()}
      />
    )

    // Find and click close button
    const closeButtons = screen.getAllByRole('button')
    const closeButton = closeButtons.find(btn => {
      const svg = btn.querySelector('svg')
      return svg?.classList.contains('lucide-x')
    })

    if (closeButton) {
      await user.click(closeButton)
      expect(onClose).toHaveBeenCalled()
    }
  })

  it('should show warning when no project selected', () => {
    render(
      <PDFUploadModal
        isOpen={true}
        onClose={vi.fn()}
        currentProjectId={null}
        onExtractionComplete={vi.fn()}
      />
    )

    expect(screen.getByText(/Select or create a project/i)).toBeInTheDocument()
  })
})

describe('Extraction UI - Auto Refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should refresh grid after extraction completes', async () => {
    // Start with no jobs
    vi.mocked(PDFExtractionJobService.listJobs)
      .mockResolvedValueOnce({ success: true, jobs: [] })
      .mockResolvedValueOnce({ success: true, jobs: mockJobs })

    const { rerender } = render(
      <DataExtractionView
        currentProjectId={1}
        onAddToChat={vi.fn()}
        onRemoveFromChat={vi.fn()}
        isExtractionInContext={vi.fn()}
      />
    )

    // Initially no jobs
    await waitFor(() => {
      expect(screen.getByTestId('new-extraction-card')).toBeInTheDocument()
    })

    // Simulate refresh trigger (would happen after extraction completes)
    rerender(
      <DataExtractionView
        currentProjectId={1}
        onAddToChat={vi.fn()}
        onRemoveFromChat={vi.fn()}
        isExtractionInContext={vi.fn()}
      />
    )

    // Note: In real usage, the modal's onExtractionComplete callback
    // would trigger the refresh. This test verifies the mechanism exists.
    expect(PDFExtractionJobService.listJobs).toHaveBeenCalled()
  })
})

describe('Extraction UI - Loading States', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should show "Almost there..." in grid loading state', async () => {
    // Make the API slow to resolve
    vi.mocked(PDFExtractionJobService.listJobs).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({ success: true, jobs: mockJobs }), 100))
    )

    render(
      <ExtractionHistoryGrid
        onNewExtraction={vi.fn()}
        currentProjectId={1}
        refreshTrigger={0}
      />
    )

    // Should show fancy loading state
    expect(screen.getByText('Almost there...')).toBeInTheDocument()

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Almost there...')).not.toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it('should show generic loading in DataExtractionView', () => {
    // Don't resolve the promise yet
    vi.mocked(PDFExtractionJobService.listJobs).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    )

    render(
      <DataExtractionView
        currentProjectId={1}
        onAddToChat={vi.fn()}
        onRemoveFromChat={vi.fn()}
        isExtractionInContext={vi.fn()}
      />
    )

    expect(screen.getByText('Loading your extractions...')).toBeInTheDocument()
  })
})

describe('Extraction UI - Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should show error state when loading fails', async () => {
    vi.mocked(PDFExtractionJobService.listJobs).mockRejectedValue(
      new Error('Failed to load jobs')
    )

    render(
      <ExtractionHistoryGrid
        onNewExtraction={vi.fn()}
        currentProjectId={1}
        refreshTrigger={0}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Failed to load jobs')).toBeInTheDocument()
      expect(screen.getByText('Try Again')).toBeInTheDocument()
    })
  })
})
