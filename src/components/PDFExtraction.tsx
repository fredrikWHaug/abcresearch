import React, { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Upload, FileText, Download, X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { PDFExtractionService, type PDFExtractionResult } from '@/services/pdfExtractionService'

type ExtractionResult = PDFExtractionResult

export function PDFExtraction() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file)
      setExtractionResult(null) // Clear previous results
    }
  }

  const handleExtractTables = async () => {
    if (!selectedFile) return

    setIsProcessing(true)
    setExtractionResult(null)

    try {
      // Call PDFExtractionService
      // Note: Currently using mock implementation until backend is ready
      const result = await PDFExtractionService.extractTables(selectedFile)
      
      // For development: simulate success when service is not implemented
      if (!result.success && result.message?.includes('not implemented')) {
        // Simulated response structure (remove when implementing actual service)
        await new Promise(resolve => setTimeout(resolve, 2000)) // Simulate processing time
        
        // Mock success result for UI testing
        const mockResult: ExtractionResult = {
          success: true,
          tablesCount: 3,
          message: 'Successfully extracted tables from PDF (mock data)',
          blob: new Blob(['mock excel data'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
          fileName: `${selectedFile.name.replace('.pdf', '')}_tables.xlsx`
        }
        setExtractionResult(mockResult)
      } else {
        setExtractionResult(result)
      }
    } catch (error) {
      console.error('Error extracting tables:', error)
      setExtractionResult({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to extract tables from PDF. Please try again.'
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDownload = () => {
    if (!extractionResult?.blob || !extractionResult.fileName) return

    const url = window.URL.createObjectURL(extractionResult.blob)
    const link = document.createElement('a')
    link.href = url
    link.download = extractionResult.fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }

  const handleReset = () => {
    setSelectedFile(null)
    setExtractionResult(null)
    setIsProcessing(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  return (
    <div className="h-full flex items-center justify-center bg-gray-50 p-6">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-6 w-6" />
            PDF Table Extraction
          </CardTitle>
          <CardDescription>
            Upload a PDF document to extract tabular data into a structured Excel format
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* File Input Section */}
          <div>
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
                className="w-full h-32 border-2 border-dashed cursor-pointer hover:border-primary hover:bg-accent"
                asChild
                disabled={isProcessing}
              >
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {selectedFile ? 'Change PDF file' : 'Click to upload PDF file'}
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

          {/* Action Buttons */}
          <div className="flex gap-3">
          <Button
            onClick={handleExtractTables}
            disabled={!selectedFile || isProcessing}
            className="flex-1"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Extracting...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Extract Tables
              </>
            )}
          </Button>
            {extractionResult?.success && (
              <Button
                onClick={handleDownload}
                variant="outline"
                className="flex-1"
              >
                <Download className="h-4 w-4" />
                Download Excel
              </Button>
            )}
          </div>

          {/* Loading State */}
          {isProcessing && (
            <div className="flex items-center justify-center p-6 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-900">Processing PDF...</p>
                <p className="text-xs text-gray-600 mt-1">Extracting tables from your document</p>
              </div>
            </div>
          )}

          {/* Success Result */}
          {extractionResult?.success && !isProcessing && (
            <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-green-900">Extraction Successful!</p>
                <p className="text-sm text-green-700 mt-1">
                  {(() => {
                    // If there's a message but it's the generic one and we have table count, show table count
                    if (extractionResult.message === 'Successfully extracted tables from PDF' && extractionResult.tablesCount !== undefined) {
                      return `Found ${extractionResult.tablesCount} table${extractionResult.tablesCount !== 1 ? 's' : ''} in the document`;
                    }
                    // If there's any other message, show it (custom messages take priority)
                    if (extractionResult.message) {
                      return extractionResult.message;
                    }
                    // If no message but we have table count, show table count
                    if (extractionResult.tablesCount !== undefined) {
                      return `Found ${extractionResult.tablesCount} table${extractionResult.tablesCount !== 1 ? 's' : ''} in the document`;
                    }
                    // Fallback
                    return 'Successfully extracted tables from PDF';
                  })()}
                </p>
                <p className="text-xs text-green-600 mt-2">
                  Click "Download Excel" to save the extracted data
                </p>
              </div>
            </div>
          )}

          {/* Error Result */}
          {extractionResult && !extractionResult.success && !isProcessing && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-900">Extraction Failed</p>
                <p className="text-sm text-red-700 mt-1">
                  {extractionResult.message || 'An error occurred while processing the PDF'}
                </p>
              </div>
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
  )
}

