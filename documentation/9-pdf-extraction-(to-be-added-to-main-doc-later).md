**Documentation Version**: 2.1   
**Last Updated**: November 3, 2025  

# ABCresearch - PDF Content Extraction Documentation

## Overview

The PDF Content Extraction feature enables users to upload PDF documents (such as research papers, clinical reports, or regulatory documents) and extract structured content including markdown text, images, tables, and AI-powered graph analysis. This feature integrates Datalab's Marker API for PDF processing and OpenAI's GPT Vision for intelligent graph detection and reconstruction, with a comprehensive Paper Analysis View for in-depth exploration.

## Core Purpose

The PDF extraction system serves to:
- **Convert PDFs to Markdown**: Extract readable text content from scientific papers
- **Preserve Document Structure**: Maintain headings, lists, and formatting
- **Extract Images & Tables**: Capture figures, charts, diagrams, and tabular data
- **Detect Graphs**: Use AI to identify data visualizations
- **Generate Reconstruction Code**: Provide Python code to recreate graphs
- **Enable Data Reuse**: Download multiple formats for different use cases
- **Provide Comprehensive Analysis**: Interactive view for exploring extracted content

## Key Features

### 1. PDF to Markdown Conversion
- Powered by Datalab Marker API
- OCR support for scanned documents
- Preserves document structure (headings, paragraphs, lists)
- Handles multi-column layouts
- Supports scientific notation and equations
- Automatic table detection and parsing

### 2. Intelligent Graph Detection & Rendering
- GPT Vision API analyzes extracted images
- Identifies data visualizations (charts, plots, graphs)
- Distinguishes graphs from photos/diagrams
- Extracts approximate data points
- Generates Python matplotlib reconstruction code
- **NEW**: Browser-based Python execution with Pyodide
  - Render GPT-generated Python code directly in browser
  - No Python installation required
  - First load: ~10-15 seconds (Pyodide initialization)
  - Subsequent renders: < 1 second
  - Compare original vs AI-reconstructed graphs side-by-side

### 3. Paper Analysis View (New)
Interactive interface for comprehensive content exploration:

- **Markdown Viewer**: Toggle between rendered and source views
  - GitHub Flavored Markdown rendering
  - Syntax-highlighted code blocks
  - Raw markdown with line numbers
  
- **Table Browser**: Structured view of extracted tables
  - Parsed from markdown automatically
  - Downloadable as JSON
  - Filterable and searchable
  
- **Graph Gallery**: Visual analysis of detected charts
  - Original images with zoom/pan controls
  - AI-generated analysis
  - Extracted numeric data
  - Python reconstruction code with syntax highlighting
  - **NEW**: One-click graph rendering in browser (Pyodide)
  - **NEW**: Compare original vs reconstructed graphs
  - **NEW**: Visual verification of GPT data extraction accuracy
  
- **Data Inspector**: JSON viewers with syntax highlighting
  - Original images data
  - Full API response
  - GPT analysis results

### 4. Multiple Download Formats
Users receive up to five downloadable outputs:

1. **Markdown File (.md)**
   - Full text content
   - Document structure preserved
   - References to figures
   - Readable in any text editor

2. **Original Extracted Images (.json)**
   - All images extracted by Datalab API
   - Base64 encoded image data
   - Image names and metadata
   - Ready for external processing

3. **Full API Response (.json)**
   - Complete Datalab API response
   - All extracted images (base64 encoded)
   - Processing metadata
   - Raw data for programmatic use

4. **GPT Graph Analysis (.json)**
   - Per-image analysis results
   - Graph type identification
   - Extracted numeric data
   - Python matplotlib code
   - Assumptions and notes

5. **Tables Data (.json)** (Optional)
   - Parsed table structures
   - Headers and data rows
   - Raw markdown for each table
   - Machine-readable format

### 5. Configurable Processing Options
- **Graph Detection Toggle**: Enable/disable GPT Vision processing
- **Max Images Limit**: Control processing time and cost (1-20 images)
- **Drag & Drop Upload**: Modern file upload with drag-and-drop support
- **Force OCR**: Option to force optical character recognition (hardcoded to false currently)
- **Real-time Stats**: Images found, graphs detected, tables found, processing time

## User Workflow

### Typical Extraction Session

1. **Navigate to Data Extraction**
   - Click "Data Extraction" tab in main navigation
   - Upload interface loads with card-based UI

2. **Upload PDF**
   - Click upload area or **drag & drop PDF file**
   - Visual feedback during drag operation
   - Select PDF file (up to 50MB)
   - See file name and size displayed in blue card
   - Remove file with X button if needed

3. **Configure Options** (Optional)
   - Toggle "Enable graph detection with GPT Vision" (default: enabled)
   - Adjust "Max images to analyze" slider (1-20, default: 10)
   - See warning about processing time and cost

4. **Extract Content**
   - Click "Extract Content" button
   - Processing begins (30 seconds to 5 minutes)
   - Loading indicator shown with progress message:
     - "Processing PDF..."
     - "Extracting tables from your document"

5. **View Initial Results**
   - Success banner with statistics:
     - Images found count
     - Graphs detected count
     - Tables found count (if applicable)
     - Processing time in seconds
   - Graph detection summary (if graphs found, shows first 5)
   - **"View Comprehensive Analysis" button** (New!)
   - Download buttons for all formats

6. **Explore Analysis View** (New Workflow)
   - Click "View Comprehensive Analysis"
   - Navigate comprehensive interface with tabs:
     - **Markdown**: Toggle rendered/source views
     - **Tables**: Browse extracted tables (if any)
     - **Graphs**: Zoom/pan through detected graphs
       - **NEW**: Click "Render Graph in Browser" to execute Python code
       - **NEW**: First render initializes Python environment (10-15s)
       - **NEW**: Compare original extraction vs AI reconstruction
       - **NEW**: Verify data accuracy visually
     - **Data**: Inspect structured JSON data
   - Download individual components from within analysis view
   - Use "Back to Upload" to return to extraction interface

7. **Download Outputs** (Traditional Workflow)
   - Click "Download Markdown Content" for text content
   - Click "Download Original Extracted Images" for raw image data
   - Click "Download Full API Response" for complete data
   - Click "Download GPT Graph Analysis" (if graphs detected)
   - Click "Download Tables" (if tables found)

8. **Process Additional PDFs**
   - Click "Clear and Start Over" button
   - File input resets
   - Upload new PDF
   - Repeat process

## Technical Architecture

### Backend Implementation

**File**: `api/extract-pdf-content.ts`

**Architecture Pattern**:
```
Frontend Upload
    ↓
Vercel Serverless Function
    ↓
Parse multipart form (Formidable)
    ↓
Submit to Datalab Marker API
    ↓
Poll for completion (2s intervals, 15min timeout)
    ↓
Extract markdown + images
    ↓
Process images with GPT Vision (parallel, max 3 concurrent)
    ↓
Aggregate results + encode as base64
    ↓
Return to frontend
```

**Key Components**:

1. **Multipart Parsing**:
```typescript
import formidable from 'formidable'

const form = formidable({
  maxFileSize: 50 * 1024 * 1024,  // 50MB limit
  allowEmptyFiles: false
})

const [fields, files] = await form.parse(req)
```

2. **Datalab API Integration**:
```typescript
const blob = new Blob([fileBuffer], { type: 'application/pdf' })
const form = new FormData()
form.append('file', blob, fileName)
form.append('output_format', 'markdown')
form.append('force_ocr', 'false')
form.append('disable_image_extraction', 'false')

const response = await fetch('https://www.datalab.to/api/v1/marker', {
  method: 'POST',
  headers: { 'X-Api-Key': process.env.DATALAB_API_KEY },
  body: form
})
```

3. **Job Polling**:
```typescript
async function pollDatalabJob(checkUrl, apiKey, timeout = 15 minutes) {
  while (true) {
    await sleep(2000)  // Poll every 2 seconds
    const status = await fetch(checkUrl)
    if (status === 'complete') return result
    if (timeout exceeded) throw TimeoutError
  }
}
```

4. **GPT Vision Processing**:
```typescript
// Process up to maxImages with concurrency of 3
for (let i = 0; i < images.length; i += 3) {
  const batch = images.slice(i, i + 3)
  const results = await Promise.all(
    batch.map(img => processImageWithGPT(img))
  )
}

async function processImageWithGPT(imageData, imageName) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: graphAnalysisPrompt },
        { type: 'image_url', image_url: { url: dataUrl } }
      ]
    }]
  })
  
  return {
    imageName,
    isGraph: result.is_graph,
    graphType: result.graph_type,
    pythonCode: result.python_code,
    data: result.data,
    assumptions: result.assumptions
  }
}
```

5. **Response Formation**:
```typescript
return {
  success: true,
  jobId: 'job-123',
  markdown: extractedText,
  markdownBlob: Buffer.from(markdown).toString('base64'),
  responseJson: fullDatalabResponse,
  responseJsonBlob: Buffer.from(JSON.stringify(response)).toString('base64'),
  originalImagesBlob: imagesFound > 0 
    ? Buffer.from(JSON.stringify(images)).toString('base64')
    : undefined,
  graphifyResults: {
    summary: graphAnalysisResults,
    graphifyJsonBlob: Buffer.from(JSON.stringify(graphs)).toString('base64')
  },
  stats: {
    imagesFound: imageCount,
    graphsDetected: graphCount,
    processingTimeMs: duration
  }
}
```

