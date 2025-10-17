# ABCresearch - Backend Documentation

## Architecture Overview

The backend follows a **serverless architecture** using Vercel Functions as API proxies. All business logic resides client-side in services, while backend functions handle external API communication, authentication, and database operations.

## Backend Philosophy

### API Proxies Pattern

**Purpose**: Server-side functions act purely as proxies to external services
- ✅ Handle CORS issues
- ✅ Protect API keys
- ✅ Manage rate limiting
- ✅ Format responses
- ❌ No business logic
- ❌ No data transformation beyond basic formatting

**Benefits**:
1. **Security**: API keys never exposed to client
2. **Flexibility**: Easy to swap external providers
3. **Rate Limiting**: Centralized control
4. **Testing**: Business logic testable without API calls

## Technology Stack

### Runtime Environment
- **Platform**: Vercel Serverless Functions
- **Runtime**: Node.js (latest)
- **Language**: TypeScript

### External Services
- **ClinicalTrials.gov API v2**: Clinical trials data
- **PubMed E-utilities API**: Research papers
- **Anthropic Claude API**: Conversational AI
- **Google Gemini API**: Query enhancement
- **Supabase**: Database and authentication

### Database
- **Provider**: Supabase (PostgreSQL)
- **ORM**: Supabase JavaScript Client
- **Authentication**: Supabase Auth (JWT-based)

## API Endpoints

All endpoints located in `api/` directory.

### 1. Clinical Trials Search

**File**: `api/search-clinical-trials.ts`

**Endpoint**: `POST /api/search-clinical-trials`

**Purpose**: Proxy to ClinicalTrials.gov API v2

**Request Body**:
```typescript
interface SearchParams {
  query?: string        // Free-text search
  condition?: string    // Medical condition
  sponsor?: string      // Company/organization name
  phase?: string        // Trial phase (PHASE1, PHASE2, PHASE3)
  status?: string       // Trial status (RECRUITING, COMPLETED, etc.)
  pageSize?: number     // Results per page (default: 20)
  pageToken?: string    // Pagination token
}
```

**Response**:
```typescript
{
  trials: ClinicalTrial[],    // Array of formatted trial objects
  nextPageToken?: string,      // For pagination
  totalCount: number           // Total results available
}
```

**Query Building**:
```typescript
// Constructs ClinicalTrials.gov API query
const queryParts: string[] = []
if (params.condition) queryParts.push(`AREA[Condition]${params.condition}`)
if (params.sponsor) queryParts.push(`AREA[Sponsor]${params.sponsor}`)
if (params.phase) queryParts.push(`AREA[Phase]${params.phase}`)
if (params.query) queryParts.push(params.query)
```

**External API Call**:
```
GET https://clinicaltrials.gov/api/v2/studies?query.term=...&fields=...
```

**Fields Requested**:
- NCTId, BriefTitle, OfficialTitle
- OverallStatus, Phase, Condition
- InterventionName, InterventionType
- LeadSponsorName, CollaboratorName
- StartDate, CompletionDate, EnrollmentCount
- StudyType, LocationFacility, LocationCity, LocationCountry

**Response Transformation**:
```typescript
const trials = (data.studies || []).map((study: any) => ({
  nctId: study.protocolSection?.identificationModule?.nctId || '',
  briefTitle: study.protocolSection?.identificationModule?.briefTitle || '',
  // ... transform nested API response to flat structure
}))
```

**Error Handling**:
- HTTP 405: Method not allowed (non-POST)
- HTTP 500: ClinicalTrials.gov API error
- CORS headers set for cross-origin requests

---

### 2. Research Papers Search

**File**: `api/search-papers.ts`

**Endpoint**: `POST /api/search-papers`

**Purpose**: Proxy to PubMed E-utilities API

**Request Body**:
```typescript
interface PubMedSearchRequest {
  query: string         // PubMed search query
  maxResults?: number   // Max papers to return (default: 20)
  startDate?: string    // Filter by publication date
  endDate?: string      // Filter by publication date
}
```

