/* eslint-disable */
import React, { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Upload, FileText, Download, X, Loader2, CheckCircle2, AlertCircle, Image, RefreshCw } from 'lucide-react'
import { PDFExtractionService, type PDFExtractionResult, type ExtractionOptions } from '@/services/pdfExtractionService'
import { PDFExtractionJobService } from '@/services/pdfExtractionJobService'
import type { PDFExtractionJob, PDFExtractionResultRecord } from '@/types/pdf-extraction-job'
import { NotificationService } from '@/services/notificationService'
import { PaperAnalysisView } from './PaperAnalysisView'
import { ExtractionHistory } from './ExtractionHistory'

interface PDFExtractionProps {
  isVisible?: boolean;
}

export function PDFExtraction({ isVisible = true }: PDFExtractionProps = {}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [extractionResult, setExtractionResult] = useState<PDFExtractionResult | null>(null)
  const [enableGraphify, setEnableGraphify] = useState(true)
  const [maxImages, setMaxImages] = useState(10)
  const [isDragging, setIsDragging] = useState(false)
  const [showAnalysisView, setShowAnalysisView] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // New async job state
  const [currentJob, setCurrentJob] = useState<PDFExtractionJob | null>(null)
  const [jobProgress, setJobProgress] = useState(0)
  const [jobStage, setJobStage] = useState<string>('')
  const pollingIntervalRef = useRef<number | null>(null)

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file)
      setExtractionResult(null) // Clear previous results
    }
  }

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isProcessing) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    if (isProcessing) return

    const file = e.dataTransfer.files?.[0]
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file)
      setExtractionResult(null) // Clear previous results
    } else if (file) {
      alert('Please drop a PDF file')
    }
  }

  // Request notification permission on mount
  useEffect(() => {
    NotificationService.requestPermission()
  }, [])

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, [])

  const handleExtractContent = async () => {
    if (!selectedFile) return

    setIsProcessing(true)
    setExtractionResult(null)
    setJobProgress(0)
    setJobStage('Submitting job...')

    try {
      // Submit job
      const response = await PDFExtractionJobService.submitJob(selectedFile, {
        enableGraphify,
        forceOCR: false,
        maxGraphifyImages: maxImages
      })

      if (!response.success || !response.job) {
        throw new Error(response.error || 'Failed to submit job')
      }

      const job = response.job
      setCurrentJob(job)
      setJobProgress(job.progress)
      setJobStage(job.current_stage || 'Processing...')

      console.log('Job submitted:', job.id)

      // Start polling for updates
      const pollJob = async () => {
        const statusResponse = await PDFExtractionJobService.getJob(job.id)

        if (!statusResponse.success || !statusResponse.job) {
          console.error('Failed to get job status:', statusResponse.error)
          return
        }

        const updatedJob = statusResponse.job
        setCurrentJob(updatedJob)
        setJobProgress(updatedJob.progress)
        setJobStage(updatedJob.current_stage || 'Processing...')

        // Check if completed or failed
        if (updatedJob.status === 'completed' && statusResponse.result) {
          // Convert result to legacy format for compatibility with PaperAnalysisView
          const result = statusResponse.result
          const blobs = PDFExtractionJobService.convertResultToBlobs(result)

          setExtractionResult({
            success: true,
            jobId: updatedJob.id,
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
            },
            message: `Successfully extracted content from PDF${result.graphs_detected > 0 ? ` with ${result.graphs_detected} graph(s) detected` : ''}`
          })

          setIsProcessing(false)
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current)
            pollingIntervalRef.current = null
          }

          // Show notification
          NotificationService.notifyJobComplete(selectedFile?.name || 'PDF', {
            imagesFound: result.images_found,
            graphsDetected: result.graphs_detected
          })
        } else if (updatedJob.status === 'failed') {
          setExtractionResult({
            success: false,
            message: updatedJob.error_message || 'Extraction failed'
          })
          setIsProcessing(false)
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current)
            pollingIntervalRef.current = null
          }

          // Show notification
          NotificationService.notifyJobFailed(
            selectedFile?.name || 'PDF',
            updatedJob.error_message || undefined
          )
        }
      }

      // Poll immediately
      await pollJob()

      // Set up polling interval (2 seconds)
      pollingIntervalRef.current = window.setInterval(pollJob, 2000)

    } catch (error) {
      console.error('Error extracting content:', error)
      setExtractionResult({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to extract PDF content. Please try again.'
      })
      setIsProcessing(false)
    }
  }

  const handleRetryJob = async () => {
    if (!currentJob || currentJob.status !== 'failed') return

    setIsProcessing(true)
    setExtractionResult(null)
    setJobProgress(0)
    setJobStage('Retrying...')

    try {
      const response = await PDFExtractionJobService.retryJob(currentJob.id)

      if (!response.success || !response.job) {
        throw new Error(response.error || 'Failed to retry job')
      }

      const job = response.job
      setCurrentJob(job)

      // Start polling again
      const pollJob = async () => {
        const statusResponse = await PDFExtractionJobService.getJob(job.id)

        if (!statusResponse.success || !statusResponse.job) {
          return
        }

        const updatedJob = statusResponse.job
        setCurrentJob(updatedJob)
        setJobProgress(updatedJob.progress)
        setJobStage(updatedJob.current_stage || 'Processing...')

        if (updatedJob.status === 'completed' && statusResponse.result) {
          const result = statusResponse.result
          const blobs = PDFExtractionJobService.convertResultToBlobs(result)

          setExtractionResult({
            success: true,
            jobId: updatedJob.id,
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
            },
            message: `Successfully extracted content from PDF${result.graphs_detected > 0 ? ` with ${result.graphs_detected} graph(s) detected` : ''}`
          })

          setIsProcessing(false)
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current)
            pollingIntervalRef.current = null
          }

          // Show notification
          NotificationService.notifyJobComplete(selectedFile?.name || 'PDF', {
            imagesFound: result.images_found,
            graphsDetected: result.graphs_detected
          })
        } else if (updatedJob.status === 'failed') {
          setExtractionResult({
            success: false,
            message: updatedJob.error_message || 'Extraction failed'
          })
          setIsProcessing(false)
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current)
            pollingIntervalRef.current = null
          }

          // Show notification
          NotificationService.notifyJobFailed(
            selectedFile?.name || 'PDF',
            updatedJob.error_message || undefined
          )
        }
      }

      await pollJob()
      pollingIntervalRef.current = window.setInterval(pollJob, 2000)

    } catch (error) {
      console.error('Error retrying job:', error)
      setExtractionResult({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to retry job'
      })
      setIsProcessing(false)
    }
  }

  const handleDownload = (blob: Blob, fileName: string) => {
    PDFExtractionService.downloadBlob(blob, fileName)
  }

  const handleReset = () => {
    setSelectedFile(null)
    setExtractionResult(null)
    setIsProcessing(false)
    setShowAnalysisView(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleViewAnalysis = () => {
    setShowAnalysisView(true)
  }

  const handleBackToUpload = () => {
    setShowAnalysisView(false)
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  // Show analysis view if extraction was successful and user wants to view it
  if (showAnalysisView && extractionResult?.success && selectedFile) {
    return (
      <PaperAnalysisView
        result={extractionResult}
        fileName={selectedFile.name}
        onBack={handleBackToUpload}
      />
    )
  }

  return (
    <div className="min-h-screen w-full overflow-y-auto bg-gray-50">
      <div className="mx-auto flex w-full flex-col gap-6 px-6 py-10">
        <div className="max-w-3xl w-full mx-auto">
          <Card className="w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-6 w-6" />
              PDF Table Extraction
            </CardTitle>
            <CardDescription>
              Upload a PDF document to extract tabular data into markdown format. Download original images and GPT-reconstructed graphs.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
          {/* File Input Section */}
          <div
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleFileSelect}
              className="hidden"
              id="pdf-upload"
              disabled={isProcessing}
            />
            <label htmlFor="pdf-upload">
              <Button
                variant="outline"
                className={`w-full h-32 border-2 border-dashed cursor-pointer transition-colors ${
                  isDragging 
                    ? 'border-primary bg-primary/10 border-solid' 
                    : 'hover:border-primary hover:bg-accent'
                }`}
                asChild
                disabled={isProcessing}
              >
                <div className="flex flex-col items-center gap-2">
                  <Upload className={`h-8 w-8 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className="text-sm font-medium">
                    {isDragging 
                      ? 'Drop PDF file here' 
                      : selectedFile 
                        ? 'Change PDF file' 
                        : 'Click or drag to upload PDF file'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Only PDF files are accepted
                  </span>
                </div>
              </Button>
            </label>
          </div>

          {/* Selected File Display */}
          {selectedFile && (
            <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded">
                  <FileText className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                  <p className="text-xs text-gray-500">{formatFileSize(selectedFile.size)}</p>
                </div>
              </div>
              {!isProcessing && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleReset}
                  className="text-gray-500 hover:text-red-600"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}

          {/* Processing Options */}
          {selectedFile && !extractionResult && !isProcessing && (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
              <p className="text-sm font-medium text-gray-700">Extraction Options:</p>
              
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableGraphify}
                  onChange={(e) => setEnableGraphify(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="flex items-center gap-2">
                  <Image className="h-4 w-4 text-gray-500" />
                  Enable graph detection with GPT Vision
                </span>
              </label>
              
              {enableGraphify && (
                <div className="ml-6 space-y-2 p-3 bg-white rounded border border-gray-200">
                  <label className="text-xs text-gray-600 block">
                    Max images to analyze: <span className="font-medium text-gray-900">{maxImages}</span>
                    <input
                      type="range"
                      min="1"
                      max="20"
                      value={maxImages}
                      onChange={(e) => setMaxImages(parseInt(e.target.value))}
                      className="w-full mt-1"
                    />
                  </label>
                  <p className="text-xs text-gray-500">
                    Higher values increase processing time and cost
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Action Button */}
          <Button
            onClick={handleExtractContent}
            disabled={!selectedFile || isProcessing}
            className="w-full"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Extracting Content...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Extract Content
              </>
            )}
          </Button>

          {/* Loading State with Progress */}
          {isProcessing && (
            <div className="p-6 bg-blue-50 border border-blue-200 rounded-lg space-y-4">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-900">Processing PDF...</p>
                <p className="text-xs text-gray-600 mt-1">{jobStage || 'Initializing...'}</p>
              </div>
              
              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-gray-600">
                  <span>Progress</span>
                  <span>{jobProgress}%</span>
                </div>
                <div className="w-full bg-blue-100 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-blue-600 h-full transition-all duration-300 ease-out"
                    style={{ width: `${jobProgress}%` }}
                  />
                </div>
              </div>

              {/* Stage Info */}
              <div className="text-xs text-gray-500 text-center">
                {jobProgress < 20 && '⏳ Uploading to processing server...'}
                {jobProgress >= 20 && jobProgress < 80 && '📄 Extracting content from PDF...'}
                {jobProgress >= 80 && jobProgress < 95 && '🔍 Analyzing images and graphs...'}
                {jobProgress >= 95 && '✨ Finalizing results...'}
              </div>
            </div>
          )}

          {/* Success Result */}
          {extractionResult?.success && !isProcessing && (
            <div className="space-y-4">
              {/* Success Banner */}
              <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-900">Extraction Successful!</p>
                  <p className="text-sm text-green-700 mt-1">
                    {extractionResult.message || 'PDF content extracted successfully'}
                  </p>
                  {extractionResult.stats && (
                    <div className="mt-2 flex items-center gap-3 text-xs text-green-600">
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {extractionResult.stats.imagesFound} image{extractionResult.stats.imagesFound !== 1 ? 's' : ''} found
                      </span>
                      {extractionResult.stats.graphsDetected > 0 && (
                        <span className="flex items-center gap-1">
                          <Image className="h-3 w-3" />
                          {extractionResult.stats.graphsDetected} graph{extractionResult.stats.graphsDetected !== 1 ? 's' : ''} detected
                        </span>
                      )}
                      <span>
                        · Processed in {(extractionResult.stats.processingTimeMs / 1000).toFixed(1)}s
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* View Analysis Button */}
              <Button
                onClick={handleViewAnalysis}
                className="w-full"
              >
                <FileText className="h-4 w-4" />
                View Comprehensive Analysis
              </Button>

              {/* Download Buttons */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Download Results:</p>
                
                {/* Markdown Download */}
                {extractionResult.markdownBlob && (
                  <Button
                    onClick={() => handleDownload(
                      extractionResult.markdownBlob!, 
                      `${selectedFile?.name.replace('.pdf', '') || 'document'}.md`
                    )}
                    variant="outline"
                    className="w-full justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      <span>Markdown Content</span>
                    </div>
                    <Download className="h-4 w-4 text-gray-400" />
                  </Button>
                )}

                {/* Original Images Download */}
                {extractionResult.originalImagesBlob && (
                  <Button
                    onClick={() => handleDownload(
                      extractionResult.originalImagesBlob!, 
                      `${selectedFile?.name.replace('.pdf', '') || 'document'}-original-images.json`
                    )}
                    variant="outline"
                    className="w-full justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <Image className="h-4 w-4" />
                      <span>Original Extracted Images (JSON)</span>
                    </div>
                    <Download className="h-4 w-4 text-gray-400" />
                  </Button>
                )}

                {/* JSON Response Download */}
                {extractionResult.responseJsonBlob && (
                  <Button
                    onClick={() => handleDownload(
                      extractionResult.responseJsonBlob!, 
                      `${selectedFile?.name.replace('.pdf', '') || 'document'}-response.json`
                    )}
                    variant="outline"
                    className="w-full justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      <span>Full API Response (JSON)</span>
                    </div>
                    <Download className="h-4 w-4 text-gray-400" />
                  </Button>
                )}

                {/* GPT Analysis Download */}
                {extractionResult.graphifyResults?.graphifyJsonBlob && (
                  <Button
                    onClick={() => handleDownload(
                      extractionResult.graphifyResults!.graphifyJsonBlob!, 
                      `${selectedFile?.name.replace('.pdf', '') || 'document'}-gpt-analysis.json`
                    )}
                    variant="outline"
                    className="w-full justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <Image className="h-4 w-4" />
                      <span>GPT Graph Analysis (JSON)</span>
                    </div>
                    <Download className="h-4 w-4 text-gray-400" />
                  </Button>
                )}

                {/* Summary of Graphs Detected */}
                {extractionResult.graphifyResults && extractionResult.graphifyResults.summary.filter(r => r.isGraph).length > 0 && (
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs font-medium text-blue-900 mb-2">
                      Graph Detection Summary:
                    </p>
                    <div className="space-y-1">
                      {extractionResult.graphifyResults.summary
                        .filter(r => r.isGraph)
                        .slice(0, 5)
                        .map((result, idx) => (
                          <div key={idx} className="text-xs text-blue-700">
                            <span className="font-medium">{result.imageName}</span>: {result.graphType || 'graph'}
                          </div>
                        ))}
                      {extractionResult.graphifyResults.summary.filter(r => r.isGraph).length > 5 && (
                        <p className="text-xs text-blue-600 italic">
                          +{extractionResult.graphifyResults.summary.filter(r => r.isGraph).length - 5} more graphs
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error Result */}
          {extractionResult && !extractionResult.success && !isProcessing && (
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-900">Extraction Failed</p>
                  <p className="text-sm text-red-700 mt-1">
                    {extractionResult.message || 'An error occurred while processing the PDF'}
                  </p>
                  {currentJob && currentJob.retry_count < currentJob.max_retries && (
                    <p className="text-xs text-red-600 mt-2">
                      Retry attempt {currentJob.retry_count} of {currentJob.max_retries}
                    </p>
                  )}
                </div>
              </div>

              {/* Retry Button */}
              {currentJob && currentJob.status === 'failed' && currentJob.retry_count < currentJob.max_retries && (
                <Button
                  onClick={handleRetryJob}
                  variant="outline"
                  className="w-full border-orange-300 text-orange-700 hover:bg-orange-50"
                >
                  <RefreshCw className="h-4 w-4" />
                  Retry Extraction
                </Button>
              )}
            </div>
          )}

          {/* Reset Button (when results are shown) */}
          {extractionResult && !isProcessing && (
            <Button
              onClick={handleReset}
              variant="ghost"
              className="w-full"
            >
              <X className="h-4 w-4" />
              Clear and Start Over
            </Button>
          )}
          </CardContent>
        </Card>
        </div>

        {/* Extraction History - Full width */}
        <div className="w-full">
          <ExtractionHistory isVisible={isVisible} />
        </div>
      </div>
    </div>
  )
}

