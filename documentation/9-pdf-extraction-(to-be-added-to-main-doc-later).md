LATEST UPDATE: 10/28/25

# ABCresearch - PDF Content Extraction Documentation

## Overview

The PDF Content Extraction feature enables users to upload PDF documents (such as research papers, clinical reports, or regulatory documents) and extract structured content including markdown text, images, and AI-powered graph analysis. This feature integrates Datalab's Marker API for PDF processing and OpenAI's GPT Vision for intelligent graph detection and reconstruction.

## Core Purpose

The PDF extraction system serves to:
- **Convert PDFs to Markdown**: Extract readable text content from scientific papers
- **Preserve Document Structure**: Maintain headings, lists, and formatting
- **Extract Images**: Capture figures, charts, and diagrams from documents
- **Detect Graphs**: Use AI to identify data visualizations
- **Generate Reconstruction Code**: Provide Python code to recreate graphs
- **Enable Data Reuse**: Download multiple formats for different use cases

## Key Features

### 1. PDF to Markdown Conversion
- Powered by Datalab Marker API
- OCR support for scanned documents
- Preserves document structure (headings, paragraphs, lists)
- Handles multi-column layouts
- Supports scientific notation and equations

### 2. Intelligent Graph Detection
- GPT Vision API analyzes extracted images
- Identifies data visualizations (charts, plots, graphs)
- Distinguishes graphs from photos/diagrams
- Extracts approximate data points
- Generates Python reconstruction code

### 3. Multiple Download Formats
Users receive four downloadable outputs:

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

### 4. Configurable Processing Options
- **Graph Detection Toggle**: Enable/disable GPT Vision processing
- **Max Images Limit**: Control processing time and cost (1-20 images)
- **Force OCR**: Option to force optical character recognition
- **Real-time Stats**: Images found, graphs detected, processing time

## User Workflow

### Typical Extraction Session

1. **Navigate to Data Extraction**
   - Click "Data Extraction" tab in main navigation
   - Upload interface loads

2. **Upload PDF**
   - Click upload area or drag & drop
   - Select PDF file (up to 50MB)
   - See file name and size displayed

3. **Configure Options** (Optional)
   - Toggle "Enable graph detection with GPT Vision"
   - Adjust "Max images to analyze" slider (1-20)
   - Default: Graphify enabled, 10 images max

4. **Extract Content**
   - Click "Extract Content" button
   - Processing begins (30 seconds to 5 minutes)
   - Loading indicator shown with progress message

5. **View Results**
   - Success banner with statistics:
     - Images found count
     - Graphs detected count
     - Processing time
   - Graph detection summary (if graphs found)
   - Three download buttons appear

6. **Download Outputs**
   - Click "Download Markdown Content" for text content
   - Click "Download Original Extracted Images" for raw image data
   - Click "Download Full API Response" for complete data
   - Click "Download GPT Graph Analysis" (if graphs detected)

7. **Process Additional PDFs**
   - Click "Clear and Start Over"
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
```

**UI Sections**:

1. **File Upload Area**:
```tsx
<input type="file" accept=".pdf" onChange={handleFileSelect} />
<label>
  <Upload icon />
  Click to upload PDF file
  Only PDF files are accepted
</label>
```

2. **Selected File Display**:
```tsx
<div className="bg-blue-50">
  <FileText icon />
  {fileName}
  {fileSize}
  <X button onClick={handleReset} />
</div>
```

3. **Options Panel**:
```tsx
<div className="bg-gray-50">
  <label>
    <input type="checkbox" checked={enableGraphify} />
    Enable graph detection with GPT Vision
  </label>
  
  {enableGraphify && (
    <label>
      Max images to analyze: {maxImages}
      <input type="range" min={1} max={20} value={maxImages} />
    </label>
  )}
</div>
```

4. **Extract Button**:
```tsx
<Button onClick={handleExtractContent} disabled={!selectedFile || isProcessing}>
  {isProcessing ? (
    <>
      <Loader2 animate-spin />
      Extracting Content...
    </>
  ) : (
    <>
      <Upload />
      Extract Content
    </>
  )}
</Button>
```

5. **Success Display**:
```tsx
<div className="bg-green-50">
  <CheckCircle2 />
  Extraction Successful!
  
  <p>{message}</p>
  
  <div>
    {imagesFound} images found
    {graphsDetected} graphs detected
    Processed in {time}s
  </div>
</div>

{/* Download Buttons */}
<Button onClick={() => downloadBlob(markdownBlob, 'document.md')}>
  <FileText /> Markdown Content <Download />
</Button>

{originalImagesBlob && (
  <Button onClick={() => downloadBlob(originalImagesBlob, 'document-original-images.json')}>
    <Image /> Original Extracted Images (JSON) <Download />
  </Button>
)}

<Button onClick={() => downloadBlob(responseJsonBlob, 'document-response.json')}>
  <FileText /> Full API Response (JSON) <Download />
</Button>

{graphifyResults && (
  <Button onClick={() => downloadBlob(graphifyBlob, 'document-gpt-analysis.json')}>
    <Image /> GPT Graph Analysis (JSON) <Download />
  </Button>
)}

{/* Graph Summary */}
{graphs.filter(g => g.isGraph).length > 0 && (
  <div className="bg-blue-50">
    Graph Detection Summary:
    {graphs.filter(g => g.isGraph).slice(0, 5).map(graph => (
      <div>{graph.imageName}: {graph.graphType}</div>
    ))}
    {graphCount > 5 && <p>+{graphCount - 5} more graphs</p>}
  </div>
)}
```

6. **Error Display**:
```tsx
<div className="bg-red-50">
  <AlertCircle />
  Extraction Failed
  <p>{errorMessage}</p>