**Response**:
```typescript
{
  papers: PubMedArticle[]  // Array of formatted paper objects
}
```

**Two-Step Process**:

**Step 1**: Search for PMIDs
```
GET https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi
    ?db=pubmed
    &term=<query>
    &retmode=json
    &retmax=<maxResults>
    &sort=relevance
```

**Step 2**: Fetch article details
```
GET https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi
    ?db=pubmed
    &id=<comma-separated-pmids>
    &retmode=xml
```

**Rate Limiting**:
```typescript
const RATE_LIMIT_DELAY = 350  // 350ms between requests (3 req/sec)
let lastRequestTime = 0

// Enforce delay
const now = Date.now()
const timeSinceLastRequest = now - lastRequestTime
if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
  await new Promise(resolve => 
    setTimeout(resolve, RATE_LIMIT_DELAY - timeSinceLastRequest)
  )
}
lastRequestTime = Date.now()
```

**API Key Support**:
```typescript
const API_KEY = process.env.PUBMED_API_KEY || ''
const EMAIL = process.env.PUBMED_EMAIL || 'your-email@example.com'

// If API key provided, rate limit increases to 10 req/sec
if (API_KEY) searchParams.append('api_key', API_KEY)
```

**XML Parsing**:
```typescript
function parseArticlesXML(xmlData: string): any[] {
  const articles: any[] = []
  const articleMatches = xmlData.match(/<PubmedArticle>[\s\S]*?<\/PubmedArticle>/g)
  
  for (const articleXml of articleMatches) {
    const article = {
      pmid: extractXMLValue(articleXml, 'PMID'),
      title: extractXMLValue(articleXml, 'ArticleTitle'),
      abstract: extractXMLValue(articleXml, 'AbstractText'),
      journal: extractXMLValue(articleXml, 'Title'),
      publicationDate: extractPublicationDate(articleXml),
      doi: extractXMLValue(articleXml, 'ELocationID'),
      authors: extractAuthors(articleXml),
      nctNumber: extractNCTNumber(articleXml),  // Extract NCT ID if present
      relevanceScore: calculateRelevanceScore(articleXml),
      fullTextLinks: { ... }
    }
    articles.push(article)
  }
  return articles
}
```

**Relevance Scoring**:
```typescript
function calculateRelevanceScore(xml: string): number {
  let score = 50  // Base score
  
  // Premium journal bonus (+30)
  const premiumJournals = ['New England Journal', 'JAMA', 'Lancet', 'Nature Medicine']
  if (premiumJournals.some(j => journal.includes(j))) score += 30
  
  // Phase 3 trial bonus (+20)
  if (xml.includes('Clinical Trial, Phase III')) score += 20
  
  // Recent publication bonus (+15)
  const year = parseInt(extractXMLValue(xml, 'Year') || '0')
  const currentYear = new Date().getFullYear()
  if (currentYear - year <= 2) score += 15
  
  return Math.min(score, 100)
}
```

---

### 3. AI Query Enhancement

**File**: `api/enhance-search.ts`

**Endpoint**: `POST /api/enhance-search`

**Purpose**: Enhance user queries using Google Gemini API

**Request Body**:
```typescript
{
  query: string  // User's natural language query
}
```

**Response**:
```typescript
{
  success: boolean
  enhancedQueries: {
    primary: SearchParams      // Most precise search
    alternative: SearchParams  // Broader alternative
    broad: SearchParams        // Widest search
  }
}
```

**AI Prompt Strategy**:
```typescript
const prompt = `You are a medical research expert. Enhance this query: "${query}"

Generate 3 search strategies:

1. PRIMARY (most precise):
   - Extract specific medical condition
   - Identify drug/intervention
   - Determine trial phase if mentioned
   - Status (recruiting/completed)

2. ALTERNATIVE (slightly broader):
   - Include related conditions
   - Broader intervention category
   - No phase restriction