---

### Pyodide Graph Rendering (NEW Feature)

**Service**: `src/services/pyodideGraphRenderer.ts`

**Purpose**: Execute GPT-generated Python matplotlib code directly in the browser using Pyodide (WebAssembly Python runtime), enabling users to see AI-reconstructed graphs without needing a local Python installation.

**Architecture**:
```typescript
class PyodideGraphRenderer {
  private pyodide: PyodideInterface | null = null
  private isInitialized = false
  private initializationPromise: Promise<void> | null = null

  // Initialize Pyodide with matplotlib and numpy
  async initialize(): Promise<void> {
    // Load from CDN (~50MB, cached after first load)
    this.pyodide = await loadPyodide({
      indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.29.0/full/'
    })
    
    // Load required packages
    await this.pyodide.loadPackage(['matplotlib', 'numpy'])
    
    // Configure matplotlib backend
    await this.pyodide.runPythonAsync(`
      import matplotlib
      matplotlib.use('Agg')  # Non-GUI backend
    `)
  }

  // Render graph from Python code
  async renderGraph(pythonCode: string): Promise<RenderResult> {
    // Wrap GPT code to capture output
    const wrappedCode = `
      import matplotlib.pyplot as plt
      import numpy as np
      import base64
      
      # Execute GPT-generated code
      ${pythonCode}
      
      # Call the plotting function
      output_path = '/tmp/plot.png'
      recreate_plot(output_path)
      
      # Read and encode as base64
      with open(output_path, 'rb') as f:
        img_base64 = base64.b64encode(f.read()).decode('utf-8')
      
      img_base64
    `
    
    const result = await this.pyodide.runPythonAsync(wrappedCode)
    return {
      success: true,
      imageDataUrl: `data:image/png;base64,${result}`
    }
  }
}
```

**Key Features**:
- **Lazy Loading**: Pyodide only loads when user clicks "Render Graph"
- **Singleton Pattern**: One instance per session, initialization cached
- **Error Handling**: Graceful failure with helpful error messages
- **Performance Tracking**: Logs initialization and execution times
- **Virtual Filesystem**: Uses Pyodide's in-memory filesystem for temp files

**Performance Characteristics**:
- First initialization: 10-15 seconds (downloads ~50MB from CDN)
- Subsequent renders: < 1 second (instant execution)
- Bundle size impact: 0 bytes (loaded on demand from CDN)
- Memory usage: ~50-100MB in browser
- Browser caching: Packages cached for future sessions

**Browser Compatibility**:
- Chrome/Edge 90+: ✅ Full support
- Firefox 90+: ✅ Full support  
- Safari 15.4+: ✅ Full support
- Mobile browsers: ⚠️ Slower, high memory usage

**Dependencies**:
```json
{
  "pyodide": "^0.29.0"
}
```

**CDN Resources**:
- Pyodide core: ~6MB (gzipped)
- Matplotlib: ~30MB (gzipped)
- Numpy: ~15MB (gzipped)
- Total first load: ~50MB (cached by browser)

---

### Frontend Implementation

**Service Layer**: `src/services/pdfExtractionService.ts`

**Main Method**:
```typescript
static async extractContent(
  file: File, 
  options: ExtractionOptions = {}
): Promise<PDFExtractionResult> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('enableGraphify', String(options.enableGraphify ?? true))
  formData.append('forceOCR', String(options.forceOCR ?? false))
  formData.append('maxGraphifyImages', String(options.maxGraphifyImages ?? 10))

  const response = await fetch('/api/extract-pdf-content', {
    method: 'POST',
    body: formData
  })

  const data = await response.json()

  // Convert base64 to Blob for downloads
  return {
    success: data.success,
    markdownBlob: base64ToBlob(data.markdownBlob, 'text/markdown'),
    responseJsonBlob: base64ToBlob(data.responseJsonBlob, 'application/json'),
    originalImagesBlob: data.originalImagesBlob
      ? base64ToBlob(data.originalImagesBlob, 'application/json')
      : undefined,
    graphifyResults: ...,
    stats: data.stats
  }
}
```

**Helper Methods**:
```typescript
// Convert base64 string to downloadable Blob
private static base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64)
  const byteArray = new Uint8Array(byteCharacters.length)
  for (let i = 0; i < byteCharacters.length; i++) {
    byteArray[i] = byteCharacters.charCodeAt(i)
  }
  return new Blob([byteArray], { type: mimeType })
}

// Trigger browser download
static downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}
```

**UI Component**: `src/components/PDFExtraction.tsx`

**State Management**:
```typescript
const [selectedFile, setSelectedFile] = useState<File | null>(null)
const [isProcessing, setIsProcessing] = useState(false)
const [extractionResult, setExtractionResult] = useState<PDFExtractionResult | null>(null)
const [enableGraphify, setEnableGraphify] = useState(true)
const [maxImages, setMaxImages] = useState(10)
const [isDragging, setIsDragging] = useState(false)  // New: Drag state
const [showAnalysisView, setShowAnalysisView] = useState(false)  // New: Analysis view toggle
const fileInputRef = useRef<HTMLInputElement>(null)  // New: For resetting input
```

**UI Sections**:

1. **File Upload Area with Drag & Drop**:
```tsx
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
      className={`w-full h-32 border-2 border-dashed ${
        isDragging 
          ? 'border-primary bg-primary/10 border-solid' 
          : 'hover:border-primary hover:bg-accent'
      }`}
      asChild
    >
      <div className="flex flex-col items-center gap-2">
        <Upload className={isDragging ? 'text-primary' : 'text-muted-foreground'} />
        <span>
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
```

2. **Selected File Display**:
```tsx
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
      <Button variant="ghost" size="icon" onClick={handleReset}>
        <X className="h-4 w-4" />
      </Button>
    )}
  </div>
)}
```

3. **Options Panel**:
```tsx
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
```

4. **Extract Button & Loading State**:
```tsx
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
```

5. **Success Display**:
```tsx
<div className="bg-green-50">
  <CheckCircle2 />
  Extraction Successful!
  
  <p>{message}</p>
  
  <div className="flex items-center gap-3 text-xs">
    <span className="flex items-center gap-1">
      <FileText /> {imagesFound} images found
    </span>
    {graphsDetected > 0 && (
      <span className="flex items-center gap-1">
        <Image /> {graphsDetected} graphs detected
      </span>
    )}
    <span>· Processed in {(processingTimeMs / 1000).toFixed(1)}s</span>
  </div>
</div>

{/* NEW: View Comprehensive Analysis Button */}
<Button onClick={handleViewAnalysis} className="w-full">
  <FileText /> View Comprehensive Analysis
</Button>

{/* Download Buttons */}
<div className="space-y-2">
  <p className="text-sm font-medium">Download Results:</p>
  
  {markdownBlob && (
    <Button 
      onClick={() => downloadBlob(markdownBlob, `${fileName}.md`)}
      variant="outline"
      className="w-full justify-between"
    >
      <div className="flex items-center gap-2">
        <FileText /> <span>Markdown Content</span>
      </div>
      <Download className="h-4 w-4" />
    </Button>
  )}

  {originalImagesBlob && (
    <Button 
      onClick={() => downloadBlob(originalImagesBlob, `${fileName}-original-images.json`)}
      variant="outline"
      className="w-full justify-between"
    >
      <div className="flex items-center gap-2">
        <Image /> <span>Original Extracted Images (JSON)</span>
      </div>
      <Download />
    </Button>
  )}

  {responseJsonBlob && (
    <Button 
      onClick={() => downloadBlob(responseJsonBlob, `${fileName}-response.json`)}
      variant="outline"
      className="w-full justify-between"
    >
      <div className="flex items-center gap-2">
        <FileText /> <span>Full API Response (JSON)</span>
      </div>
      <Download />
    </Button>
  )}

  {graphifyResults?.graphifyJsonBlob && (
    <Button 
      onClick={() => downloadBlob(graphifyJsonBlob, `${fileName}-gpt-analysis.json`)}
      variant="outline"
      className="w-full justify-between"
    >
      <div className="flex items-center gap-2">
        <Image /> <span>GPT Graph Analysis (JSON)</span>
      </div>
      <Download />
    </Button>
  )}

  {/* Graph Summary (collapsed to first 5) */}
  {graphifyResults && graphifyResults.summary.filter(r => r.isGraph).length > 0 && (
    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
      <p className="text-xs font-medium text-blue-900 mb-2">
        Graph Detection Summary:
      </p>
      <div className="space-y-1">
        {graphifyResults.summary
          .filter(r => r.isGraph)
          .slice(0, 5)
          .map((result, idx) => (
            <div key={idx} className="text-xs text-blue-700">
              <span className="font-medium">{result.imageName}</span>: {result.graphType || 'graph'}
            </div>
          ))}
        {graphifyResults.summary.filter(r => r.isGraph).length > 5 && (
          <p className="text-xs text-blue-600 italic">
            +{graphifyResults.summary.filter(r => r.isGraph).length - 5} more graphs
          </p>
        )}
      </div>
    </div>
  )}
</div>
```