</div>
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
}

export interface ExtractionStats {
  imagesFound: number
  graphsDetected: number
  processingTimeMs: number
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
  "temperature": 0.3,
  "response_format": { "type": "json_object" },
  "messages": [
    {
      "role": "system",
      "content": "You convert static images of figures into approximate datasets and minimal plotting code."
    },
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "Determine if this image is a data visualization (graph/chart/plot). If yes, extract data and generate Python code to recreate it."
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

**Production**:
```json
{
  "formidable": "^3.5.1",  // Multipart form parsing
  "undici": "^6.0.0"       // Modern fetch + FormData support
}
```

**Development**:
```json
{
  "vitest": "^4.0.4",
  "@testing-library/react": "latest",
  "@testing-library/user-event": "latest"
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

### Research Paper Analysis
**Scenario**: Extract content from published research papers

**Workflow**:
1. Upload journal article PDF
2. Enable graphify to detect data charts
3. Download markdown for reading/analysis
4. Download GPT analysis for data extraction
5. Use Python code to recreate figures

**Benefit**: Convert static PDFs to editable, analyzable content

### Clinical Trial Reports
**Scenario**: Extract data from clinical study reports

**Workflow**:
1. Upload clinical trial document
2. Extract structured text
3. Identify efficacy charts and safety data
4. Download all formats for comprehensive analysis

**Benefit**: Structured data extraction from regulatory documents

### Literature Review
**Scenario**: Process multiple research papers

**Workflow**:
1. Upload papers one by one
2. Collect markdown outputs
3. Aggregate graph data from GPT analyses
4. Build comprehensive literature database

**Benefit**: Systematic extraction for meta-analysis

### Data Extraction from Legacy Documents
**Scenario**: Digitize old scanned papers

**Workflow**:
1. Upload scanned PDF
2. Enable forceOCR option
3. Extract text despite poor scan quality
4. Manually verify important data points

**Benefit**: Preserve and digitize historical research

---

## Limitations and Constraints

### Technical Limitations

1. **File Size**: Maximum 50MB per PDF
2. **Processing Time**: Maximum 5 minutes (Vercel timeout)
3. **Image Limit**: Maximum 20 images processed for graph detection
4. **Python Execution**: Code generated but NOT executed server-side
5. **OCR Accuracy**: Depends on source PDF quality

### Known Issues

1. **Scanned PDFs**: May require forceOCR for accurate extraction
2. **Complex Layouts**: Multi-column or unusual layouts may have formatting issues
3. **Equations**: LaTeX equations may not render perfectly in markdown
4. **Tables**: Complex tables may lose formatting
5. **Graph Data Accuracy**: Extracted data is approximate (pixel-based estimation)

### Not Supported

- Excel/Word document conversion (PDF only)
- Executing generated Python code (security constraint)
- Real-time streaming of results (batch processing only)
- Concurrent multi-file uploads (one at a time)
- PDF editing or annotation

---

## Future Enhancements

### Phase 2 (Short-term)

1. **Result Caching**:
```sql
CREATE TABLE pdf_extraction_cache (
  id UUID PRIMARY KEY,
  file_hash TEXT UNIQUE,
  markdown TEXT,
  response_json JSONB,
  graphify_results JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days'
);
```

2. **Markdown Preview**:
- Display extracted content in UI before download
- Syntax highlighting for code blocks
- Collapsible sections

3. **Graph Thumbnails**:
- Show detected graphs visually
- Click to view full size
- Preview Python code

### Phase 3 (Medium-term)

1. **Table Extraction**:
- Parse markdown tables
- Convert to CSV/Excel
- Structured data output

2. **Batch Processing**:
- Upload multiple PDFs
- Queue processing
- Download as zip file

3. **Advanced Options**:
- Custom extraction schemas
- Language selection
- Output format options (HTML, plain text)

### Phase 4 (Long-term)

1. **Citation Extraction**:
- Auto-detect references
- Extract bibliographic data
- Link to PubMed/DOI

2. **Collaborative Features**:
- Share extracted documents
- Annotations and highlights
- Version history

3. **Advanced Graph Processing**:
- Execute Python code in sandbox
- Generate multiple chart variants
- Interactive graph editing

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
    <div className="h-screen flex flex-col overflow-hidden">
      <Header />
      <div className="flex-1 overflow-hidden">
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

// In Dashboard
if (viewMode === 'dataextraction') {
  return <PDFExtraction />
}
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

The PDF Content Extraction feature provides a powerful, AI-enhanced way to convert static PDF documents into structured, analyzable data. By integrating Datalab's Marker API for text extraction and GPT Vision for graph detection, users can quickly transform research papers and reports into machine-readable formats with minimal effort.

**Key Strengths**:
- Fast processing (30s - 5min)
- Four output formats (Markdown, Original Images, Full Response, GPT Analysis)
- Intelligent graph detection
- Separate downloads for original and reconstructed graphs
- User-configurable options
- Comprehensive error handling
- Production-ready and tested (118 tests)

**Integration Points**:
- Accessible via "Data Extraction" tab
- Follows ABCresearch design system
- Consistent with existing API patterns
- Type-safe implementation

**Cost-Effective**:
- ~$0.11 per PDF extraction
- User control over cost/feature tradeoff
- Future caching for 80% cost reduction

---

**Documentation Version**: 1.0  
**Last Updated**: October 28, 2025  
**Feature Status**: Production Ready  
**Test Coverage**: 118/118 tests passing