3. BROAD (catch-all):
   - General therapeutic area
   - Any related interventions

Return ONLY valid JSON with this structure:
{
  "primary": { "condition": "...", "phase": "...", "status": "..." },
  "alternative": { "condition": "...", "query": "..." },
  "broad": { "query": "..." }
}

Rules:
- Use null for absent fields
- phase: "PHASE1", "PHASE2", "PHASE3" or null
- status: "RECRUITING", "COMPLETED", "ACTIVE_NOT_RECRUITING" or null
`
```

**Gemini API Call**:
```typescript
const response = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,  // Low temperature for consistent results
        maxOutputTokens: 500
      }
    })
  }
)
```

**Response Cleaning**:
```typescript
// Remove markdown code blocks
let cleanedText = responseText.trim()
if (cleanedText.startsWith('```json')) {
  cleanedText = cleanedText
    .replace(/^```json\s*/, '')
    .replace(/\s*```$/, '')
}

// Extract JSON object
const jsonMatch = cleanedText.match(/\{[\s\S]*\}/)
if (jsonMatch) {
  const result = JSON.parse(jsonMatch[0])
  return { success: true, enhancedQueries: result }
}
```

---

### 4. Drug Name Extraction

**File**: `api/extract-drug-names.ts`

**Endpoint**: `POST /api/extract-drug-names`

**Purpose**: Extract drug names from text using Gemini API

**Request Body**:
```typescript
{
  texts: string[]  // Array of text snippets (titles, abstracts, etc.)
}
```

**Response**:
```typescript
{
  success: boolean
  drugs: Array<{
    name: string              // Extracted drug name
    type: string              // Drug type (small molecule, biologic, etc.)
    confidence: number        // 0-100
    brandNames?: string[]     // Known brand names
    mechanism?: string        // Brief mechanism of action
  }>
}
```

**AI Prompt**:
```typescript
const prompt = `Extract pharmaceutical drug names from these texts:

${texts.map((t, i) => `${i + 1}. ${t}`).join('\n')}

For each drug found, provide:
- Generic name (primary identifier)
- Type (small molecule, monoclonal antibody, peptide, etc.)
- Confidence (0-100)
- Brand names if known
- Brief mechanism

Return ONLY valid JSON array:
[
  {
    "name": "Semaglutide",
    "type": "peptide",
    "confidence": 95,
    "brandNames": ["Ozempic", "Wegovy"],
    "mechanism": "GLP-1 receptor agonist"
  },
  ...
]

Rules:
- Skip placebo, standard care, lifestyle interventions
- Include only actual pharmaceutical drugs
- Normalize to generic names
`
```

---

### 5. AI Conversational Response

**File**: `api/generate-response.ts`

**Endpoint**: `POST /api/generate-response`

**Purpose**: Generate contextual AI responses using Claude

**Request Body**:
```typescript
{
  userQuery: string
  searchResults?: {        // Optional: Include if responding to search results
    trials: ClinicalTrial[]
    papers: PubMedArticle[]
    totalCount: number
    searchStrategies: {...}
  }
}
```

**Response**:
```typescript
{
  success: boolean
  response: string         // Natural language response
  shouldSearch: boolean    // Should trigger a search
  searchQuery?: string     // Extracted search terms
  searchSuggestions?: Array<{
    id: string
    label: string          // Button text
    query: string          // Search query to execute
    description?: string   // Optional explanation
  }>
  intent: 'greeting' | 'search_request' | 'follow_up' | 'clarification' | 'general_question'
}
```

**Two-Stage AI Processing**:

**Stage 1: Intent Classification**
```typescript
const intentPrompt = `Classify the user's message: "${userQuery}"

Intents:
- "greeting": Hello, hi, how are you
- "search_request": Looking for papers/trials on [topic]
- "follow_up": Tell me more, what about [topic]
- "clarification": I meant [topic], focus on [topic]
- "general_question": What can you help with

Determine:
1. Intent category
2. Should we search? (true/false)
3. Search terms if yes
4. Search suggestions (clickable buttons)

Return JSON:
{
  "intent": "...",
  "shouldSearch": true/false,
  "searchQuery": "...",
  "searchSuggestions": [...],
  "responseType": "conversational|search_suggestion|clarification_request"
}
`