6. **Error Display**:
```tsx
<div className="bg-red-50 flex items-start gap-3 p-4">
  <AlertCircle className="h-5 w-5 text-red-600" />
  <div>
    <p className="text-sm font-medium text-red-900">Extraction Failed</p>
    <p className="text-sm text-red-700 mt-1">{errorMessage}</p>
  </div>
</div>
```

7. **Reset Functionality**:
```tsx
{extractionResult && !isProcessing && (
  <Button onClick={handleReset} variant="ghost" className="w-full">
    <X /> Clear and Start Over
  </Button>
)}
```

**Conditional Rendering for Analysis View**:
```typescript
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

// Otherwise show upload interface
return (
  <div className="min-h-screen w-full overflow-y-auto bg-gray-50">
    {/* Upload interface */}
  </div>
)
```

---

### Paper Analysis View Component

**File**: `src/components/PaperAnalysisView.tsx`

**Purpose**: Comprehensive interface for exploring extracted PDF content with rich formatting, interactive views, and data visualization.

**Component Props**:
```typescript
interface PaperAnalysisViewProps {
  result: PDFExtractionResult
  fileName: string
  onBack: () => void
}
```

**State Management**:
```typescript
const [activeTab, setActiveTab] = useState<ViewTab>('markdown')  // 'markdown' | 'tables' | 'graphs' | 'data'
const [markdownView, setMarkdownView] = useState<MarkdownView>('rendered')  // 'rendered' | 'source'
const [selectedDataView, setSelectedDataView] = useState<'original' | 'response' | 'gpt'>('original')
const [tables, setTables] = useState<TableData[] | null>(null)
const [originalImages, setOriginalImages] = useState<Record<string, string> | null>(null)
const [responseJson, setResponseJson] = useState<Record<string, unknown> | null>(null)
const [graphifyData, setGraphifyData] = useState<unknown[] | null>(null)

// NEW: Pyodide rendering state
const [renderedGraphs, setRenderedGraphs] = useState<Map<string, string>>(new Map())
const [renderingGraph, setRenderingGraph] = useState<string | null>(null)
const [renderErrors, setRenderErrors] = useState<Map<string, string>>(new Map())
const [isPyodideInitialized, setIsPyodideInitialized] = useState(false)
const [pyodideInitMessage, setPyodideInitMessage] = useState('Python environment not loaded')
```

**Key Dependencies**:
```typescript
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import rehypeHighlight from 'rehype-highlight'
import rehypeRaw from 'rehype-raw'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import { pyodideRenderer } from '@/services/pyodideGraphRenderer'  // NEW: Pyodide rendering
```

**Component Structure**:

1. **Header Section**:
```tsx
<div className="bg-white shadow-sm p-4">
  <Button variant="ghost" onClick={onBack}>
    <ChevronLeft /> Back to Upload
  </Button>
  <h1 className="text-2xl font-bold">{documentName}</h1>
  <Card>
    <CardContent>
      <div className="flex items-center gap-4 text-sm">
        <span><FileText /> {imagesFound} images</span>
        {graphsDetected > 0 && <span><Image /> {graphsDetected} graphs</span>}
        {tablesFound > 0 && <span><Database /> {tablesFound} tables</span>}
        <span>· {processingTimeMs}ms</span>
      </div>
    </CardContent>
  </Card>
</div>
```

2. **Tab Navigation**:
```tsx
<div className="border-b">
  <Button 
    variant={activeTab === 'markdown' ? 'default' : 'ghost'}
    onClick={() => setActiveTab('markdown')}
  >
    <FileText /> Markdown
  </Button>
  <Button 
    variant={activeTab === 'tables' ? 'default' : 'ghost'}
    onClick={() => setActiveTab('tables')}
  >
    <Database /> Tables ({tablesFound})
  </Button>
  <Button 
    variant={activeTab === 'graphs' ? 'default' : 'ghost'}
    onClick={() => setActiveTab('graphs')}
  >
    <BarChart3 /> Graphs ({graphsDetected})
  </Button>
  <Button 
    variant={activeTab === 'data' ? 'default' : 'ghost'}
    onClick={() => setActiveTab('data')}
  >
    <Code /> Data
  </Button>
</div>
```

3. **Markdown Tab Content**:
```tsx
{activeTab === 'markdown' && (
  <>
    {/* View Toggle */}
    <div className="flex gap-2 mb-4">
      <Button 
        variant={markdownView === 'rendered' ? 'default' : 'outline'}
        onClick={() => setMarkdownView('rendered')}
      >
        <Eye /> Rendered
      </Button>
      <Button 
        variant={markdownView === 'source' ? 'default' : 'outline'}
        onClick={() => setMarkdownView('source')}
      >
        <Code /> Source
      </Button>
      <Button onClick={() => downloadBlob(markdownBlob, `${fileName}.md`)}>
        <Download /> Download
      </Button>
    </div>

    {/* Rendered View */}
    {markdownView === 'rendered' && (
      <div className="prose max-w-none">
        <ReactMarkdown 
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight, rehypeRaw]}
        >
          {markdownContent}
        </ReactMarkdown>
      </div>
    )}

    {/* Source View */}
    {markdownView === 'source' && (
      <SyntaxHighlighter 
        language="markdown" 
        style={vscDarkPlus}
        showLineNumbers
      >
        {markdownContent}
      </SyntaxHighlighter>
    )}
  </>
)}
```

4. **Tables Tab Content**:
```tsx
{activeTab === 'tables' && (
  <>
    {tables && tables.length > 0 ? (
      <div className="space-y-6">
        {tables.map((table, idx) => (
          <Card key={idx}>
            <CardHeader>
              <CardTitle>Table {table.index}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-50">
                      {table.headers.map((header, i) => (
                        <th key={i} className="border p-2 text-left">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {table.rows.map((row, rowIdx) => (
                      <tr key={rowIdx}>
                        {row.map((cell, cellIdx) => (
                          <td key={cellIdx} className="border p-2">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Markdown Source */}
              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-gray-600">
                  View Markdown Source
                </summary>
                <SyntaxHighlighter language="markdown" style={vscDarkPlus}>
                  {table.rawMarkdown}
                </SyntaxHighlighter>
              </details>
            </CardContent>
          </Card>
        ))}
      </div>
    ) : (
      <div className="text-center py-12">
        <Database className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">No tables found in this document</p>
      </div>
    )}
  </>
)}
```

5. **Graphs Tab Content**:
```tsx
{activeTab === 'graphs' && (
  <>
    {allImages.length > 0 ? (
      <div className="space-y-6">
        {allImages.map(([imageName, imageData], idx) => {
          const gptAnalysis = gptAnalysisMap.get(imageName)
          
          return (
            <Card key={idx}>
              <CardHeader>
                <CardTitle>{imageName}</CardTitle>
                {gptAnalysis?.graphType && (
                  <Badge>{gptAnalysis.graphType}</Badge>
                )}
              </CardHeader>
              <CardContent>
                {/* Zoomable Image */}
                <TransformWrapper>
                  {({ zoomIn, zoomOut, resetTransform }) => (
                    <>
                      <div className="flex gap-2 mb-2">
                        <Button size="sm" onClick={() => zoomIn()}>
                          <ZoomIn /> Zoom In
                        </Button>
                        <Button size="sm" onClick={() => zoomOut()}>
                          <ZoomOut /> Zoom Out
                        </Button>
                        <Button size="sm" onClick={() => resetTransform()}>
                          <Undo2 /> Reset
                        </Button>
                      </div>
                      <TransformComponent>
                        <img 
                          src={typeof imageData === 'string' ? imageData : imageData} 
                          alt={imageName}
                          className="max-w-full border"
                        />
                      </TransformComponent>
                    </>
                  )}
                </TransformWrapper>

                {/* GPT Analysis */}
                {gptAnalysis?.isGraph && (
                  <div className="mt-4 space-y-4">
                    {/* Analysis */}
                    {gptAnalysis.reason && (
                      <div>
                        <h4 className="font-semibold">Analysis:</h4>
                        <p className="text-sm text-gray-700">{gptAnalysis.reason}</p>
                      </div>
                    )}

                    {/* Extracted Data */}
                    {gptAnalysis.data && (
                      <div>
                        <h4 className="font-semibold">Extracted Data:</h4>
                        <SyntaxHighlighter language="json" style={vscDarkPlus}>
                          {JSON.stringify(gptAnalysis.data, null, 2)}
                        </SyntaxHighlighter>
                      </div>
                    )}

                    {/* Python Code */}
                    {gptAnalysis.pythonCode && (
                      <div>
                        <h4 className="font-semibold">Python Reconstruction Code:</h4>
                        <SyntaxHighlighter language="python" style={vscDarkPlus}>
                          {gptAnalysis.pythonCode}
                        </SyntaxHighlighter>
                        
                        {/* NEW: Render Button */}
                        <Button 
                          onClick={() => handleRenderGraph(imageName, gptAnalysis.pythonCode!)}
                          disabled={renderingGraph === imageName}
                        >
                          {renderingGraph === imageName 
                            ? 'Rendering...' 
                            : renderedGraphs.has(imageName)
                              ? 'Re-render Graph'
                              : 'Render Graph in Browser'}
                        </Button>
                        
                        {/* NEW: Loading Message */}
                        {renderingGraph === imageName && !isPyodideInitialized && (
                          <p className="text-xs text-blue-600">
                            {pyodideInitMessage}
                            <br/>
                            This only happens once per session. Subsequent renders will be instant.
                          </p>
                        )}
                      </div>
                    )}
                    
                    {/* NEW: Rendered Graph Display */}
                    {renderedGraphs.has(imageName) && (
                      <div className="bg-gradient-to-br from-purple-50 to-blue-50 border-2 border-purple-200 rounded-lg p-4">
                        <h4 className="font-medium text-purple-900">AI-Reconstructed Graph</h4>
                        <span className="text-xs bg-purple-100 px-2 py-1 rounded">Rendered by Pyodide</span>
                        
                        {/* Zoomable Rendered Image */}
                        <TransformWrapper>
                          {({ zoomIn, zoomOut, resetTransform }) => (
                            <>
                              <div className="flex gap-2">
                                <Button onClick={() => zoomIn()}>Zoom In</Button>
                                <Button onClick={() => zoomOut()}>Zoom Out</Button>
                                <Button onClick={() => resetTransform()}>Reset</Button>
                              </div>
                              <TransformComponent>
                                <img src={renderedGraphs.get(imageName)} alt="Rendered graph" />
                              </TransformComponent>
                            </>
                          )}
                        </TransformWrapper>
                        
                        <p className="text-xs text-purple-600 mt-2">
                          This graph was reconstructed from GPT-extracted data using Python and matplotlib. 
                          Compare with the original image above to verify accuracy.
                        </p>
                      </div>
                    )}
                    
                    {/* NEW: Render Error Display */}
                    {renderErrors.has(imageName) && (
                      <div className="bg-red-50 p-3 rounded">
                        <h4 className="font-medium text-red-900">Rendering Error</h4>
                        <p className="text-sm text-red-700">{renderErrors.get(imageName)}</p>
                        <p className="text-xs text-red-600 mt-2">
                          The Python code may have errors. You can still download and run it locally.
                        </p>
                      </div>
                    )}

                    {/* Assumptions */}
                    {gptAnalysis.assumptions && (
                      <div className="bg-yellow-50 p-3 rounded border border-yellow-200">
                        <h4 className="font-semibold text-yellow-900">Assumptions:</h4>
                        <p className="text-sm text-yellow-800">{gptAnalysis.assumptions}</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    ) : (
      <div className="text-center py-12">
        <ImageIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">No graphs detected in this document</p>
        <p className="text-sm text-gray-500 mt-2">
          Try re-extracting with "Enable graph detection" enabled
        </p>
      </div>
    )}
  </>
)}
```

