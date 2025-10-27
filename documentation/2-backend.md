LATEST UPDATE: 10/26/25

# ABCresearch - Backend Documentation

## Architecture Overview

The backend follows a **serverless architecture** using Vercel Functions as API proxies. All business logic resides client-side in services, while backend functions handle external API communication, authentication, and database operations.

## Backend Philosophy

### API Proxies Pattern

**Purpose**: Server-side functions act purely as proxies to external services
- Handle CORS issues
- Protect API keys
- Manage rate limiting
- Format responses
- No business logic (kept client-side)
- No data transformation beyond basic formatting

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

**Purpose**: Generate phrase-based discovery strategies using Google Gemini API

**Request Body**:
```typescript
{
  query: string           // User's natural language query
  searchType?: string     // 'initial' (default) or 'drug-specific' (deprecated)
  context?: string        // Additional context
}
```

**Response**:
```typescript
{
  success: boolean
  strategies: SearchStrategy[]  // EXACTLY 5 phrase-based strategies
  totalStrategies: number
}

interface SearchStrategy {
  query: string                // Phrase-based search query (NOT drug names)
  description: string          // What types of drugs this will uncover
  priority: 'high' | 'medium' | 'low'
  searchType: 'mechanism' | 'indication' | 'stage' | 'synonym' | 'broad'
}
```

**Discovery-Focused AI Prompt Strategy**:
```typescript
const prompt = `You are a medical research expert specializing in drug discovery through clinical trial searches.

USER QUERY: "${query}"

Your goal is to DISCOVER drugs across all development stages (preclinical, Phase 1-4, approved) by searching for CONCEPTS and PHRASES, not specific drug names.

Generate EXACTLY 5 search strategies that cast a wide net to uncover drugs. Focus on:

1. Therapeutic mechanisms (e.g., "GLP-1 receptor agonist", "PD-1 inhibitor")
2. Disease + mechanism (e.g., "diabetes incretin", "obesity GLP-1")
3. Development stage + mechanism (e.g., "Phase 3 GLP-1", "novel incretin mimetic")
4. Alternative terminology (e.g., "glucagon-like peptide", "incretin-based therapy")
5. Broad discovery (e.g., "anti-obesity agent", "glucose-lowering therapy")

CRITICAL RULES:
- DO NOT search for specific drug names (e.g., NOT "semaglutide" or "tirzepatide")
- DO search for drug CLASSES, MECHANISMS, INDICATIONS, CONCEPTS
- Focus on discovering UNKNOWN/EMERGING drugs
- Each query should discover different subsets of drugs
- Limit to EXACTLY 5 strategies

Return ONLY a valid JSON array with EXACTLY 5 strategies (no markdown):
[
  {
    "query": "phrase here (no drug names)",
    "description": "discovers X type of drugs",
    "priority": "high|medium|low",
    "searchType": "mechanism|indication|stage|synonym|broad"
  }
]
`
```

**Gemini API Call**:
```typescript
const response = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,  // Low temperature for consistent results
        maxOutputTokens: 2000  // Increased for 5 strategies
      }
    })
  }
)
```

**Key Changes from Previous Version**:
- Changed from 3 strategies to **5 phrase-based discovery strategies**
- Focus on discovering drugs (not searching for known drugs)
- Strategies are phrases/concepts, not drug-specific searches
- Returns array format instead of object with primary/alternative/broad

**Response Cleaning**:
```typescript
// Remove markdown code blocks
let cleanedText = responseText.trim()
if (cleanedText.startsWith('```json')) {
  cleanedText = cleanedText
    .replace(/^```json\s*/, '')
    .replace(/\s*```$/, '')
}

// Extract JSON array or object
const jsonMatch = cleanedText.match(/\[[\s\S]*\]|\{[\s\S]*"strategies"[\s\S]*\}/)
if (jsonMatch) {
  const parsed = JSON.parse(jsonMatch[0])
  // Handle both array and object responses
  const strategies = Array.isArray(parsed) ? parsed : parsed.strategies
  return { success: true, strategies, totalStrategies: strategies.length }
}
```

---

### 4. Drug Name Extraction

**File**: `api/extract-drug-names.ts`

**Endpoint**: `POST /api/extract-drug-names`

**Purpose**: Extract drug names from clinical trials and papers using Gemini API

**Request Body**:
```typescript
{
  texts: string[]     // Array of text snippets (titles, abstracts, interventions)
  userQuery?: string  // Original user query for context-aware extraction
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
  contextPapers?: Array<{  // Optional: Papers selected as context
    pmid: string
    title: string
    abstract: string
    journal: string
    publicationDate: string
    authors: string[]
  }>
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

// Build context papers section if available
let contextSection = ''
if (contextPapers && contextPapers.length > 0) {
  contextSection = `\n\nThe user has selected ${contextPapers.length} paper(s) as relevant context:\n\n`
  contextPapers.forEach((paper, index) => {
    contextSection += `Paper ${index + 1}:
Title: ${paper.title}
Journal: ${paper.journal}
Publication Date: ${paper.publicationDate}
Authors: ${paper.authors.slice(0, 3).join(', ')}${paper.authors.length > 3 ? ' et al.' : ''}
Abstract: ${paper.abstract}
---
`
  })
  contextSection += '\nWhen answering, reference these papers if relevant. Cite by title or as "Paper 1", "Paper 2", etc.'
}

// Otherwise, generate conversational response
const conversationalPrompt = `User said: "${userQuery}"
Intent: ${intentResult.intent}
Response type: ${intentResult.responseType}${contextSection}

Generate appropriate response:
- greeting: Be friendly, explain capabilities
- search_request: Acknowledge, suggest conducting search
- follow_up: Answer follow-up question, referencing context papers if relevant
- clarification: Ask for clarification
- general_question: Answer about capabilities, referencing context papers if relevant

${contextPapers && contextPapers.length > 0 ? 
  'IMPORTANT: The user has provided specific papers for context. If their question relates to these papers, reference them in your response.' : 
  ''}

Keep conversational, helpful, professional. 1-2 sentences max unless analyzing context papers.
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
- All API keys stored in environment variables
- Never exposed to client-side code
- Server-side functions act as proxies

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
- Supabase client uses parameterized queries
- No raw SQL construction from user input

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
**Discovery Search Strategy**:
```typescript
// Execute 5 phrase-based discovery strategies in parallel
const strategyResults = await Promise.all(
  strategies.map(async (strategy) => {
    const result = await searchTrials({ query: strategy.query, pageSize: 50 })
    return {
      strategy,
      count: result.trials.length,
      trials: result.trials
    }
  })
)

// Union all results: ~250 trials → ~150 unique after deduplication
const allTrials = strategyResults.flatMap(r => r.trials)
const uniqueTrials = deduplicateByNCTId(allTrials)
```

**Result**: 5 parallel trial searches + 5 parallel paper searches = 10 API calls complete in 6-8 seconds

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