// Call Claude Haiku (fast, cheap)
const response = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': process.env.ANTHROPIC_API_KEY,
    'anthropic-version': '2023-06-01'
  },
  body: JSON.stringify({
    model: 'claude-3-haiku-20240307',
    max_tokens: 300,
    temperature: 0.3,
    messages: [{ role: 'user', content: intentPrompt }]
  })
})
```

**Stage 2: Conversational Response**
```typescript
// If search results provided
const searchResultsPrompt = `User searched for: "${userQuery}"

Results:
CLINICAL TRIALS: ${totalCount}
- Recruiting: ${recruitingCount}
- Phase 3: ${phase3Count}
- Top sponsors: ${topSponsors.join(', ')}

PAPERS: ${papers.length}
- Recent (last 2 years): ${recentPapers}

Generate natural, conversational response:
1. Acknowledge what user was looking for
2. Summarize findings
3. Highlight interesting insights
4. Mention both trials and papers
5. Professional but conversational tone

Keep concise (2-3 sentences).
`

// Otherwise, generate conversational response
const conversationalPrompt = `User said: "${userQuery}"
Intent: ${intentResult.intent}

Generate appropriate response:
- greeting: Be friendly, explain capabilities
- search_request: Acknowledge, suggest conducting search
- follow_up: Answer follow-up question
- clarification: Ask for clarification
- general_question: Answer about capabilities

Keep conversational, helpful, professional. 1-2 sentences max.
`
```

**Response Parsing**:
```typescript
// Clean Claude response (remove markdown, extract JSON)
let cleanedText = rawText.trim()
if (cleanedText.startsWith('```json')) {
  cleanedText = cleanedText
    .replace(/^```json\s*/, '')
    .replace(/\s*```$/, '')
}

const jsonMatch = cleanedText.match(/\{[\s\S]*\}/)
if (jsonMatch) {
  intentResult = JSON.parse(jsonMatch[0])
}
```

---

### 6. Slide Generation

**File**: `api/generate-slide.ts`

**Endpoint**: `POST /api/generate-slide`

**Purpose**: Generate market analysis slides

**Request Body**:
```typescript
{
  trials: ClinicalTrial[]
  query: string
}
```

**Response**:
```typescript
{
  success: boolean
  slide: {
    title: string
    insights: string[]
    keyFindings: Array<{
      title: string
      description: string
    }>
    competitiveLandscape: string
    recommendations: string[]
  }
}
```

---

### 7. PDF Table Extraction

**File**: `api/extract_tables.js` (Node.js)

**Endpoint**: `POST /api/extract_tables`

**Purpose**: Extract tables from PDF documents

**Request**: Multipart form data with PDF file

**Response**:
```typescript
{
  success: boolean
  tables: Array<any[][]>     // 2D arrays of table data
  excelBlob?: Blob           // Excel file for download
  error?: string
}
```

**Process**:
1. Receive PDF file upload
2. Parse PDF using pdf-parse library
3. Extract table structures
4. Convert to Excel using xlsx library
5. Return both structured data and Excel blob

---

## Database Architecture

### Supabase PostgreSQL Schema

#### Table: `market_maps`

**Purpose**: Store saved research projects

```sql
CREATE TABLE market_maps (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  name TEXT NOT NULL,
  query TEXT NOT NULL,
  trials_data JSONB NOT NULL,
  slide_data JSONB NOT NULL,
  chat_history JSONB,
  papers_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE market_maps ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own maps
CREATE POLICY "Users can only access their own market maps"
  ON market_maps
  FOR ALL
  USING (auth.uid() = user_id);

-- Index for performance
CREATE INDEX idx_market_maps_user_id ON market_maps(user_id);
CREATE INDEX idx_market_maps_created_at ON market_maps(created_at DESC);
```

**Columns**:
- `id`: Auto-incrementing primary key
- `user_id`: Foreign key to Supabase auth users
- `name`: User-defined project name
- `query`: Original search query
- `trials_data`: Complete clinical trials array (JSONB)
- `slide_data`: Generated market analysis (JSONB)
- `chat_history`: Conversational context (JSONB array)
- `papers_data`: Research papers array (JSONB)
- `created_at`: Timestamp of creation
- `updated_at`: Timestamp of last update

**JSONB Benefits**:
- Flexible schema for complex nested data
- Efficient querying with GIN indexes
- Automatic JSON validation
- PostgreSQL native operations

#### Table: `auth.users` (Supabase Managed)

**Purpose**: User authentication

```sql
-- Managed by Supabase Auth
CREATE TABLE auth.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  encrypted_password TEXT NOT NULL,
  email_confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- ... additional Supabase auth fields
);
```

---

## Authentication Flow

### Supabase Auth Integration

**Client Configuration**:
```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