6. **Data Tab Content**:
```tsx
{activeTab === 'data' && (
  <>
    {/* Data View Selector */}
    <div className="flex gap-2 mb-4">
      <Button 
        variant={selectedDataView === 'original' ? 'default' : 'outline'}
        onClick={() => setSelectedDataView('original')}
      >
        Original Images
      </Button>
      <Button 
        variant={selectedDataView === 'response' ? 'default' : 'outline'}
        onClick={() => setSelectedDataView('response')}
      >
        Full Response
      </Button>
      {graphifyData && (
        <Button 
          variant={selectedDataView === 'gpt' ? 'default' : 'outline'}
          onClick={() => setSelectedDataView('gpt')}
        >
          GPT Analysis
        </Button>
      )}
    </div>

    {/* JSON Display with Syntax Highlighting */}
    {selectedDataView === 'original' && originalImages && (
      <>
        <Button onClick={() => downloadBlob(originalImagesBlob, `${fileName}-original-images.json`)}>
          <Download /> Download
        </Button>
        <SyntaxHighlighter language="json" style={vscDarkPlus} showLineNumbers>
          {JSON.stringify(originalImages, null, 2)}
        </SyntaxHighlighter>
      </>
    )}

    {selectedDataView === 'response' && responseJson && (
      <>
        <Button onClick={() => downloadBlob(responseJsonBlob, `${fileName}-response.json`)}>
          <Download /> Download
        </Button>
        <SyntaxHighlighter language="json" style={vscDarkPlus} showLineNumbers>
          {JSON.stringify(responseJson, null, 2)}
        </SyntaxHighlighter>
      </>
    )}

    {selectedDataView === 'gpt' && graphifyData && (
      <>
        <Button onClick={() => downloadBlob(graphifyJsonBlob, `${fileName}-gpt-analysis.json`)}>
          <Download /> Download
        </Button>
        <SyntaxHighlighter language="json" style={vscDarkPlus} showLineNumbers>
          {JSON.stringify(graphifyData, null, 2)}
        </SyntaxHighlighter>
      </>
    )}
  </>
)}
```

**Helper Functions**:
```typescript
// NEW: Handle rendering a graph with Pyodide
const handleRenderGraph = async (imageName: string, pythonCode: string) => {
  setRenderingGraph(imageName)
  setPyodideInitMessage('Initializing Python environment (first time: ~10-15 seconds)...')

  try {
    // Initialize Pyodide if needed (expensive first time, instant after)
    if (!isPyodideInitialized) {
      await pyodideRenderer.initialize()
      setIsPyodideInitialized(true)
      setPyodideInitMessage('Python environment ready')
    }

    // Render the graph
    const renderResult = await pyodideRenderer.renderGraph(pythonCode)

    if (renderResult.success && renderResult.imageDataUrl) {
      setRenderedGraphs(prev => new Map(prev).set(imageName, renderResult.imageDataUrl!))
      setRenderErrors(prev => {
        const newMap = new Map(prev)
        newMap.delete(imageName)
        return newMap
      })
    } else {
      throw new Error(renderResult.error || 'Rendering failed')
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown rendering error'
    setRenderErrors(prev => new Map(prev).set(imageName, errorMessage))
  } finally {
    setRenderingGraph(null)
  }
}

// Extract tables from markdown
function extractTablesFromMarkdown(markdown: string): TableData[] {
  const processor = unified().use(remarkParse).use(remarkGfm)
  const tree = processor.parse(markdown)
  const tables: TableData[] = []

  visit(tree, 'table', (node) => {
    const tableNode = node as MdastTable
    const rows = (tableNode.children || []) as MdastTableRow[]
    
    // Extract headers and data rows
    const headers = /* extract from first row */
    const dataRows = /* extract from remaining rows */
    const rawMarkdown = buildMarkdownFromTable(headers, dataRows)

    tables.push({
      index: tables.length + 1,
      headers,
      rows: dataRows,
      rawMarkdown
    })
  })

  return tables
}

// Convert Blob to text
const blobToText = async (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsText(blob)
  })
}
```

**Data Loading (useEffect)**:
```typescript
React.useEffect(() => {
  const loadData = async () => {
    // Load original images JSON
    if (result.originalImagesBlob) {
      const text = await blobToText(result.originalImagesBlob)
      setOriginalImages(JSON.parse(text))
    }

    // Load full response JSON
    if (result.responseJsonBlob) {
      const text = await blobToText(result.responseJsonBlob)
      setResponseJson(JSON.parse(text))
    } else if (result.responseJson) {
      setResponseJson(result.responseJson)
    }

    // Load GPT analysis
    if (result.graphifyResults?.graphifyJsonBlob) {
      const text = await blobToText(result.graphifyResults.graphifyJsonBlob)
      setGraphifyData(JSON.parse(text))
    } else if (result.graphifyResults?.summary) {
      setGraphifyData(result.graphifyResults.summary)
    }
  }

  loadData()
}, [result])

React.useEffect(() => {
  const loadTables = async () => {
    // Try parsing from tables blob if available
    if (result.tablesBlob) {
      const text = await blobToText(result.tablesBlob)
      const parsed = JSON.parse(text)
      const normalized = normalizeTablesFromJson(parsed)
      if (normalized.length > 0) {
        setTables(normalized)
        return
      }
    }

    // Otherwise extract from markdown
    if (result.markdownContent) {
      const parsedTables = extractTablesFromMarkdown(result.markdownContent)
      setTables(parsedTables)
    }
  }

  loadTables()
}, [result.tablesBlob, result.markdownContent])
```

---

## Type System

**File**: `src/types/extraction.ts`

### Core Interfaces

```typescript
export interface PDFExtractionResult {
  success: boolean
  jobId?: string
  markdownContent?: string
  markdownBlob?: Blob
  responseJson?: Record<string, unknown>
  responseJsonBlob?: Blob
  originalImagesBlob?: Blob
  tablesBlob?: Blob  // New: Parsed tables data
  graphifyResults?: {
    summary: GraphifyResult[]
    graphifyJsonBlob?: Blob
  }
  stats?: ExtractionStats
  message?: string
}

export interface ExtractionOptions {
  enableGraphify?: boolean  // Default: true
  forceOCR?: boolean        // Default: false
  maxGraphifyImages?: number // Default: 10
}

export interface GraphifyResult {
  imageName: string
  isGraph: boolean
  graphType?: string         // e.g., "line chart", "bar chart"
  reason?: string            // Why it is/isn't a graph
  pythonCode?: string        // Matplotlib code to recreate
  data?: Record<string, unknown>  // Extracted numeric data
  assumptions?: string       // Notes on data accuracy
  error?: string             // If processing failed
  // NEW: Pyodide rendering fields
  renderedImage?: string     // Base64 data URL of rendered graph
  renderError?: string       // Error if rendering failed
  renderTimeMs?: number      // Execution time for debugging
}

export interface ExtractionStats {
  imagesFound: number
  graphsDetected: number
  processingTimeMs: number
  tablesFound?: number  // New: Number of tables detected
}

export interface TableData {
  index: number
  headers: string[]
  rows: string[][]
  rawMarkdown: string
}
```

