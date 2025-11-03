import React, { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import rehypeHighlight from 'rehype-highlight'
import rehypeRaw from 'rehype-raw'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'
import { toString } from 'mdast-util-to-string'
import type { Table as MdastTable, TableRow as MdastTableRow, TableCell as MdastTableCell } from 'mdast'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  FileText, 
  Code, 
  Eye, 
  Image as ImageIcon, 
  Download,
  ChevronLeft,
  Database,
  BarChart3,
  ZoomIn,
  ZoomOut,
  Undo2
} from 'lucide-react'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import type { PDFExtractionResult } from '@/services/pdfExtractionService'
import type { TableData } from '@/types/extraction'

interface PaperAnalysisViewProps {
  result: PDFExtractionResult
  fileName: string
  onBack: () => void
}

type ViewTab = 'markdown' | 'tables' | 'graphs' | 'data'
type MarkdownView = 'rendered' | 'source'

export function PaperAnalysisView({ result, fileName, onBack }: PaperAnalysisViewProps) {
  const [activeTab, setActiveTab] = useState<ViewTab>('markdown')
  const [markdownView, setMarkdownView] = useState<MarkdownView>('rendered')
  const [selectedDataView, setSelectedDataView] = useState<'original' | 'response' | 'gpt'>('original')
  const [tables, setTables] = React.useState<TableData[] | null>(null)

  const documentName = fileName.replace('.pdf', '')

  // Helper function to convert Blob to text
  const blobToText = async (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsText(blob)
    })
  }

  // Parse JSON data for viewing (handle both Blob and base64 string)
  const [originalImages, setOriginalImages] = React.useState<Record<string, string> | null>(null)
  const [responseJson, setResponseJson] = React.useState<Record<string, unknown> | null>(null)
  const [graphifyData, setGraphifyData] = React.useState<unknown[] | null>(null)

  React.useEffect(() => {
    const loadData = async () => {
      // Load original images
      if (result.originalImagesBlob) {
        try {
          if (result.originalImagesBlob instanceof Blob) {
            const text = await blobToText(result.originalImagesBlob)
            setOriginalImages(JSON.parse(text))
          } else {
            setOriginalImages(JSON.parse(atob(result.originalImagesBlob)))
          }
        } catch (error) {
          console.error('Error parsing original images:', error)
        }
      }

      // Load response JSON
      if (result.responseJsonBlob) {
        try {
          if (result.responseJsonBlob instanceof Blob) {
            const text = await blobToText(result.responseJsonBlob)
            setResponseJson(JSON.parse(text))
          } else {
            setResponseJson(JSON.parse(atob(result.responseJsonBlob)))
          }
        } catch (error) {
          console.error('Error parsing response JSON:', error)
        }
      }

      // Load graphify data
      if (result.graphifyResults?.graphifyJsonBlob) {
        try {
          if (result.graphifyResults.graphifyJsonBlob instanceof Blob) {
            const text = await blobToText(result.graphifyResults.graphifyJsonBlob)
            setGraphifyData(JSON.parse(text))
          } else {
            setGraphifyData(JSON.parse(atob(result.graphifyResults.graphifyJsonBlob)))
          }
        } catch (error) {
          console.error('Error parsing graphify data:', error)
        }
      }
    }

    loadData()
  }, [result])

  React.useEffect(() => {
    const loadTables = async () => {
      // Try parsing from tables blob if available
      if (result.tablesBlob) {
        try {
          const text = result.tablesBlob instanceof Blob
            ? await blobToText(result.tablesBlob)
            : ''
          if (text) {
            const parsed = JSON.parse(text)
            const normalized = normalizeTablesFromJson(parsed)
            if (normalized.length > 0) {
              setTables(normalized)
              return
            }
          }
        } catch (error) {
          console.error('Error parsing tables blob:', error)
        }
      }

      if (!result.markdownContent) {
        setTables([])
        return
      }

      try {
        const parsedTables = extractTablesFromMarkdown(result.markdownContent)
        setTables(parsedTables)
      } catch (error) {
        console.error('Error extracting tables from markdown:', error)
        setTables([])
      }
    }

    loadTables()
  }, [result.tablesBlob, result.markdownContent])

  // Get all images from Datalab (original extraction)
  const allImages = originalImages ? Object.entries(originalImages) : []
  
  // Get GPT analysis results (optional)
  const gptAnalysisMap = new Map(
    result.graphifyResults?.summary.map(g => [g.imageName, g]) || []
  )

  const tablesFound = tables ? tables.length : result.stats?.tablesFound ?? 0

  const handleDownload = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen w-full overflow-y-auto bg-gray-50">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-10">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <Button
              variant="ghost"
              onClick={onBack}
              className="mb-4 -ml-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Back to Upload
            </Button>
            <h1 className="text-3xl font-bold text-gray-900">{documentName}</h1>
            <p className="mt-2 text-sm text-gray-600">
              Comprehensive paper analysis with extracted content, graphs, and data
            </p>
          </div>
          {result.stats && (
            <Card className="ml-4">
              <CardContent className="pt-6">
                <div className="flex gap-6 text-sm">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{result.stats.imagesFound}</div>
                    <div className="text-xs text-gray-600">Images</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">{tablesFound}</div>
                    <div className="text-xs text-gray-600">Tables</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{result.stats.graphsDetected}</div>
                    <div className="text-xs text-gray-600">Graphs</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {(result.stats.processingTimeMs / 1000).toFixed(1)}s
                    </div>
                    <div className="text-xs text-gray-600">Time</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('markdown')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'markdown'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            <FileText className="h-4 w-4" />
            Markdown Content
          </button>
          <button
            onClick={() => setActiveTab('tables')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'tables'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            <Database className="h-4 w-4" />
            Tables ({tablesFound})
          </button>
          <button
            onClick={() => setActiveTab('graphs')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'graphs'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            Images & Graphs ({allImages.length})
          </button>
          <button
            onClick={() => setActiveTab('data')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'data'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            <Code className="h-4 w-4" />
            Structured Data
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1">
          {/* Markdown Tab */}
          {activeTab === 'markdown' && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Paper Content</CardTitle>
                    <CardDescription>
                      Extracted text content in markdown format
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={markdownView === 'rendered' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setMarkdownView('rendered')}
                    >
                      <Eye className="h-4 w-4" />
                      Rendered
                    </Button>
                    <Button
                      variant={markdownView === 'source' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setMarkdownView('source')}
                    >
                      <Code className="h-4 w-4" />
                      Source
                    </Button>
                    {result.markdownBlob && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(result.markdownBlob!, `${documentName}.md`)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {markdownView === 'rendered' ? (
                  <div className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-a:text-blue-600 prose-code:text-purple-600 prose-pre:bg-gray-900 prose-pre:text-gray-100">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeHighlight, rehypeRaw]}
                    >
                      {result.markdownContent || ''}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="max-h-[600px] overflow-auto rounded-lg border border-gray-200">
                    <SyntaxHighlighter
                      language="markdown"
                      style={vscDarkPlus}
                      showLineNumbers
                      wrapLines
                      customStyle={{
                        margin: 0,
                        borderRadius: 0,
                      }}
                    >
                      {result.markdownContent || ''}
                    </SyntaxHighlighter>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Tables Tab */}
          {activeTab === 'tables' && (
            <div className="space-y-6">
              {!tables || tables.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Database className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No tables found in this document</p>
                    <p className="text-sm text-gray-500 mt-2">
                      The PDF may not contain any tables or they were not detected in the markdown output
                    </p>
                  </CardContent>
                </Card>
              ) : (
                tables.map((table) => {
                  const csvContent = buildCsvFromTable(table)

                  return (
                    <Card key={table.index}>
                      <CardHeader>
                        <CardTitle className="text-lg">Table {table.index}</CardTitle>
                        <CardDescription>
                          {table.headers.length} columns × {table.rows.length} rows
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Rendered Table */}
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-2">Table View</h4>
                          <div className="overflow-x-auto rounded-lg border border-gray-200">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-50">
                                <tr>
                                  {table.headers.map((header, headerIdx) => (
                                    <th
                                      key={headerIdx}
                                      className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-r border-gray-200 last:border-r-0"
                                    >
                                      {header || '—'}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {table.rows.length === 0 ? (
                                  <tr>
                                    <td colSpan={table.headers.length} className="px-4 py-4 text-sm text-gray-500 text-center">
                                      No data rows found
                                    </td>
                                  </tr>
                                ) : (
                                  table.rows.map((row, rowIdx) => (
                                    <tr key={rowIdx} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                      {row.map((cell, cellIdx) => (
                                        <td
                                          key={cellIdx}
                                          className="px-4 py-3 text-sm text-gray-900 border-r border-gray-200 last:border-r-0"
                                        >
                                          {cell || '—'}
                                        </td>
                                      ))}
                                      {row.length < table.headers.length &&
                                        Array.from({ length: table.headers.length - row.length }).map((_, fillerIdx) => (
                                          <td
                                            key={`filler-${fillerIdx}`}
                                            className="px-4 py-3 text-sm text-gray-500 border-r border-gray-200 last:border-r-0"
                                          >
                                            —
                                          </td>
                                        ))}
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* CSV Export Data */}
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-2">
                            CSV Format
                          </h4>
                          <div className="rounded-lg overflow-hidden border border-gray-200">
                            <SyntaxHighlighter
                              language="plaintext"
                              style={vscDarkPlus}
                              customStyle={{
                                margin: 0,
                                fontSize: '12px',
                              }}
                            >
                              {csvContent}
                            </SyntaxHighlighter>
                          </div>
                        </div>

                        {/* Markdown Source */}
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-2">
                            Markdown Source
                          </h4>
                          <div className="rounded-lg overflow-hidden border border-gray-200">
                            <SyntaxHighlighter
                              language="markdown"
                              style={vscDarkPlus}
                              customStyle={{
                                margin: 0,
                                fontSize: '12px',
                              }}
                            >
                              {table.rawMarkdown}
                            </SyntaxHighlighter>
                          </div>
                        </div>

                        {/* JSON Format */}
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-2">
                            JSON Format
                          </h4>
                          <div className="rounded-lg overflow-hidden border border-gray-200">
                            <SyntaxHighlighter
                              language="json"
                              style={vscDarkPlus}
                              customStyle={{
                                margin: 0,
                                fontSize: '12px',
                              }}
                            >
                              {JSON.stringify({ headers: table.headers, rows: table.rows }, null, 2)}
                            </SyntaxHighlighter>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })
              )}
            </div>
          )}

          {/* Images & Graphs Tab */}
          {activeTab === 'graphs' && (
            <div className="space-y-6">
              {allImages.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <ImageIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No images found in this document</p>
                    <p className="text-sm text-gray-500 mt-2">
                      The PDF may not contain any extractable images
                    </p>
                  </CardContent>
                </Card>
              ) : (
                allImages.map(([imageName, imageData], idx) => {
                  const gptAnalysis = gptAnalysisMap.get(imageName)
                  const isGraph = gptAnalysis?.isGraph || false
                  
                  return (
                    <Card key={idx}>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          {imageName}
                          {isGraph && (
                            <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
                              Graph Detected
                            </span>
                          )}
                        </CardTitle>
                        <CardDescription>
                          {gptAnalysis?.graphType && (
                            <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                              {gptAnalysis.graphType}
                            </span>
                          )}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Original Image from Datalab */}
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-2">
                            Original Image (from Datalab API)
                          </h4>
                          <TransformWrapper
                            initialScale={1}
                            minScale={0.5}
                            maxScale={10}
                            doubleClick={{ disabled: true }}
                            wheel={{ step: 0.1 }}
                            pinch={{ step: 0.12 }}
                            panning={{ velocityDisabled: true }}
                          >
                            {({ zoomIn, zoomOut, resetTransform }) => (
                              <div className="relative rounded-lg border border-gray-200 bg-white">
                                <div className="absolute right-3 top-3 z-10 flex gap-2 rounded-md bg-white/90 p-1 shadow-sm">
                                  <button
                                    type="button"
                                    onClick={() => zoomOut()}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded border border-gray-200 text-gray-600 transition-colors hover:bg-gray-100"
                                    aria-label="Zoom out"
                                  >
                                    <ZoomOut className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => resetTransform()}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded border border-gray-200 text-gray-600 transition-colors hover:bg-gray-100"
                                    aria-label="Reset zoom"
                                  >
                                    <Undo2 className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => zoomIn()}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded border border-gray-200 text-gray-600 transition-colors hover:bg-gray-100"
                                    aria-label="Zoom in"
                                  >
                                    <ZoomIn className="h-4 w-4" />
                                  </button>
                                </div>
                                <TransformComponent
                                  wrapperClass="max-h-[520px] overflow-hidden rounded-lg"
                                  contentClass="flex items-center justify-center"
                                >
                                  <img
                                    src={imageData.startsWith('data:') 
                                      ? imageData
                                      : `data:image/png;base64,${imageData}`}
                                    alt={imageName}
                                    className="max-w-full select-none"
                                    draggable={false}
                                  />
                                </TransformComponent>
                              </div>
                            )}
                          </TransformWrapper>
                          <p className="mt-2 text-xs text-gray-500">
                            Scroll or pinch to zoom, drag to pan. Use the controls to adjust or reset the view.
                          </p>
                        </div>

                        {/* GPT Analysis (if available) */}
                        {gptAnalysis && (
                          <>
                            {/* Reason */}
                            {gptAnalysis.reason && (
                              <div>
                                <h4 className="text-sm font-medium text-gray-700 mb-2">
                                  GPT Analysis
                                </h4>
                                <p className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
                                  {gptAnalysis.reason}
                                </p>
                              </div>
                            )}

                            {/* Extracted Data */}
                            {gptAnalysis.data && isGraph && (
                              <div>
                                <h4 className="text-sm font-medium text-gray-700 mb-2">
                                  Extracted Data (GPT)
                                </h4>
                                <div className="rounded-lg overflow-hidden border border-gray-200">
                                  <SyntaxHighlighter
                                    language="json"
                                    style={vscDarkPlus}
                                    customStyle={{
                                      margin: 0,
                                      fontSize: '12px',
                                    }}
                                  >
                                    {JSON.stringify(gptAnalysis.data, null, 2)}
                                  </SyntaxHighlighter>
                                </div>
                              </div>
                            )}

                            {/* Python Code */}
                            {gptAnalysis.pythonCode && isGraph && (
                              <div>
                                <h4 className="text-sm font-medium text-gray-700 mb-2">
                                  Reconstruction Code (Python)
                                </h4>
                                <div className="rounded-lg overflow-hidden border border-gray-200">
                                  <SyntaxHighlighter
                                    language="python"
                                    style={vscDarkPlus}
                                    showLineNumbers
                                    customStyle={{
                                      margin: 0,
                                      fontSize: '12px',
                                    }}
                                  >
                                    {gptAnalysis.pythonCode}
                                  </SyntaxHighlighter>
                                </div>
                              </div>
                            )}

                            {/* Assumptions */}
                            {gptAnalysis.assumptions && isGraph && (
                              <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg">
                                <h4 className="text-sm font-medium text-yellow-900 mb-1">
                                  Assumptions
                                </h4>
                                <p className="text-sm text-yellow-700">
                                  {gptAnalysis.assumptions}
                                </p>
                              </div>
                            )}

                            {/* Error if GPT analysis failed */}
                            {gptAnalysis.error && (
                              <div className="bg-red-50 border border-red-200 p-3 rounded-lg">
                                <h4 className="text-sm font-medium text-red-900 mb-1">
                                  Analysis Error
                                </h4>
                                <p className="text-sm text-red-700">
                                  {gptAnalysis.error}
                                </p>
                              </div>
                            )}
                          </>
                        )}

                        {/* No GPT analysis available */}
                        {!gptAnalysis && (
                          <div className="bg-gray-50 border border-gray-200 p-3 rounded-lg">
                            <p className="text-sm text-gray-600">
                              <strong>Note:</strong> GPT analysis not available for this image. 
                              Enable graph detection during extraction for AI-powered analysis.
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )
                })
              )}
            </div>
          )}

          {/* Data Tab */}
          {activeTab === 'data' && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Structured Data</CardTitle>
                    <CardDescription>
                      View extracted data in JSON format
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={selectedDataView === 'original' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedDataView('original')}
                      disabled={!originalImages}
                    >
                      Original Images
                    </Button>
                    <Button
                      variant={selectedDataView === 'response' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedDataView('response')}
                      disabled={!responseJson}
                    >
                      Full Response
                    </Button>
                    <Button
                      variant={selectedDataView === 'gpt' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedDataView('gpt')}
                      disabled={!graphifyData}
                    >
                      GPT Analysis
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="max-h-[600px] overflow-auto rounded-lg border border-gray-200">
                  <SyntaxHighlighter
                    language="json"
                    style={vscDarkPlus}
                    showLineNumbers
                    wrapLines
                    customStyle={{
                      margin: 0,
                      borderRadius: 0,
                      fontSize: '12px',
                    }}
                  >
                    {selectedDataView === 'original' && originalImages
                      ? JSON.stringify(originalImages, null, 2)
                      : selectedDataView === 'response' && responseJson
                      ? JSON.stringify(responseJson, null, 2)
                      : selectedDataView === 'gpt' && graphifyData
                      ? JSON.stringify(graphifyData, null, 2)
                      : 'No data available'}
                  </SyntaxHighlighter>
                </div>
                
                {/* Download buttons */}
                <div className="mt-4 flex gap-2">
                  {result.originalImagesBlob && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(
                        result.originalImagesBlob!, 
                        `${documentName}-original-images.json`
                      )}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download Original Images
                    </Button>
                  )}
                  {result.responseJsonBlob && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(
                        result.responseJsonBlob!, 
                        `${documentName}-response.json`
                      )}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download Full Response
                    </Button>
                  )}
                  {result.graphifyResults?.graphifyJsonBlob && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(
                        result.graphifyResults!.graphifyJsonBlob!, 
                        `${documentName}-gpt-analysis.json`
                      )}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download GPT Analysis
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function extractTablesFromMarkdown(markdown: string): TableData[] {
  if (!markdown) {
    return []
  }

  const processor = unified().use(remarkParse).use(remarkGfm)
  const tree = processor.parse(markdown)
  const tables: TableData[] = []

  visit(tree, 'table', (node) => {
    const tableNode = node as MdastTable
    const rows = (tableNode.children || []) as MdastTableRow[]
    if (rows.length === 0) {
      return
    }

    const firstRowCells = (rows[0]?.children || []) as MdastTableCell[]
    let headers = firstRowCells.map((cell, idx) => {
      const text = toString(cell).trim()
      return text || `Column ${idx + 1}`
    })
    let dataStartIndex = 1

    const hasMeaningfulHeader = headers.some(header => header && header.trim().length > 0)
    if (!hasMeaningfulHeader) {
      const columnCount = firstRowCells.length || Math.max(...rows.map(row => row.children.length)) || 0
      headers = Array.from({ length: columnCount }, (_, idx) => `Column ${idx + 1}`)
      dataStartIndex = 0
    }

    const dataRows = rows.slice(dataStartIndex).map((row) => {
      const cells = (row.children || []) as MdastTableCell[]
      return headers.map((_, idx) => {
        const cell = cells[idx]
        return cell ? toString(cell).trim() : ''
      })
    })

    const tableIndex = tables.length + 1
    const rawMarkdown = buildMarkdownFromTable(headers, dataRows)

    tables.push({
      index: tableIndex,
      headers,
      rows: dataRows,
      rawMarkdown
    })
  })

  return tables
}

function normalizeTablesFromJson(data: unknown): TableData[] {
  if (!Array.isArray(data)) {
    return []
  }

  return data.reduce<TableData[]>((acc, item, index) => {
    if (!item || typeof item !== 'object') {
      return acc
    }

    const table = item as Record<string, unknown>
    const rawHeaders = Array.isArray(table.headers) ? table.headers : []
    let headers = rawHeaders.map((header, headerIdx) => normalizeHeaderValue(header, headerIdx))

    const rawRows = Array.isArray(table.rows) ? table.rows : []
    const rowValues = rawRows.map(row =>
      Array.isArray(row)
        ? row.map(cell => normalizeCellValue(cell))
        : []
    )

    if (headers.length === 0 && rowValues.length > 0) {
      const columnCount = rowValues[0]?.length ?? 0
      headers = Array.from({ length: columnCount }, (_, idx) => `Column ${idx + 1}`)
    }

    if (headers.length === 0) {
      return acc
    }

    const normalizedRows = rowValues.map(row =>
      headers.map((_, cellIdx) => row[cellIdx] ?? '')
    )

    const rawMarkdown = typeof table.rawMarkdown === 'string'
      ? table.rawMarkdown
      : buildMarkdownFromTable(headers, normalizedRows)

    acc.push({
      index: index + 1,
      headers,
      rows: normalizedRows,
      rawMarkdown
    })

    return acc
  }, [])
}

function buildMarkdownFromTable(headers: string[], rows: string[][]): string {
  if (headers.length === 0) {
    return ''
  }

  const escapedHeaders = headers.map(escapeMarkdownCell)
  const headerLine = `| ${escapedHeaders.join(' | ')} |`
  const separatorLine = `| ${headers.map(() => '---').join(' | ')} |`
  const bodyLines = rows.map(row => {
    const cells = headers.map((_, idx) => escapeMarkdownCell(row[idx] ?? ''))
    return `| ${cells.join(' | ')} |`
  })

  return [headerLine, separatorLine, ...bodyLines].join('\n')
}

function normalizeHeaderValue(value: unknown, index: number): string {
  const text = normalizeCellValue(value).trim()
  return text || `Column ${index + 1}`
}

function normalizeCellValue(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }
  if (value === null || value === undefined) {
    return ''
  }
  return String(value)
}

function escapeMarkdownCell(value: string): string {
  if (!value) return ''
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ')
}

function buildCsvFromTable(table: TableData): string {
  const headerLine = table.headers.map(escapeCsvCell).join(',')
  const rowLines = table.rows.map(row =>
    table.headers.map((_, idx) => escapeCsvCell(row[idx] ?? '')).join(',')
  )
  return [headerLine, ...rowLines].join('\n')
}

function escapeCsvCell(value: string): string {
  const safeValue = value ?? ''
  if (/[",\n]/.test(safeValue)) {
    return `"${safeValue.replace(/"/g, '""')}"`
  }
  return safeValue
}