**Auth Methods**:

1. **Sign Up**:
```typescript
const { data, error } = await supabase.auth.signUp({
  email: email,
  password: password
})
// Sends confirmation email
```

2. **Sign In**:
```typescript
const { data, error } = await supabase.auth.signInWithPassword({
  email: email,
  password: password
})
// Returns session with JWT token
```

3. **Sign Out**:
```typescript
await supabase.auth.signOut()
// Invalidates session
```

4. **Get Session**:
```typescript
const { data: { session } } = await supabase.auth.getSession()
// Returns current session or null
```

5. **Listen to Auth Changes**:
```typescript
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN') {
    // User signed in
  } else if (event === 'SIGNED_OUT') {
    // User signed out
  }
})
```

**Guest Mode**:
- Stored in localStorage (not database-backed)
- No data persistence
- Prompts user to sign up to save work

---

## Environment Variables

### Required Variables

**File**: `.env` (not committed to git)

```bash
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# API Keys (Server-side)
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=AIza...
PUBMED_API_KEY=optional-pubmed-key
PUBMED_EMAIL=your-email@example.com
```

**Vercel Deployment**:
- Environment variables configured in Vercel dashboard
- Automatic injection into serverless functions
- Separate environments for development/production

---

## API Rate Limiting

### PubMed
- **Without API key**: 3 requests/second
- **With API key**: 10 requests/second
- **Implementation**: 350ms delay between requests

### ClinicalTrials.gov
- **Limit**: Not publicly documented
- **Conservative approach**: Sequential requests with delays

### Anthropic Claude
- **Limit**: Tier-based (check dashboard)
- **Implementation**: Error handling with retry logic

### Google Gemini
- **Limit**: Free tier quotas apply
- **Implementation**: Error handling with fallback

---

## Error Handling Patterns

### Standard Error Response
```typescript
return res.status(500).json({
  error: 'Brief error message',
  details: error.message || 'Unknown error'
})
```

### HTTP Status Codes
- `200`: Success
- `400`: Bad request (missing required fields)
- `405`: Method not allowed (non-POST to POST endpoint)
- `500`: Internal server error (external API failure, processing error)

### Retry Logic
```typescript
async function fetchWithRetry(url: string, options: any, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options)
      if (response.ok) return response
    } catch (error) {
      if (i === maxRetries - 1) throw error
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
    }
  }
}
```

---

## Security Considerations

### API Key Protection
- ✅ All API keys stored in environment variables
- ✅ Never exposed to client-side code
- ✅ Server-side functions act as proxies

### CORS Configuration
```typescript
res.setHeader('Access-Control-Allow-Origin', '*')
res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
```

### Input Validation
```typescript
if (!query || query.trim().length === 0) {
  return res.status(400).json({ error: 'Query is required' })
}
```