### Backend-Specific Types

```typescript
export interface DatalabJobSubmission {
  success: boolean
  request_id?: string
  request_check_url?: string
  error?: string
}

export interface DatalabJobStatus {
  success: boolean
  status: 'pending' | 'processing' | 'complete' | 'failed'
  markdown?: string
  images?: Record<string, unknown>
  error?: string
  [key: string]: unknown
}

export interface GPTVisionResponse {
  is_graph: boolean
  graph_type?: string
  reason?: string
  data?: Record<string, unknown>
  python_code?: string
  assumptions?: string
}
```

---

## API Specification

### Endpoint: POST /api/extract-pdf-content

**Configuration**:
```typescript
export const config = {
  api: {
    bodyParser: false,  // Required for multipart file uploads
  },
}

// Vercel function settings (vercel.json)
{
  "functions": {
    "api/extract-pdf-content.ts": {
      "maxDuration": 300  // 5 minutes
    }
  }
}
```

**Request**:
```http
POST /api/extract-pdf-content
Content-Type: multipart/form-data

Fields:
- file: PDF file (binary)
- enableGraphify: "true" | "false"
- forceOCR: "true" | "false"
- maxGraphifyImages: "1" to "20"
```

**Response (Success - 200)**:
```json
{
  "success": true,
  "jobId": "job-abc123",
  "markdown": "# Document Title\n\n## Abstract\nContent...",
  "markdownBlob": "base64-encoded-markdown-string",
  "responseJson": {
    "success": true,
    "status": "complete",
    "markdown": "...",
    "images": {
      "figure1.png": "base64-image-data",
      "figure2.png": "base64-image-data"
    }
  },
  "responseJsonBlob": "base64-encoded-json-string",
  "originalImagesBlob": "base64-encoded-images-json-string",
  "graphifyResults": {
    "summary": [
      {
        "imageName": "figure1.png",
        "isGraph": true,
        "graphType": "line chart",
        "reason": "Shows time-series data with trend lines",
        "pythonCode": "import matplotlib.pyplot as plt\n\ndef recreate_plot(output_path: str):\n    x = [0, 1, 2, 3, 4]\n    y = [10, 15, 13, 17, 20]\n    plt.figure(figsize=(8, 6))\n    plt.plot(x, y, 'o-', linewidth=2)\n    plt.xlabel('Time')\n    plt.ylabel('Value')\n    plt.title('Sample Chart')\n    plt.savefig(output_path)\n    plt.close()",
        "data": {
          "x": [0, 1, 2, 3, 4],
          "y": [10, 15, 13, 17, 20]
        },
        "assumptions": "Y-axis values estimated from pixel positions"
      },
      {
        "imageName": "photo1.jpg",
        "isGraph": false,
        "reason": "This is a photograph, not a data visualization"
      }
    ],
    "graphifyJsonBlob": "base64-encoded-graphify-json"
  },
  "stats": {
    "imagesFound": 2,
    "graphsDetected": 1,
    "processingTimeMs": 45000
  },
  "message": "Successfully extracted content from PDF with 1 graph(s) detected"
}
```

**Response (Error - 500)**:
```json
{
  "success": false,
  "error": "Extraction failed",
  "message": "Datalab API error: Invalid PDF format",
  "stats": {
    "imagesFound": 0,
    "graphsDetected": 0,
    "processingTimeMs": 3000
  }
}
```

---

## External API Integration

### Datalab Marker API

**Purpose**: PDF to Markdown conversion with image extraction

**Endpoint**: `https://www.datalab.to/api/v1/marker`

**Authentication**: `X-Api-Key` header

**Request Flow**:
1. Submit PDF with parameters
2. Receive `request_check_url`
3. Poll status endpoint every 2 seconds
4. Receive markdown and images when complete

**Parameters**:
- `file`: PDF file (multipart)
- `output_format`: "markdown"
- `force_ocr`: true/false
- `paginate`: true/false
- `disable_image_extraction`: true/false

**Response Fields**:
- `success`: boolean
- `status`: "pending" | "processing" | "complete" | "failed"
- `markdown`: extracted text content
- `images`: object with base64-encoded images
- `request_id`: job identifier
- `request_check_url`: polling endpoint

**Rate Limits**: Based on account tier

**Pricing**: ~$0.10 per PDF (varies by complexity)

### OpenAI GPT Vision API

**Purpose**: Intelligent graph detection and data extraction

**Endpoint**: `https://api.openai.com/v1/chat/completions`

**Authentication**: Bearer token

**Model Used**: `gpt-4o-mini` (default, configurable via GPT_MODEL env var)

**Request**:
```json
{
  "model": "gpt-4o-mini",
  "temperature": 1,
  "response_format": { "type": "json_object" },
  "messages": [
    {
      "role": "system",
      "content": "You convert static images of figures into approximate datasets and minimal plotting code. When data is ambiguous, make reasonable numeric approximations and note them in assumptions."
    },
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "You are a scientific figure analyzer. Determine if this image is a data visualization (graph/chart/plot).\n\nIf yes, extract approximate numeric data and produce Python code to reconstruct it.\n\nReturn ONLY a JSON object with these keys:\n- is_graph (boolean): true if this is a graph/chart/plot\n- graph_type (string): type of graph (e.g., \"line chart\", \"bar chart\", \"scatter plot\")\n- reason (string): brief explanation\n- data (object): extracted numeric data with arrays/series\n- python_code (string): Python function recreate_plot(output_path: str) using matplotlib\n- assumptions (string): any assumptions made about ambiguous data\n\nRules:\n- Use simple lists for data (not dataframes)\n- Include title/axes/legend when inferable\n- Make code self-contained (no external files)\n- Use Agg backend for matplotlib\n- If not a graph, set is_graph to false and omit other fields"
        },
        {
          "type": "image_url",
          "image_url": {
            "url": "data:image/png;base64,iVBORw0KGgo..."
          }
        }
      ]
    }
  ]
}
```

**Response**:
```json
{
  "is_graph": true,
  "graph_type": "line chart",
  "reason": "Shows time-series progression with multiple data series",
  "data": {
    "x_values": [0, 1, 2, 3, 4],
    "series_1": [10, 15, 13, 17, 20],
    "series_2": [8, 11, 14, 12, 15]
  },
  "python_code": "import matplotlib.pyplot as plt\nimport matplotlib\nmatplotlib.use('Agg')\n\ndef recreate_plot(output_path: str):\n    # Code here",
  "assumptions": "Data points estimated from visual inspection. Exact values may vary by ±5%"
}
```

**Pricing**: ~$0.01 per 5 images (gpt-4o-mini rates)

---

## Environment Variables

### Required Variables

**For Production (Vercel Dashboard)**:
```bash
DATALAB_API_KEY=dla-your-datalab-api-key
```

**Optional Variables**:
```bash
OPENAI_API_KEY=sk-your-openai-api-key  # For graph detection
GPT_MODEL=gpt-4o-mini                  # Model name (default: gpt-4o-mini)
OPENAI_API_BASE=https://api.openai.com/v1  # API base URL (optional)
```

**For Local Development (.env)**:
```bash
# Copy all the above, plus:
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
ANTHROPIC_API_KEY=...
GOOGLE_GEMINI_API_KEY=...
```

### Environment Variable Behavior

| Variable | Required | Default | Impact if Missing |
|----------|----------|---------|-------------------|
| `DATALAB_API_KEY` | Yes | None | Extraction fails completely |
| `OPENAI_API_KEY` | No | None | Graph detection skipped, markdown still works |
| `GPT_MODEL` | No | gpt-4o-mini | Uses default model |
| `OPENAI_API_BASE` | No | api.openai.com | Uses default OpenAI endpoint |

---

## Performance Characteristics

### Processing Times

| PDF Type | Pages | Images | Typical Time | Max Time |
|----------|-------|--------|--------------|----------|
| Text-only | 5 | 0 | 20-30s | 1 min |
| Research paper | 10 | 3 charts | 45-75s | 2 min |
| Large document | 30 | 10 images | 2-3 min | 4 min |
| Very large | 50+ | 20+ images | 3-5 min | Timeout |

**Timeout**: 5 minutes (configurable in vercel.json)

### Processing Breakdown

1. **File Upload**: <1 second
2. **Datalab Processing**: 20-60 seconds (depends on PDF complexity)
3. **Image Extraction**: Included in Datalab time
4. **GPT Vision** (per image): 5-10 seconds
5. **Concurrent Processing**: 3 images at a time
6. **Base64 Encoding**: <1 second
7. **Response Formation**: <1 second

**Example Timeline** (10-page paper, 5 images, graphify enabled):
- 0:00 - Upload starts
- 0:01 - Datalab job submitted
- 0:30 - Datalab completes, images extracted
- 0:35 - GPT processes image 1-3
- 0:45 - GPT processes image 4-5
- 0:50 - Results aggregated and returned

### Optimization Strategies

**Reduce Processing Time**:
- Disable graphify for text-only PDFs
- Reduce maxGraphifyImages for faster results
- Use smaller PDFs when possible

**Reduce Cost**:
- Set maxGraphifyImages to 5 instead of 10
- Toggle off graphify when not needed
- Future: Cache results in Supabase

