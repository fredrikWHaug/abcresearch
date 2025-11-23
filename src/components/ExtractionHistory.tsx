/* eslint-disable */
/**
 * Extraction History Component
 * 
 * Displays user's PDF extraction job history with status, progress, and actions
 * 
 * Performance optimizations:
 * - Caches jobs in sessionStorage for instant display on navigation/refresh
 * - Shows cached data immediately while refreshing in background
 * - Skeleton loading UI for better perceived performance
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
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
  Trash2,
  Plus
} from 'lucide-react'
import { PDFExtractionJobService } from '@/services/pdfExtractionJobService'
import type { PDFExtractionJob } from '@/types/pdf-extraction-job'
import type { PDFExtractionResult } from '@/types/extraction'
import { PaperAnalysisView } from './PaperAnalysisView'

const CACHE_KEY_BASE = 'extraction_history_cache'
const CACHE_TIMESTAMP_KEY_BASE = 'extraction_history_cache_ts'
const CACHE_MAX_AGE_MS = 5 * 60 * 1000 // 5 minutes

interface ExtractionHistoryProps {
  currentProjectId?: number | null;
  isVisible?: boolean;
  refreshTrigger?: number; // Increment this to trigger a refresh (e.g., when a new job completes)
  onAddToChat?: (extraction: {
    jobId: string
    fileName: string
    markdownContent: string
    hasTables: boolean
    tablesData?: Array<{
      index: number;
      headers: string[];
      rows: string[][];
      rawMarkdown: string;
    }>;
    graphifyResults?: Array<{
      imageName: string;
      isGraph: boolean;
      graphType?: string;
      reason?: string;
      pythonCode?: string;
      data?: Record<string, unknown>;
      assumptions?: string;
      error?: string;
      renderedImage?: string;
      renderError?: string;
      renderTimeMs?: number;
    }>;
  }) => void
  onRemoveFromChat?: (jobId: string) => void
  isInContext?: (jobId: string) => boolean
}

// Skeleton loading component for better perceived performance
function JobSkeleton() {
  return (
    <div className="p-4 border rounded-lg bg-gray-50 border-gray-200 animate-pulse">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1">
          <div className="h-5 w-5 bg-gray-200 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-4 w-48 bg-gray-200 rounded" />
              <div className="h-4 w-16 bg-gray-200 rounded" />
            </div>
            <div className="flex items-center gap-4">
              <div className="h-3 w-20 bg-gray-200 rounded" />
              <div className="h-3 w-16 bg-gray-200 rounded" />
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="h-8 w-24 bg-gray-200 rounded" />
          <div className="h-8 w-8 bg-gray-200 rounded" />
        </div>
      </div>
    </div>
  )
}

export function ExtractionHistory({ currentProjectId = null, isVisible = true, refreshTrigger = 0, onAddToChat, onRemoveFromChat, isInContext }: ExtractionHistoryProps = {}) {
  const [jobs, setJobs] = useState<PDFExtractionJob[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false) // For background refresh indicator
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [selectedResult, setSelectedResult] = useState<PDFExtractionResult | null>(null)
  const [selectedFileName, setSelectedFileName] = useState<string>('')
  const [selectedJobIsPartial, setSelectedJobIsPartial] = useState(false)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)
  const loadingRef = useRef(false) // Prevent duplicate loads
  const hasCacheRef = useRef(false) // Track if we loaded from cache (survives re-renders)

  const cacheSuffix = useMemo(
    () => (currentProjectId !== null ? `project_${currentProjectId}` : 'all'),
    [currentProjectId]
  )
  const cacheKey = useMemo(() => `${CACHE_KEY_BASE}:${cacheSuffix}`, [cacheSuffix])
  const cacheTimestampKey = useMemo(() => `${CACHE_TIMESTAMP_KEY_BASE}:${cacheSuffix}`, [cacheSuffix])

  const loadCachedJobs = useCallback(() => {
    try {
      const cached = sessionStorage.getItem(cacheKey)
      const cachedTs = sessionStorage.getItem(cacheTimestampKey)
      
      if (cached && cachedTs) {
        const cacheAge = Date.now() - parseInt(cachedTs, 10)
        if (cacheAge < CACHE_MAX_AGE_MS) {
          const cachedJobs = JSON.parse(cached)
          if (Array.isArray(cachedJobs)) {
            hasCacheRef.current = true
            setJobs(cachedJobs)
            setIsLoading(false)
            console.log('[ExtractionHistory] Loaded', cachedJobs.length, 'jobs from cache for', cacheSuffix)
            return true
          }
        }
      }
    } catch (error) {
      console.warn('[ExtractionHistory] Failed to load cache:', error)
    }
    hasCacheRef.current = false
    return false
  }, [cacheKey, cacheTimestampKey, cacheSuffix])

  // Reload cache whenever project changes
  useEffect(() => {
    setJobs([])
    setIsLoading(true)
    loadCachedJobs()
    setHasLoadedOnce(false)
  }, [loadCachedJobs])

  const loadJobs = useCallback(async (hasExistingData = false) => {
    if (loadingRef.current) return
    loadingRef.current = true

    if (hasExistingData) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }

    try {
      const response = await PDFExtractionJobService.listJobs({
        limit: 50,
        projectId: typeof currentProjectId === 'number' ? currentProjectId : undefined
      })

      if (response.success) {
        setJobs(response.jobs)
        hasCacheRef.current = true

        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(response.jobs))
          sessionStorage.setItem(cacheTimestampKey, String(Date.now()))
        } catch (error) {
          console.warn('[ExtractionHistory] Failed to cache jobs:', error)
        }
      }
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
      loadingRef.current = false
    }
  }, [cacheKey, cacheTimestampKey, currentProjectId])

  // Lazy load: only load jobs when view becomes visible for the first time
  useEffect(() => {
    if (isVisible && !hasLoadedOnce && !loadingRef.current) {
      setHasLoadedOnce(true)
      loadJobs(hasCacheRef.current)
    }
  }, [isVisible, hasLoadedOnce, loadJobs])

  // Set up polling for in-progress jobs (including 'partial' which is still analyzing graphs)
  useEffect(() => {
    const interval = setInterval(() => {
      const inProgressJobs = jobs.filter(j => 
        j.status === 'processing' || j.status === 'pending' || j.status === 'partial'
      )
      if (inProgressJobs.length > 0 && !loadingRef.current) {
        loadJobs(true)
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [jobs, loadJobs])

  // Refresh when triggered externally (e.g., new job submitted/completed)
  useEffect(() => {
    if (refreshTrigger > 0 && hasLoadedOnce) {
      console.log('[ExtractionHistory] Refresh triggered by parent, refreshTrigger:', refreshTrigger)
      loadJobs(true)
    }
  }, [refreshTrigger, hasLoadedOnce, loadJobs])


  const handleViewResult = async (job: PDFExtractionJob) => {
    // Allow viewing for both 'completed' and 'partial' (markdown is available)
    if (job.status !== 'completed' && job.status !== 'partial') return

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
      setSelectedJobIsPartial(job.status === 'partial')
    }
  }

  const handleRetry = async (jobId: string) => {
    const response = await PDFExtractionJobService.retryJob(jobId)
    
    if (response.success) {
      await loadJobs(true) // We have existing data showing
    }
  }

  const handleDownloadResult = async (job: PDFExtractionJob) => {
    // Allow downloading for both 'completed' and 'partial' (markdown is available)
    if (job.status !== 'completed' && job.status !== 'partial') return

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
      case 'partial':
        // Partial: markdown ready, graphs analyzing - show half-filled indicator
        return <Loader2 className="h-5 w-5 text-amber-600 animate-spin" />
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
      case 'partial':
        // Partial: markdown ready, graphs analyzing - amber/yellow theme
        return 'bg-amber-50 border-amber-200 text-amber-700'
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
          setSelectedJobIsPartial(false)
        }}
        isPartialResult={selectedJobIsPartial}
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
                  {isRefreshing && (
                    <Loader2 className="h-4 w-4 animate-spin text-gray-400 ml-2" />
                  )}
                </CardTitle>
                <CardDescription>
                  View and manage your PDF extraction jobs
                </CardDescription>
              </div>
              <Button 
                onClick={() => loadJobs(hasCacheRef.current || jobs.length > 0)} 
                variant="outline" 
                size="sm" 
                className="cursor-pointer"
                disabled={isLoading || isRefreshing}
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading && jobs.length === 0 ? (
              // Show skeleton loading instead of spinner for better perceived performance
              <div className="space-y-3">
                <JobSkeleton />
                <JobSkeleton />
                <JobSkeleton />
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

                          {/* Progress bar for in-progress and partial jobs */}
                          {(job.status === 'processing' || job.status === 'pending' || job.status === 'partial') && (
                            <div className="mt-3 space-y-1">
                              <div className="flex justify-between text-xs">
                                <span>
                                  {job.status === 'partial' 
                                    ? '📄 Markdown ready • 🔍 Analyzing graphs...'
                                    : job.current_stage || 'Processing...'}
                                </span>
                                <span>{job.progress}%</span>
                              </div>
                              <div className={`w-full rounded-full h-1.5 overflow-hidden ${
                                job.status === 'partial' ? 'bg-amber-100' : 'bg-white/50'
                              }`}>
                                <div 
                                  className={`h-full transition-all duration-300 ${
                                    job.status === 'partial' ? 'bg-amber-600' : 'bg-blue-600'
                                  }`}
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
                        {/* Completed jobs - full access */}
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
                            {onAddToChat && onRemoveFromChat && isInContext && (
                              <Button
                                onClick={async () => {
                                  const inContext = isInContext(job.id)
                                  if (inContext && onRemoveFromChat) {
                                    onRemoveFromChat(job.id)
                                  } else {
                                    const response = await PDFExtractionJobService.getJob(job.id)
                                    if (response.success && response.result?.markdown_content) {
                                      // Check if markdown contains tables
                                      const hasTables = response.result.markdown_content.includes('|') && 
                                                      response.result.markdown_content.split('\n').some(line => line.trim().startsWith('|'))
                                      
                                      // Extract structured tables data from database
                                      const tablesData = Array.isArray(response.result.tables_data) 
                                        ? response.result.tables_data as Array<{
                                            index: number;
                                            headers: string[];
                                            rows: string[][];
                                            rawMarkdown: string;
                                          }>
                                        : undefined
                                      
                                      // Extract graphify results from database
                                      const graphifyResults = Array.isArray(response.result.graphify_results)
                                        ? response.result.graphify_results as Array<{
                                            imageName: string;
                                            isGraph: boolean;
                                            graphType?: string;
                                            reason?: string;
                                            pythonCode?: string;
                                            data?: Record<string, unknown>;
                                            assumptions?: string;
                                            error?: string;
                                            renderedImage?: string;
                                            renderError?: string;
                                            renderTimeMs?: number;
                                          }>
                                        : undefined
                                      
                                      onAddToChat({
                                        jobId: job.id,
                                        fileName: job.file_name,
                                        markdownContent: response.result.markdown_content,
                                        hasTables,
                                        tablesData,
                                        graphifyResults
                                      })
                                    }
                                  }
                                }}
                                size="sm"
                                variant={isInContext(job.id) ? "default" : "outline"}
                                className={`h-8 cursor-pointer text-xs ${isInContext(job.id) ? 'bg-green-600 hover:bg-green-700 text-white' : ''}`}
                                title={isInContext(job.id) ? "Remove from Chat" : "Add to Chat for Analysis"}
                              >
                                {isInContext(job.id) ? (
                                  <>
                                    <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    In Chat
                                  </>
                                ) : (
                                  <>
                                    <Plus className="h-4 w-4 mr-1" />
                                    Add to Chat
                                  </>
                                )}
                              </Button>
                            )}
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

                        {/* Partial jobs - can view/download markdown while graphs are analyzing */}
                        {job.status === 'partial' && (
                          <>
                            <Button
                              onClick={() => handleViewResult(job)}
                              size="sm"
                              variant="outline"
                              className="h-8 cursor-pointer text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
                            >
                              View Markdown
                            </Button>
                            <Button
                              onClick={() => handleDownloadResult(job)}
                              size="sm"
                              variant="ghost"
                              className="h-8 cursor-pointer text-amber-600 hover:text-amber-700"
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

