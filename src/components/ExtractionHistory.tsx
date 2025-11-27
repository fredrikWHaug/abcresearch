/* eslint-disable */
/**
 * Extraction History Component
 * 
 * Displays user's PDF extraction job history with status, progress, and actions
 */

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  FileText, 
  RefreshCw, 
  Download, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  Trash2
} from 'lucide-react'
import { PDFExtractionJobService } from '@/services/pdfExtractionJobService'
import type { PDFExtractionJob } from '@/types/pdf-extraction-job'
import type { PDFExtractionResult } from '@/types/extraction'
import { PaperAnalysisView } from './PaperAnalysisView'

interface ExtractionHistoryProps {
  isVisible?: boolean;
}

export function ExtractionHistory({ isVisible = true }: ExtractionHistoryProps = {}) {
  const [jobs, setJobs] = useState<PDFExtractionJob[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [selectedResult, setSelectedResult] = useState<PDFExtractionResult | null>(null)
  const [selectedFileName, setSelectedFileName] = useState<string>('')
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)

  // Lazy load: only load jobs when view becomes visible for the first time
  useEffect(() => {
    if (isVisible && !hasLoadedOnce) {
      setHasLoadedOnce(true);
      loadJobs()
    }
  }, [isVisible, hasLoadedOnce])

  // Set up polling for in-progress jobs
  useEffect(() => {
    const interval = setInterval(() => {
      // Check if there are any in-progress jobs
      const inProgressJobs = jobs.filter(j => j.status === 'processing' || j.status === 'pending')
      if (inProgressJobs.length > 0) {
        loadJobs()
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [jobs]) // This only sets up polling, doesn't load on every jobs change

  const loadJobs = async () => {
    setIsLoading(true)
    const response = await PDFExtractionJobService.listJobs({ limit: 50 })
    
    if (response.success) {
      setJobs(response.jobs)
    }
    
    setIsLoading(false)
  }

  const handleViewResult = async (job: PDFExtractionJob) => {
    if (job.status !== 'completed') return

    const response = await PDFExtractionJobService.getJob(job.id)
    
    if (response.success && response.result) {
      const result = response.result
      const blobs = PDFExtractionJobService.convertResultToBlobs(result)

      const extractionResult: PDFExtractionResult = {
        success: true,
        jobId: job.id,
        markdownContent: result.markdown_content || undefined,
        markdownBlob: blobs.markdownBlob,
        responseJson: result.response_json || undefined,
        responseJsonBlob: blobs.responseJsonBlob,
        originalImagesBlob: blobs.originalImagesBlob,
        graphifyResults: result.graphify_results ? {
          summary: result.graphify_results as any[],
          graphifyJsonBlob: blobs.graphifyJsonBlob
        } : undefined,
        stats: {
          imagesFound: result.images_found,
          graphsDetected: result.graphs_detected,
          processingTimeMs: result.processing_time_ms || 0,
          tablesFound: result.tables_found
        }
      }

      setSelectedResult(extractionResult)
      setSelectedFileName(job.file_name)
      setSelectedJobId(job.id)
    }
  }

  const handleRetry = async (jobId: string) => {
    const response = await PDFExtractionJobService.retryJob(jobId)
    
    if (response.success) {
      await loadJobs()
    }
  }

  const handleDownloadResult = async (job: PDFExtractionJob) => {
    if (job.status !== 'completed') return

    const response = await PDFExtractionJobService.getJob(job.id)
    
    if (response.success && response.result) {
      const blobs = PDFExtractionJobService.convertResultToBlobs(response.result)
      
      if (blobs.markdownBlob) {
        PDFExtractionJobService.downloadBlob(
          blobs.markdownBlob,
          `${job.file_name.replace('.pdf', '')}.md`
        )
      }
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-600" />
      case 'processing':
      case 'pending':
        return <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
      default:
        return <Clock className="h-5 w-5 text-gray-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-50 border-green-200 text-green-700'
      case 'failed':
        return 'bg-red-50 border-red-200 text-red-700'
      case 'processing':
      case 'pending':
        return 'bg-blue-50 border-blue-200 text-blue-700'
      default:
        return 'bg-gray-50 border-gray-200 text-gray-700'
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(hours / 24)

    if (days > 7) {
      return date.toLocaleDateString()
    } else if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} ago`
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} ago`
    } else {
      return 'Just now'
    }
  }

  // Show analysis view if a job result is selected
  if (selectedResult && selectedFileName) {
    return (
      <PaperAnalysisView
        result={selectedResult}
        fileName={selectedFileName}
        onBack={() => {
          setSelectedResult(null)
          setSelectedJobId(null)
          setSelectedFileName('')
        }}
      />
    )
  }

  return (
    <div className="min-h-screen w-full overflow-y-auto bg-gray-50">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-6 w-6" />
                  Extraction History
                </CardTitle>
                <CardDescription>
                  View and manage your PDF extraction jobs
                </CardDescription>
              </div>
              <Button onClick={loadJobs} variant="outline" size="sm" className="cursor-pointer">
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading && jobs.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : jobs.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No extraction jobs yet</p>
                <p className="text-sm text-gray-500 mt-2">
                  Upload a PDF in the Data Extraction tab to get started
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {jobs.map((job) => (
                  <div
                    key={job.id}
                    className={`p-4 border rounded-lg ${getStatusColor(job.status)}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        {getStatusIcon(job.status)}
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-medium truncate max-w-md" title={job.file_name}>
                              {job.file_name}
                            </h3>
                            <span className="text-xs px-2 py-0.5 rounded capitalize border flex-shrink-0">
                              {job.status}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-4 mt-1 text-xs opacity-75">
                            <span>{formatDate(job.created_at)}</span>
                            <span>{(job.file_size / 1024 / 1024).toFixed(2)} MB</span>
                          </div>

                          {/* Progress bar for in-progress jobs */}
                          {(job.status === 'processing' || job.status === 'pending') && (
                            <div className="mt-3 space-y-1">
                              <div className="flex justify-between text-xs">
                                <span>{job.current_stage || 'Processing...'}</span>
                                <span>{job.progress}%</span>
                              </div>
                              <div className="w-full bg-white/50 rounded-full h-1.5 overflow-hidden">
                                <div 
                                  className="h-full bg-blue-600 transition-all duration-300"
                                  style={{ width: `${job.progress}%` }}
                                />
                              </div>
                            </div>
                          )}

                          {/* Error message */}
                          {job.status === 'failed' && job.error_message && (
                            <p className="text-xs mt-2 opacity-75">
                              Error: {job.error_message}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        {job.status === 'completed' && (
                          <>
                            <Button
                              onClick={() => handleViewResult(job)}
                              size="sm"
                              variant="outline"
                              className="h-8 cursor-pointer text-xs"
                            >
                              View Analysis
                            </Button>
                            <Button
                              onClick={() => handleDownloadResult(job)}
                              size="sm"
                              variant="ghost"
                              className="h-8 cursor-pointer"
                              title="Download Markdown"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        
                        {job.status === 'failed' && job.retry_count < job.max_retries && (
                          <Button
                            onClick={() => handleRetry(job.id)}
                            size="sm"
                            variant="ghost"
                            className="h-8 cursor-pointer"
                            title="Retry extraction"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