**Improve Accuracy**:
- Enable forceOCR for scanned documents
- Use higher quality PDFs
- Increase maxGraphifyImages for documents with many charts

---

## Cost Analysis

### Per Extraction Costs

**Datalab Marker API**:
- Typical: $0.10 per PDF
- Range: $0.05 - $0.20 (depends on pages and complexity)
- Billed per page processed

**OpenAI GPT Vision (gpt-4o-mini)**:
- Input: $0.15 per 1M tokens
- Output: $0.60 per 1M tokens
- Per image: ~$0.002
- 5 images: ~$0.01

**Total Per Extraction**:
- Text-only PDF: ~$0.10 (no GPT)
- PDF with images (graphify off): ~$0.10 (no GPT)
- PDF with 5 images (graphify on): ~$0.11
- PDF with 10 images (graphify on): ~$0.12

### Monthly Cost Estimates

| Usage | Datalab | GPT Vision | Total |
|-------|---------|------------|-------|
| 50 PDFs/month (avg 5 images) | $5.00 | $0.50 | **$5.50** |
| 100 PDFs/month (avg 5 images) | $10.00 | $1.00 | **$11.00** |
| 500 PDFs/month (avg 5 images) | $50.00 | $5.00 | **$55.00** |

### Cost Optimization Options

**Immediate**:
- Set `maxGraphifyImages: 5` → 50% GPT cost reduction
- Toggle off graphify by default → 90% GPT cost reduction
- User-controlled options → Let users choose cost/feature tradeoff

**Future** (with caching):
- Store results in Supabase with 30-day TTL
- Hash PDFs to detect duplicates
- Estimated 80% cache hit rate
- Monthly cost reduction: ~$40 for 500 PDFs

---

## Error Handling

### Frontend Error Handling

```typescript
try {
  const result = await PDFExtractionService.extractContent(file, options)
  if (result.success) {
    // Show success UI
  } else {
    // Show error message
  }
} catch (error) {
  // Network or unexpected errors
  setExtractionResult({
    success: false,
    message: error.message || 'Failed to extract PDF content'
  })
}
```

### Backend Error Handling

**File Validation**:
```typescript
if (fileBuffer.length > MAX_FILE_SIZE) {
  throw new Error(`File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`)
}

if (!uploadedFile) {
  throw new Error('No file uploaded')
}
```

**API Errors**:
```typescript
// Datalab API error
if (!response.ok || !data.success) {
  const errorMessage = data.error || data.message || data.detail
  throw new Error(`Datalab API error: ${errorMessage}`)
}

// Timeout
if (Date.now() - startTime > timeout) {
  throw new Error('Datalab job timed out')
}

// GPT Vision error (non-fatal)
try {
  const graphResult = await processImageWithGPT(image)
} catch (error) {
  // Log error but continue processing other images
  return { imageName, isGraph: false, error: error.message }
}
```

### User-Facing Error Messages

| Backend Error | User Sees | Recovery |
|---------------|-----------|----------|
| "Datalab API key not configured" | "Service temporarily unavailable" | Contact admin |
| "File size exceeds 50MB limit" | "File size exceeds 50MB limit" | Use smaller PDF |
| "Datalab job timed out" | "Processing took too long. Try a smaller PDF." | Retry with smaller file |
| "Invalid PDF format" | "Failed to extract content: Invalid PDF format" | Try different PDF |
| "GPT Vision API error" | Partial success - markdown available, no graph analysis | Still get markdown |
| Network error | "Failed to extract PDF content. Please try again." | Retry |

---

## Deployment

### Vercel Configuration

**File**: `vercel.json`

```json
{
  "functions": {
    "api/extract-pdf-content.ts": {
      "maxDuration": 300
    }
  }
}
```

**Notes**:
- 300 seconds = 5 minutes (sufficient for most PDFs)
- Can increase to 600 (10 min) on Vercel Pro plan
- Longer timeouts cost more in function execution time

### Environment Setup

**Vercel Dashboard Steps**:
1. Go to Settings → Environment Variables
2. Add `DATALAB_API_KEY` (required)
3. Add `OPENAI_API_KEY` (optional but recommended)
4. Set for: Production, Preview, Development
5. Redeploy to apply changes

**Local Development**:
```bash
# Create .env file
DATALAB_API_KEY=your_key
OPENAI_API_KEY=your_key

# Run with Vercel dev server
vercel dev

# Visit http://localhost:3000
```

### Dependencies

**Backend (Production)**:
```json
{
  "formidable": "^3.5.1",  // Multipart form parsing
  "undici": "^6.0.0"       // Modern fetch + FormData support
}
```

**Frontend (Production)**:
```json
{
  "react-markdown": "^9.0.0",  // Markdown rendering
  "remark-gfm": "^4.0.0",  // GitHub Flavored Markdown
  "remark-parse": "^11.0.0",  // Markdown parser
  "rehype-highlight": "^7.0.0",  // Code highlighting
  "rehype-raw": "^7.0.0",  // HTML in markdown
  "unified": "^11.0.0",  // Parsing pipeline
  "unist-util-visit": "^5.0.0",  // AST traversal
  "mdast-util-to-string": "^4.0.0",  // AST to string
  "react-syntax-highlighter": "^15.5.0",  // Code/JSON syntax highlighting
  "@types/react-syntax-highlighter": "^15.5.0",  // TypeScript types
  "react-zoom-pan-pinch": "^3.0.0",  // Image zoom/pan controls
  "highlight.js": "^11.9.0",  // Syntax highlighting styles
  "pyodide": "^0.29.0"  // NEW: WebAssembly Python runtime for browser-based rendering
}
```

**Development**:
```json
{
  "vitest": "^4.0.4",
  "@testing-library/react": "latest",
  "@testing-library/user-event": "latest",
  "@types/mdast": "^4.0.0"  // Markdown AST types
}
```

---

## Testing

### Test Coverage

**Total Tests**: 118 (all passing)

**Backend Tests** (`api/__tests__/extract-pdf-content.test.ts`): 51 tests
- CORS and method handling
- Environment variable validation
- File upload validation
- Datalab API integration
- Polling logic
- GPT Vision integration
- Response formation
- Base64 encoding
- Error handling

**Frontend Component Tests** (`src/components/PDFExtraction.test.tsx`): 35 tests
- Component rendering
- File selection and validation
- Service integration
- Success/error cases
- Download functionality
- Reset functionality
- Edge cases

**Enhanced Feature Tests** (`src/components/PDFExtraction.enhanced.test.tsx`): 32 tests
- Options UI (toggle, slider)
- Download buttons (all 3 types)
- Stats display
- Graph detection summary
- User experience flows
- Accessibility

### Running Tests

```bash
# All tests
npm run test:run

# Watch mode
npm test

# Specific file
npm test PDFExtraction

# Backend tests only
npm test api/__tests__

# Frontend tests only
npm test src/components/PDF
```

### Test Data

**Sample PDFs for Testing**:
- Text-only (5 pages, no images)
- Research paper (10-15 pages, 3-5 charts)
- Large document (30+ pages, 10+ images)
- Scanned document (requires OCR)
- Invalid/corrupted PDF (error testing)

---

## Security Considerations

### API Key Protection

**Server-Side Only**:
```typescript
// Backend can access
const apiKey = process.env.DATALAB_API_KEY

// Frontend CANNOT access
// Keys never exposed to client
```

**Environment Variables**:
- Stored in Vercel dashboard
- Injected at runtime
- Never committed to git
- Separate for development/production

### File Upload Security

**Validation**:
```typescript
// File type
if (uploadedFile.mimetype !== 'application/pdf') {
  throw new Error('Only PDF files allowed')
}

// File size
if (fileBuffer.length > 50 * 1024 * 1024) {
  throw new Error('File size exceeds 50MB limit')
}

// Temp file cleanup
await fs.promises.unlink(uploadedFile.filepath)
```

**Sanitization**:
- Filename sanitized before use
- No file execution
- Temp files cleaned up immediately
- No persistent storage

### CORS Configuration

```json
{
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Access-Control-Allow-Origin",
          "value": "*"
        },
        {
          "key": "Access-Control-Allow-Methods",
          "value": "GET, POST, PUT, DELETE, OPTIONS"
        }
      ]
    }
  ]
}
```

---

## Monitoring and Logging

### Server-Side Logging

**File**: `api/extract-pdf-content.ts`

**Log Levels**:

```typescript
// Info logs
console.log('Environment check:')
console.log('Parsing multipart form data...')
console.log('Received file:', fileName, bytes)
console.log('Job submitted. ID:', jobId)
console.log('Polling for completion...')
console.log('Job complete!')
console.log('Extraction complete in', timeMs, 'ms')

// Error logs
console.error('Datalab API error:', error)
console.error('GPT Vision error:', error)
console.error('Error in extract-pdf-content:', error)
```

**Monitoring Points**:
1. Request received
2. File parsed
3. Datalab submission
4. Polling progress
5. Image processing
6. Completion/failure

### Vercel Function Logs

**Access**: Vercel Dashboard → Functions → extract-pdf-content → Logs

**Key Metrics**:
- Function invocations
- Average duration
- Error rate
- Memory usage
- Timeout occurrences

### Frontend Logging