### SQL Injection Prevention
- ✅ Supabase client uses parameterized queries
- ✅ No raw SQL construction from user input

### Row-Level Security (RLS)
```sql
-- Users can only access their own data
CREATE POLICY "Users own their market maps"
  ON market_maps
  FOR ALL
  USING (auth.uid() = user_id);
```

---

## Performance Optimizations

### 1. Parallel API Calls
```typescript
// Execute multiple searches simultaneously
const [primaryResult, alternativeResult, broadResult] = await Promise.all([
  searchTrials(enhancedQueries.primary),
  searchTrials(enhancedQueries.alternative),
  searchTrials(enhancedQueries.broad)
])
```

### 2. Batch Processing
```typescript
// Process trials in batches to respect rate limits
const batchSize = 5
for (let i = 0; i < trials.length; i += batchSize) {
  const batch = trials.slice(i, i + batchSize)
  const batchResults = await Promise.all(batch.map(processTrial))
  results.push(...batchResults)
  
  // Delay between batches
  if (i + batchSize < trials.length) {
    await new Promise(resolve => setTimeout(resolve, 2000))
  }
}
```

### 3. Response Caching
- Client-side caching of search results
- No server-side caching (data freshness priority)

### 4. Efficient Field Selection
```typescript
// Request only needed fields from ClinicalTrials.gov
queryParams.append('fields', [
  'NCTId', 'BriefTitle', 'OverallStatus', 'Phase',
  'Condition', 'InterventionName', 'LeadSponsorName'
].join(','))
```

---

## Deployment

### Vercel Deployment

**Configuration**: `vercel.json`
```json
{
  "functions": {
    "api/**/*.ts": {
      "runtime": "nodejs18.x",
      "maxDuration": 30
    }
  }
}
```

**Deployment Process**:
1. Push code to GitHub
2. Vercel auto-deploys from main branch
3. Environment variables injected
4. Functions deployed to edge network

**Function URLs**:
- Production: `https://yourdomain.com/api/endpoint`
- Preview: `https://deployment-id.vercel.app/api/endpoint`

---

## Monitoring & Logging

### Vercel Logs
- Real-time function logs in Vercel dashboard
- Request/response logging
- Error tracking with stack traces

### Console Logging Strategy
```typescript
console.log('Starting operation with params:', params)
console.error('Error occurred:', error)
console.log('Operation completed successfully')
```

### Recommended Monitoring
- **Sentry**: Error tracking and alerting
- **LogRocket**: Session replay for debugging
- **Datadog**: APM and performance monitoring

---

## Testing Strategy

### Unit Testing
```typescript
// Example: Test API response parsing
describe('parseArticlesXML', () => {
  it('should extract article data from XML', () => {
    const xml = '<PubmedArticle>...</PubmedArticle>'
    const result = parseArticlesXML(xml)
    expect(result).toHaveLength(1)
    expect(result[0].pmid).toBe('12345678')
  })
})
```

### Integration Testing
```typescript
// Example: Test API endpoint
describe('POST /api/search-clinical-trials', () => {
  it('should return trials for valid query', async () => {
    const response = await fetch('/api/search-clinical-trials', {
      method: 'POST',
      body: JSON.stringify({ query: 'diabetes' })
    })
    expect(response.ok).toBe(true)
    const data = await response.json()
    expect(data.trials).toBeDefined()
  })
})
```

---

## Future Backend Enhancements

1. **Caching Layer**: Redis for frequently accessed data
2. **Background Jobs**: Queue system for long-running tasks
3. **GraphQL API**: Replace REST with GraphQL for flexible queries
4. **Real-time Updates**: WebSocket support for live data
5. **Analytics**: Track search patterns and popular queries
6. **API Versioning**: Support multiple API versions
7. **Advanced Rate Limiting**: Per-user quotas
8. **Data Warehousing**: Historical data analysis
9. **Machine Learning**: Predictive trial success scoring
10. **Webhook Integration**: Notifications for trial updates