```typescript
console.log('Uploading PDF to extraction API...', {
  fileName,
  fileSize,
  options
})

console.log('Extraction API response:', data)

console.error('Error in PDFExtractionService:', error)
```

---

## Use Cases

### Research Paper Analysis (Enhanced)
**Scenario**: Extract and deeply analyze content from published research papers

**Workflow**:
1. Upload journal article PDF with drag & drop
2. Enable graphify to detect data charts
3. Click "View Comprehensive Analysis" button
4. Navigate through tabbed interface:
   - Read formatted paper in Markdown tab
   - Review extracted tables in Tables tab
   - Zoom into figures and read AI analysis in Graphs tab
   - Download specific data sets from Data tab
5. Copy Python code to recreate key figures
6. Download markdown or JSON for further processing

**Benefit**: Zero-friction from upload to deep insights with interactive exploration

### Clinical Trial Reports (Enhanced)
**Scenario**: Extract and analyze data from clinical study reports

**Workflow**:
1. Upload clinical trial document
2. Open Analysis View immediately after extraction
3. Review all efficacy tables in Tables tab
4. Examine safety data visualizations in Graphs tab with zoom
5. Toggle between rendered and source markdown to verify accuracy
6. Download structured JSON for programmatic analysis
7. Export specific tables or all data as needed

**Benefit**: Comprehensive structured data extraction with interactive verification

### Literature Review with Table Extraction
**Scenario**: Process multiple research papers and extract comparative data

**Workflow**:
1. Upload papers one by one
2. For each paper, open Analysis View
3. Extract tables showing study parameters and results
4. Copy markdown or download JSON for each table
5. Aggregate graph data from GPT analyses across papers
6. Build comprehensive literature database with structured tables
7. Compare data points side-by-side

**Benefit**: Systematic extraction with table parsing for meta-analysis

### Data Extraction from Legacy Documents
**Scenario**: Digitize old scanned papers

**Workflow**:
1. Upload scanned PDF
2. Enable forceOCR option (currently hardcoded to false, but can be enabled)
3. Extract text despite poor scan quality
4. Use Analysis View to verify extraction quality:
   - Check rendered vs source markdown for OCR errors
   - Zoom into extracted images to verify clarity
   - Review tables for formatting issues
5. Manually correct important data points
6. Download corrected markdown

**Benefit**: Preserve and digitize historical research with verification tools

### Interactive Paper Presentation
**Scenario**: Present research findings with live data exploration

**Workflow**:
1. Extract paper before presentation
2. During presentation, open Analysis View
3. Navigate between rendered paper and specific figures
4. Zoom into graphs to highlight key data points
5. Show Python reconstruction code for reproducibility
6. Switch to source view to show markdown structure
7. Demonstrate table data in structured format

**Benefit**: Interactive, professional presentation with live data exploration

---

## Limitations and Constraints

### Technical Limitations

1. **File Size**: Maximum 50MB per PDF
2. **Processing Time**: Maximum 5 minutes (Vercel timeout)
3. **Image Limit**: Maximum 20 images processed for graph detection
4. **Python Execution**: Code generated but NOT executed server-side
5. **OCR Accuracy**: Depends on source PDF quality

### Known Issues

1. **Scanned PDFs**: May require forceOCR for accurate extraction (currently hardcoded to `false` in component)
2. **Complex Layouts**: Multi-column or unusual layouts may have formatting issues
3. **Equations**: LaTeX equations may not render perfectly in markdown
4. **Tables**: Complex tables may lose formatting or require manual correction
5. **Graph Data Accuracy**: Extracted data is approximate (pixel-based estimation)
6. **Table Detection**: Frontend-based table parsing may miss tables with unusual markdown formatting
7. **NEW - Pyodide Initialization**: First graph render takes 10-15 seconds to load Python environment
8. **NEW - Mobile Performance**: Pyodide rendering may be slow on low-end mobile devices
9. **NEW - Python Code Execution**: Only executes in browser sandbox, no external files/network access
10. **NEW - Matplotlib Limitations**: Advanced matplotlib features may not be supported in Pyodide

### Not Supported

- Excel/Word document conversion (PDF only)
- ~~Executing generated Python code (security constraint)~~ ✅ **NOW SUPPORTED** via Pyodide (browser-based)
- Real-time streaming of results (batch processing only)
- Concurrent multi-file uploads (one at a time)
- PDF editing or annotation
- Dynamic forceOCR toggle in UI (hardcoded to false currently)
- Python code with external dependencies not in Pyodide (limited to matplotlib, numpy, etc.)
- Server-side Python execution (security constraint, but browser execution works)

---

## Future Enhancements

### Recently Implemented ✅

1. **Markdown Preview** ✅ (Implemented in Paper Analysis View)
- Display extracted content in UI before download
- Syntax highlighting for code blocks
- Toggle between rendered and source views

2. **Graph Viewer** ✅ (Implemented in Paper Analysis View)
- Show detected graphs visually with original images
- Zoom/pan controls for detailed viewing
- Preview Python code with syntax highlighting
- View extracted data and AI analysis

3. **Table Extraction** ✅ (Implemented)
- Frontend-based table parsing from markdown
- Structured table display with headers and rows
- Export as JSON

4. **Pyodide Graph Rendering** ✅ **NEW** (November 2025)
- Execute Python matplotlib code directly in browser
- WebAssembly-based Python runtime (Pyodide v0.29.0)
- No local Python installation required
- One-click graph rendering from GPT-generated code
- Compare original vs AI-reconstructed graphs
- Visual verification of data extraction accuracy
- First load: ~10-15 seconds, subsequent: < 1 second
- Cached across session for instant re-renders

### Phase 2 (Short-term)

1. **Result Caching**:
```sql
CREATE TABLE pdf_extraction_cache (
  id UUID PRIMARY KEY,
  file_hash TEXT UNIQUE,
  markdown TEXT,
  response_json JSONB,
  graphify_results JSONB,
  tables JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days'
);
```

2. **Enhanced Table Features**:
- CSV/Excel export from tables
- Table search and filtering
- Sort by column
- Column hiding/reordering

3. **forceOCR UI Toggle**:
- Add checkbox to enable/disable OCR in UI
- Currently hardcoded to false

### Phase 3 (Medium-term)

1. **Batch Processing**:
- Upload multiple PDFs
- Queue processing
- Download as zip file
- Progress tracking for batch

2. **Advanced Options**:
- Custom extraction schemas
- Language selection
- Output format options (HTML, plain text, DOCX)
- Backend table extraction (currently frontend-only)

3. **Search and Navigation**:
- Full-text search within Analysis View
- Jump to sections/tables/figures
- Bookmarking and highlights
- Table of contents generation

### Phase 4 (Long-term)

1. **Citation Extraction**:
- Auto-detect references
- Extract bibliographic data
- Link to PubMed/DOI
- Build citation network graphs

2. **Collaborative Features**:
- Share extracted documents via URL
- Real-time annotations and highlights
- Comment threads on specific sections
- Version history and diff view

3. **Advanced Graph Processing**:
- ~~Execute Python code in sandbox environment~~ ✅ **DONE** via Pyodide
- Generate multiple chart variants (e.g., different plot styles)
- Interactive graph editing with re-generation
- Export rendered graphs as high-resolution PNG/SVG
- Pre-load Pyodide in background for faster first render
- Service worker caching for offline Pyodide access
- Support for more Python libraries (seaborn, plotly, bokeh)

4. **AI-Powered Summarization**:
- Auto-generate paper summaries
- Key findings extraction
- Methodology summaries
- Integration with chat interface

---

## Integration with ABCresearch Platform

### Dashboard Integration

**File**: `src/components/Dashboard.tsx`

**View Mode**: Added 'dataextraction' to view mode options

```typescript
const [viewMode, setViewMode] = useState<
  'research' | 'marketmap' | 'savedmaps' | 'pipeline' | 'dataextraction'
>()

// Render PDF extraction view
if (viewMode === 'dataextraction') {
  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <Header onStartNewProject={handleStartNewProject} currentProjectId={currentProjectId} />
      
      {/* PDF Data Extraction Content */}
      <div className="flex-1 overflow-y-auto">
        <PDFExtraction />
      </div>
    </div>
  )
}
```

**Navigation**: Tab in main header alongside:
- Research
- Market Map
- Asset Pipeline
- Saved Maps
- **Data Extraction** ← New

**Component Hierarchy**:
```
Dashboard
  └── viewMode === 'dataextraction'
      └── PDFExtraction
          ├── Upload Interface (default)
          └── PaperAnalysisView (conditional, when showAnalysisView === true)
              ├── Markdown Tab
              ├── Tables Tab
              ├── Graphs Tab
              └── Data Tab
```

### Design System Compliance

**Colors**: Follows existing palette
- Success: green-50, green-600
- Error: red-50, red-600
- Info: blue-50, blue-600
- Neutral: gray-50 through gray-900

**Components**: Uses existing UI library
- Button (primary, outline, ghost variants)
- Card (CardHeader, CardContent)
- Input (file input with custom styling)
- Icons from Lucide React

**Spacing**: TailwindCSS utility classes
- Padding: p-4, p-6
- Margins: mt-2, mb-4
- Gaps: gap-2, gap-3

### Accessibility

- ✅ Semantic HTML (labels, buttons, headings)
- ✅ ARIA labels for file input
- ✅ Keyboard navigation support
- ✅ Focus indicators
- ✅ Screen reader compatible
- ✅ Color contrast compliance (WCAG 2.1 AA)

---

## Troubleshooting

### Common Issues

**Issue**: "Datalab API key not configured"
```
Check: process.env.DATALAB_API_KEY exists
Fix: Add to Vercel environment variables or .env
```

**Issue**: "File size exceeds limit"
```
Check: File is <50MB
Fix: Compress PDF or split into multiple files
```

**Issue**: "Processing timed out"
```
Check: PDF complexity (pages, images)
Fix: Use smaller PDF or increase timeout in vercel.json
```

**Issue**: "No graphs detected" (when graphs exist)
```
Check: Graphify toggle is enabled
Check: OPENAI_API_KEY is set
Check: maxImages is sufficient
Fix: Enable graphify, add API key, or increase image limit
```

**Issue**: Download buttons not appearing
```
Check: extractionResult.success === true
Check: Blobs exist in response
Fix: Verify backend returns base64-encoded blobs
```

### Debug Commands

```bash
# Check environment variables
vercel env ls

# Test file upload independently
curl -X POST http://localhost:3000/api/test-upload \
  -F "file=@test.pdf"

# Check Vercel logs
vercel logs

# Run tests
npm run test:run
```

---

## Reference Implementation

The TypeScript implementation in `/api/extract-pdf-content.ts` is based on the Python CLI scripts in `extraction_scripts/`:

### Python Reference

**`datalab_marker.py`**:
- Command-line interface for Datalab API
- Polling logic and timeout handling
- Image extraction and saving
- Response parsing

**`graphify_images.py`**:
- GPT Vision integration
- Graph detection logic
- Python code generation
- Concurrent image processing

### Key Differences

**TypeScript Implementation**:
- Runs as Vercel serverless function
- Returns base64-encoded blobs (not files on disk)
- Integrated into web UI
- Type-safe with TypeScript
- No Python code execution (security)

**Python CLI**:
- Standalone command-line tool
- Saves files to local filesystem
- Can execute generated Python code
- Flexible options via CLI args
- Good for batch processing

**Both Implementations**:
- Use same external APIs (Datalab, GPT Vision)
- Similar polling logic
- Equivalent graph detection prompts
- Same output formats (markdown, JSON)

---

## Best Practices

### For Users

1. **Use Appropriate PDFs**:
   - <20 pages for fast results
   - High-quality scans for better OCR
   - Standard layouts for better extraction

2. **Configure Options Wisely**:
   - Disable graphify for text-only PDFs (faster, cheaper)
   - Use lower maxImages for quick previews
   - Enable forceOCR for scanned documents

3. **Verify Downloads**:
   - Check markdown file opens correctly
   - Validate JSON structure
   - Review graph detection accuracy

### For Developers

1. **Error Handling**:
   - Always check `result.success`
   - Provide clear error messages
   - Handle partial success (markdown works, graphify fails)

2. **Performance**:
   - Monitor function execution time
   - Track API costs
   - Optimize image processing limits

3. **Testing**:
   - Test with various PDF types
   - Verify downloads work across browsers
   - Check mobile responsiveness

4. **Logging**:
   - Log all API calls
   - Track success/error rates
   - Monitor processing times

---

## Quick Reference

### Service Usage

```typescript
import { PDFExtractionService } from '@/services/pdfExtractionService'

// Extract with default options
const result = await PDFExtractionService.extractContent(pdfFile)

// Extract with custom options
const result = await PDFExtractionService.extractContent(pdfFile, {
  enableGraphify: true,
  forceOCR: false,
  maxGraphifyImages: 10
})

// Trigger downloads
if (result.markdownBlob) {
  PDFExtractionService.downloadBlob(result.markdownBlob, 'document.md')
}

if (result.originalImagesBlob) {
  PDFExtractionService.downloadBlob(result.originalImagesBlob, 'document-original-images.json')
}

// Access stats
console.log(`Found ${result.stats.imagesFound} images`)
console.log(`Detected ${result.stats.graphsDetected} graphs`)

// Access graph results
if (result.graphifyResults) {
  result.graphifyResults.summary.forEach(graph => {
    if (graph.isGraph) {
      console.log(`${graph.imageName}: ${graph.graphType}`)
      console.log(graph.pythonCode)  // Matplotlib code
      console.log(graph.data)        // Extracted data
    }
  })
}
```

### API Endpoint

```bash
# Test endpoint
curl -X POST http://localhost:3000/api/extract-pdf-content \
  -F "file=@research-paper.pdf" \
  -F "enableGraphify=true" \
  -F "maxGraphifyImages=10"
```

### Component Usage

```tsx
import { PDFExtraction } from '@/components/PDFExtraction'
import { PaperAnalysisView } from '@/components/PaperAnalysisView'

// In Dashboard
if (viewMode === 'dataextraction') {
  return <PDFExtraction />
}

// PaperAnalysisView is automatically shown by PDFExtraction when user clicks "View Comprehensive Analysis"
// It can also be used standalone:
<PaperAnalysisView
  result={extractionResult}
  fileName="research-paper.pdf"
  onBack={() => console.log('Back clicked')}
/>
```

---

## Performance Metrics

### Observed Performance

**Backend Function**:
- Cold start: ~2-3 seconds
- Warm start: <1 second
- Datalab API: 20-60 seconds
- GPT Vision: 5-10 seconds per image
- Total: 30 seconds - 5 minutes

**Frontend**:
- File upload: <1 second
- Base64 decode: <1 second
- Download trigger: Instant
- UI updates: <100ms

### Bottlenecks

1. **Datalab Processing**: Largest time consumer (60-80% of total time)
2. **GPT Vision**: Scales linearly with image count
3. **Network Latency**: Varies by connection quality
4. **Base64 Encoding**: Minimal impact (<1s)

### Optimization Impact

| Optimization | Time Saved | Cost Saved |
|--------------|------------|------------|
| Disable graphify | 30-60s | ~$0.01 |
| maxImages: 5 vs 10 | 25-50s | ~$0.005 |
| Result caching | 100% | ~80% |
| Smaller PDFs | Varies | Varies |

---

## Comparison with Other Solutions

### vs. Python CLI (extraction_scripts/)

**TypeScript/Vercel**:
- ✅ Integrated into web UI
- ✅ No local dependencies
- ✅ Cloud-based processing
- ❌ Cannot execute Python code
- ❌ No local file access

**Python CLI**:
- ✅ Can execute generated code
- ✅ Saves files locally
- ✅ Batch processing
- ❌ Requires local setup
- ❌ Not web-integrated

### vs. Manual PDF Reading

**PDF Extraction**:
- ✅ Fast (minutes vs hours)
- ✅ Structured output (markdown, JSON)
- ✅ Graph data extraction
- ✅ Searchable text
- ❌ Small cost per PDF
- ❌ Requires API keys

**Manual**:
- ✅ Free
- ✅ 100% accurate
- ❌ Time-consuming
- ❌ Not scalable
- ❌ Hard to search/analyze

---

## Summary

The PDF Content Extraction feature provides a powerful, AI-enhanced way to convert static PDF documents into structured, analyzable data with a comprehensive analysis interface. By integrating Datalab's Marker API for text extraction, GPT Vision for graph detection, and a rich Paper Analysis View for content exploration, users can quickly transform research papers and reports into machine-readable formats and gain deep insights.

**Key Strengths**:
- Fast processing (30s - 5min)
- Five output formats (Markdown, Original Images, Tables, Full Response, GPT Analysis)
- Intelligent graph detection with zoom/pan image viewing
- **Comprehensive Paper Analysis View** with 4 tabs:
  - Markdown viewer with rendered/source toggle
  - Table browser with structured display
  - Graph gallery with AI analysis and reconstruction code
  - Data inspector with syntax-highlighted JSON
- Table extraction from markdown (frontend-based)
- Drag & drop file upload
- User-configurable options
- Comprehensive error handling
- Production-ready and fully integrated

**Integration Points**:
- Accessible via "Data Extraction" tab
- Follows ABCresearch design system
- Seamless navigation between upload and analysis views
- Consistent with existing API patterns
- Type-safe implementation

**Cost-Effective**:
- ~$0.11 per PDF extraction
- User control over cost/feature tradeoff
- Future caching for 80% cost reduction

**User Experience**:
- Modern drag & drop interface
- Interactive content exploration
- Multiple viewing modes for different use cases
- Download flexibility (per-component or full data)
- Zero-friction workflow from upload to insights

---


**Feature Status**: Production Ready (Enhanced with Pyodide Rendering)  
**Major Updates**:
- **NEW**: Browser-based Python graph rendering with Pyodide WebAssembly
- **NEW**: One-click execution of GPT-generated matplotlib code
- **NEW**: Side-by-side comparison of original vs AI-reconstructed graphs
- **NEW**: Visual verification of data extraction accuracy
- Added Paper Analysis View with tabbed interface
- Integrated table extraction functionality
- Enhanced UI with drag & drop support
- Improved GPT prompt (temperature: 1, more detailed instructions)
- Added zoom/pan for image viewing
- Syntax highlighting for code and JSON
- Markdown rendering with GFM support

**Related Documentation**:
- See `PYODIDE_GRAPH_RENDERING.md` for detailed technical documentation on the Pyodide rendering feature

