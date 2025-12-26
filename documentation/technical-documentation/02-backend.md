LATEST UPDATE: 11/23/25

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

**File**: `api/search.ts` (Consolidated search API)

**Endpoint**: `POST /api/search?type=trials`

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

**Query Building with LLM Parsing**:

The API uses LLM-powered query parsing to intelligently construct structured ClinicalTrials.gov API v2 parameters:

```typescript
// LLM parses natural language into structured parameters
// Input: "Phase 3 semaglutide obesity trials that are recruiting"
// Output:
{
  "query.cond": "obesity",
  "query.intr": "semaglutide", 
  "query.term": "AREA[Phase](Phase 3)",
  "filter.overallStatus": "RECRUITING,ACTIVE_NOT_RECRUITING"
}
```

**Supported API v2 Parameters**:
- `query.cond` - Medical condition (e.g., "obesity", "diabetes")
- `query.intr` - Intervention/drug name (e.g., "semaglutide")
- `query.term` - General search terms with AREA syntax for phase
- `query.locn` - Geographic location
- `filter.overallStatus` - Trial status (RECRUITING, ACTIVE_NOT_RECRUITING, etc.)
- `query.patient` - Patient population (adult, child, etc.)

**Example Well-Formed Query**:
```
https://clinicaltrials.gov/api/v2/studies?query.cond=obesity&query.intr=semaglutide&query.term=AREA[Phase](Phase%203)&filter.overallStatus=RECRUITING&pageSize=20
```

**Fallback**: If LLM parsing fails, falls back to direct query string matching.

**External API Call**:
```
GET https://clinicaltrials.gov/api/v2/studies?[structured-parameters]&fields=...
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

**File**: `api/search.ts` (Consolidated search API)

**Endpoint**: `POST /api/search?type=papers`

**Purpose**: Proxy to PubMed E-utilities API

**Request Body**:
```typescript
interface PubMedSearchRequest {
  query: string         // PubMed search query  
  maxResults?: number   // Max papers to return (default: 20)
  startDate?: string    // Filter by publication date
  endDate?: string      // Filter by publication date
  enhanceQuery?: boolean // Use LLM to optimize query (default: false)
}
```

**Response**:
```typescript
{
  papers: PubMedArticle[]  // Array of formatted paper objects
}
```

**LLM Query Enhancement** (optional):

When `enhanceQuery: true`, the API uses Gemini to construct optimized PubMed E-Utilities syntax:

**Example Transformations**:
```
Input:  "Phase 3 semaglutide obesity trials"
Output: semaglutide[Title/Abstract] AND obesity[Title/Abstract] AND 
        ("Clinical Trial, Phase III"[Publication Type] OR "Clinical Trial"[Publication Type])

Input:  "GLP-1 receptor agonist diabetes"
Output: ("GLP-1 receptor agonist"[Title/Abstract] OR "glucagon-like peptide-1"[Title/Abstract]) AND 
        diabetes[Title/Abstract] AND 
        ("Clinical Trial"[Publication Type] OR "Randomized Controlled Trial"[Publication Type])
```

**Query Enhancement Features**:
- Field tags: `[Title/Abstract]`, `[Publication Type]`, `[MeSH Terms]`
- Boolean operators: `AND`, `OR`, `NOT`
- Phrase matching with quotes
- Clinical trial publication type filters
- Synonym expansion (e.g., "GLP-1" → "glucagon-like peptide-1")

**Fallback**: If LLM unavailable or enhancement fails, uses original query string.

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

### 3. AI Query Enhancement & Parsing

**File**: `api/enhance-search.ts`

**Endpoint**: `POST /api/enhance-search`

**Purpose**: Generate phrase-based discovery strategies using Google Gemini API

**Implementation Note**: The system uses LLM-powered query parsing to intelligently construct well-formed API calls to external services. This replaced manual code-based query parsing.

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
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
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

### 4a. Drug Deduplication (Nov 23, 2025)

**File**: `api/deduplicate-drugs.ts`

**Endpoint**: `POST /api/deduplicate-drugs`

**Purpose**: Server-side drug deduplication using Gemini LLM to identify duplicate drugs with different names (e.g., "Ozempic" and "Semaglutide")

**Background - The Problem**: 

Users were intermittently seeing this error:
```
Gemini API key not configured for drug deduplication
⚠️ Deduplication failed, using basic deduplication
```

Root cause was in `src/services/extractDrugNames.ts` attempting to access Gemini API key directly in the browser:
```typescript
const geminiApiKey = import.meta.env.VITE_GOOGLE_GEMINI_API_KEY; // ❌ Browser-side access
```

**Three critical issues:**
1. **Security**: Gemini API key exposed to client-side code (visible in browser network requests)
2. **Configuration**: API key set as `GOOGLE_GEMINI_API_KEY` (server-side only, no `VITE_` prefix)
3. **Architecture Inconsistency**: All other Gemini calls were server-side, but deduplication was client-side

**Why It Was Intermittent**: Error only occurred when multiple drugs triggered deduplication. Basic fallback worked silently, masking the issue.

**The Solution**: Created secure server-side endpoint following established patterns (`/api/extract-drug-names`, `/api/enhance-search`).

**Architecture Comparison**:

Before (❌ Insecure):
```
Browser → Access import.meta.env.VITE_GOOGLE_GEMINI_API_KEY
       → Call Gemini API directly (key exposed)
       → Parse response (147 lines of client code)
```

After (✅ Secure):
```
Browser → POST /api/deduplicate-drugs (no key needed)
Server  → Access process.env.GOOGLE_GEMINI_API_KEY (secure)
        → Call Gemini API server-side
        → Return deduplicated drugs
Browser → Receive results (27 lines of client code)
```

**Client-Side Simplification**: Reduced `extractDrugNames.ts` deduplication method from 147 lines to 27 lines by offloading to server.

**Request Body**:
```typescript
{
  drugs: Array<{
    name: string              // Drug name
    type?: string             // Drug type (optional)
    confidence?: number       // Confidence score (optional)
    brandNames?: string[]     // Brand names (optional)
    mechanism?: string        // Mechanism of action (optional)
  }>
}
```

**Response**:
```typescript
{
  success: boolean
  drugs: DrugInfo[]           // Deduplicated drug array
  originalCount: number       // Count before deduplication
  deduplicatedCount: number   // Count after deduplication
  error?: string              // Error message if failed
}
```

**Deduplication Logic**:

1. **Small List Optimization**: If ≤2 drugs, return as-is (no deduplication needed)

2. **LLM-Based Deduplication**: Use Gemini to identify semantic duplicates
   ```typescript
   const prompt = `You are a pharmaceutical expert. Deduplicate this list of drugs:
   
   ${drugNames.map((name, i) => `${i + 1}. ${name}`).join('\n')}
   
   Instructions:
   - Identify drugs that refer to the same compound (generic/brand name pairs)
   - Keep generic name as primary identifier
   - Remove true duplicates
   - Return ONLY valid JSON array of unique drug names
   
   Example:
   Input: ["Ozempic", "Semaglutide", "Wegovy", "Metformin"]
   Output: ["Semaglutide", "Metformin"]  // Ozempic and Wegovy are brand names of Semaglutide
   `
   ```

3. **Response Reconstruction**: Match deduplicated names back to original `DrugInfo` objects
   - Find original object by normalized name matching
   - Preserve all metadata (type, confidence, mechanism, brandNames)

**Error Handling**:
- HTTP 405: Method not allowed (non-POST)
- HTTP 400: Missing or invalid `drugs` array
- HTTP 500: Missing API key or Gemini API error
- Fallback: Return original list if deduplication fails

**Usage Flow**:

```typescript
// Client-side call (src/services/extractDrugNames.ts)
private static async deduplicateDrugs(drugs: DrugInfo[]): Promise<DrugInfo[]> {
  const response = await fetch('/api/deduplicate-drugs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ drugs })
  })
  
  const data = await response.json()
  console.log(`✅ LLM deduplication: ${data.originalCount} → ${data.deduplicatedCount} drugs`)
  return data.drugs
}
```

**Before/After Migration**:

**Before (Nov 22)**: Client-side deduplication
```typescript
// ❌ API key exposed in browser
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GOOGLE_GEMINI_API_KEY)
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })
const result = await model.generateContent(prompt)
```

**After (Nov 23)**: Server-side deduplication
```typescript
// ✅ API key secured on server
const response = await fetch('/api/deduplicate-drugs', {
  method: 'POST',
  body: JSON.stringify({ drugs })
})
```

**User Impact**:

Before Fix:
- ❌ Intermittent error messages in console
- ❌ Deduplication silently falling back to basic mode
- ❌ Duplicate drugs appearing (e.g., "Keytruda" and "Pembrolizumab" listed separately)

After Fix:
- ✅ No error messages (deduplication works reliably)
- ✅ Advanced LLM-based deduplication always active
- ✅ Cleaner drug lists with brand/generic names properly merged

**Benefits**:
- **Security**: API key never exposed to client (prevents credential leakage in browser network tab)
- **Reliability**: Error eliminated by using proper server-side configuration
- **Architecture**: Consistent with other API endpoints (all Gemini calls now server-side)
- **Code Quality**: 120-line reduction in client code (147 → 27 lines)
- **Testability**: Endpoint can be unit tested with mocked Gemini responses
- **Maintainability**: Cleaner separation of concerns (API logic on server, business logic on client)

**Testing**:
- Unit tests: `api/__tests__/deduplicate-drugs.test.ts` (10 test cases covering edge cases)
  - Non-POST requests rejected
  - Missing drugs array validation
  - Single drug bypass (no deduplication needed)
  - Gemini API integration
  - JSON parsing edge cases (markdown code blocks)
  - Error handling (API failures, invalid JSON)
  - Source combination when merging
  - Confidence preservation
- Integration: Tested via `extractDrugNames.ts` service in production flow

**Environment Configuration**:

No changes needed! Existing `GOOGLE_GEMINI_API_KEY` environment variable (without `VITE_` prefix) works correctly because it's now only accessed server-side.

```bash
# .env or Vercel environment variables
GOOGLE_GEMINI_API_KEY=your_gemini_api_key_here
```

**Important**: Do NOT add `VITE_GOOGLE_GEMINI_API_KEY` - this would expose the key to the browser.

---

### 6. AI Conversational Response (HW8 ABC-57)

**File**: `api/generate-response.ts`

**Endpoint**: `POST /api/generate-response`

**Purpose**: Generate contextual AI responses using Claude with intelligent search intent detection

**Request Body**:
```typescript
{
  userQuery: string
  chatHistory?: Array<{  // Optional: Conversation history
    type: 'user' | 'system'
    message: string
  }>
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
  response: string         // Natural language response (metadata stripped)
  shouldSearch: boolean    // Determined by Claude's [SEARCH_INTENT] tag
  searchSuggestions?: Array<{
    id: string
    label: string          // Button text
    query: string          // Search terms from Claude's [SEARCH_TERMS] tag
    description?: string   // Optional explanation
  }>
  intent: 'greeting' | 'search_request' | 'follow_up' | 'clarification' | 'general_question'
}
```

---

#### HW8 ABC-57: Metadata-First Architecture

**Key Innovation**: Instead of parsing natural language or using regex, Claude embeds structured metadata directly in its response for reliable parsing.

**Metadata Format**:
```
[SEARCH_INTENT: yes/no]
[SEARCH_TERMS: terms to search for, or "none"]
Your natural language response here.
```

**Example Responses**:
```
User: "GLP-1"
Claude Response:
[SEARCH_INTENT: yes]
[SEARCH_TERMS: GLP-1 agonists]
I can search for research on GLP-1 agonists.

User: "Hi there"
Claude Response:
[SEARCH_INTENT: no]
[SEARCH_TERMS: none]
Hey! How can I help you today?
```

**Benefits**:
1. **Reliable Parsing**: Regex extraction of `[SEARCH_INTENT: yes/no]` is deterministic
2. **Context-Aware**: Claude uses full conversation context to determine intent
3. **Accurate Search Terms**: AI extracts medical terms better than regex
4. **Testable**: Clear contract between AI and application code

---

#### Chat Helper Functions

**File**: `api/utils/chatHelpers.ts`

Contains all prompt building and message formatting logic:

**1. System Prompt Builder**:
```typescript
export function buildSystemPrompt(contextPapers?: ContextPaper[]): string
```

Without context papers:
```typescript
const systemPrompt = `You are a thoughtful medical research consultant having a natural conversation with a user.

CRITICAL RULES:
1. ACTUALLY READ what the user just said - respond to their ACTUAL message
2. If they ask you a question, ANSWER IT directly first
3. If they challenge you or seem frustrated, acknowledge it
4. Be conversational and human-like, not robotic
5. Only ask about research specifics when they've clearly expressed interest

HW8 ABC-57: RESPONSE FORMAT
IMPORTANT: Start your response with metadata tags, then your message:

[SEARCH_INTENT: yes/no]
[SEARCH_TERMS: terms to search for, or "none"]
Your response here.

CRITICAL: If SEARCH_INTENT is yes, keep your response to 1-2 sentences.

Examples:
If user says "GLP-1": 
[SEARCH_INTENT: yes]
[SEARCH_TERMS: GLP-1 agonists]
I can search for research on GLP-1 agonists.

If user says "Hi there":
[SEARCH_INTENT: no]
[SEARCH_TERMS: none]
Hey! How can I help you today?
`
```

With context papers (for paper analysis view):
```typescript
// Builds citation-numbered paper context
`[1] Paper Title
Authors: Smith J, Doe A et al.
Journal: Nature Medicine (2024)
PMID: 12345678
Abstract: ...

INSTRUCTIONS FOR USING PAPERS:
- When referencing a paper, cite it using [1], [2], etc.
- Only cite papers when relevant to the user's question
- Be natural and conversational
`
```

**2. Message History Builder**:
```typescript
export function buildMessagesFromHistory(
  chatHistory: ChatMessage[],
  currentQuery: string
): Array<{ role: 'user' | 'assistant'; content: string }>
```

Constructs proper Anthropic Messages API format:
```typescript
const messages = [
  // Last 6 messages from history
  { role: 'user', content: 'Previous user message' },
  { role: 'assistant', content: 'Previous assistant message' },
  // ...
  // Current query with format reminder appended
  { 
    role: 'user', 
    content: `${currentQuery}

[Remember: Start your response with [SEARCH_INTENT: yes/no] and [SEARCH_TERMS: ...] tags]`
  }
]
```

**Format Reminder Strategy**: Appends reminder to every user message to reinforce the metadata requirement.

---

#### Claude API Call

**Anthropic Messages API**:
```typescript
const conversationalResponse = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': process.env.ANTHROPIC_API_KEY,
    'anthropic-version': '2023-06-01'
  },
  body: JSON.stringify({
    model: 'claude-3-haiku-20240307',
    max_tokens: 200,  // Balanced for metadata + brief response
    temperature: 0.7,
    system: buildSystemPrompt(contextPapers),  // Papers persist in system prompt
    messages: buildMessagesFromHistory(chatHistory, userQuery)
  })
})
```

**Key Parameters**:
- `max_tokens: 200` - Encourages brevity while allowing metadata + response
- `temperature: 0.7` - Balanced between consistency and natural variation
- `system` - Contains conversational rules and metadata format instructions
- `messages` - Conversation history + current query with format reminder

---

#### Metadata Parsing

**Extract Metadata from Claude Response**:
```typescript
let conversationalResult = conversationalData.content[0].text

// Extract search intent
const searchIntentMatch = conversationalResult.match(/\[SEARCH_INTENT:\s*(yes|no)\]/i)
const claudeSearchIntent = searchIntentMatch ? searchIntentMatch[1].toLowerCase() === 'yes' : null

// Extract search terms
const searchTermsMatch = conversationalResult.match(/\[SEARCH_TERMS:\s*(.+?)\]/i)
const claudeSearchTerms = searchTermsMatch ? searchTermsMatch[1].trim() : null

// Remove metadata from user-facing response
conversationalResult = conversationalResult
  .replace(/\[SEARCH_INTENT:\s*(yes|no)\]/gi, '')
  .replace(/\[SEARCH_TERMS:\s*.+?\]/gi, '')
  .trim()

// Clean up stage directions (e.g., "*smiles*", "*responds warmly*")
conversationalResult = conversationalResult
  .replace(/\*[^*]+\*/g, '')
  .trim()
```

**Generate Search Suggestions**:
```typescript
const shouldSearch = claudeSearchIntent === true
const searchSuggestions = shouldSearch && claudeSearchTerms && claudeSearchTerms !== 'none' 
  ? [{
      id: 'search-1',
      label: `Search for ${claudeSearchTerms}`,
      query: claudeSearchTerms,
      description: `Find clinical trials and research papers about ${claudeSearchTerms}`
    }]
  : []
```

---

#### Search Results Response

When `searchResults` are provided (after a search completes):

```typescript
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
2. Summarize findings engagingly
3. Highlight interesting insights
4. Mention both trials and papers
5. Professional but conversational tone

Keep concise (2-3 sentences).
`
```

This bypasses the metadata system and returns a direct summary response.

---

#### Comprehensive Test Suite (HW8 ABC-57)

**Unit Tests**: `api/utils/__tests__/chatHelpers.test.ts` (232 lines)
- Tests system prompt includes metadata format instructions
- Tests format reminders are appended to user messages
- Tests prompt structure and examples
- Validates brevity instructions

**Integration Tests**: `api/__tests__/generate-response.abc57.test.ts` (296 lines)
- **17 comprehensive tests** with real Claude API calls
- **Positive cases** (5 tests): Medical queries that should trigger search
  - "What's the latest on semaglutide for obesity?"
  - "Tell me about GLP-1 agonists in diabetes trials"
  - "Has anyone studied pembrolizumab in melanoma?"
- **Negative cases** (5 tests): Conversational queries that shouldn't trigger search
  - "Hello, how are you?"
  - "Thanks for that information"
  - "What does phase 3 mean?"
- **Edge cases** (3 tests): Mixed intent and context awareness
  - "Hi, I want to know about checkpoint inhibitors" (should search)
  - "What did you mean about semaglutide?" (clarification, shouldn't search)
- **Response quality** (2 tests): Brevity enforcement
- **Known bugs** (1 test): Documents Claude verbosity issue

**Running Tests**:
```bash
npm test api/__tests__/generate-response.abc57.test.ts
```

**Test Coverage**:
- ✅ Search intent detection accuracy
- ✅ Search term extraction quality
- ✅ Metadata format compliance
- ✅ Context awareness (conversation history)
- ✅ Response brevity (with known failures documented)

---

#### Known Issues (HW8 ABC-57)

**Bug: Claude Ignores Brevity Instructions**

**Desired Behavior**: When `SEARCH_INTENT: yes`, response should be 1-2 sentences (~20 words)

**Actual Behavior**: Claude often provides 50-60+ word explanations despite explicit instructions

**Example**:
```
User: "I'm trying to understand GLP-1s"
Expected: "I can search for GLP-1 research."
Actual: "GLP-1 receptor agonists are a class of medications primarily used for treating type 2 diabetes and obesity. They work by mimicking the action of the GLP-1 hormone, which stimulates insulin secretion and reduces appetite. I can search for the latest clinical trials and research papers on GLP-1 agonists if you'd like."
```

**Documented In**: Test "KNOWN BUG: documents that Claude ignores brevity instruction"

**Potential Solutions**:
1. Further reduce `max_tokens` (currently 200)
2. Add stronger stop sequences
3. Try different Claude models (Opus vs Haiku)
4. Post-process to truncate long responses
5. Use structured output mode (if available in Claude API)

**Workaround**: Frontend can truncate responses or the metadata parsing is reliable enough that verbose responses don't break functionality

---

#### Migration from Previous Version

**Old Approach** (Pre-ABC-57):
- Two-stage processing: intent classification, then response generation
- Regex-based search term extraction
- Separate API calls for intent and response

**New Approach** (ABC-57):
- Single API call with metadata embedded in response
- AI-powered search term extraction
- More context-aware with conversation history
- Better handling of edge cases (greetings with search intent)

**Breaking Changes**: None - response format remains compatible

---

### 7. Slide Generation

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

### 8. PDF Table Extraction

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

## Client-Side Services

### Project Service (Nov 8, 2025)

**File**: `src/services/projectService.ts`

**Purpose**: Client-side service for managing projects in Supabase database

**Implementation**: Direct Supabase client calls (no backend proxy needed)

#### Interface

```typescript
interface Project {
  id: number
  user_id: string
  name: string
  description?: string
  chat_history?: any[] // Array of chat messages (persisted across sessions)
  created_at: string
  updated_at: string
}
```

#### Functions

**1. Create Project**

```typescript
export async function createProject(name: string, description?: string): Promise<Project>
```

- Creates a new project for the authenticated user
- Automatically sets `user_id` from current session
- Returns the created project with generated `id`
- Includes comprehensive logging for debugging

**Example**:
```typescript
const project = await createProject('GLP-1 Research Q3 2025', 'Obesity treatment landscape')
console.log(project.id) // 1
```

**2. Get User Projects**

```typescript
export async function getUserProjects(): Promise<Project[]>
```

- Fetches all projects for the current user
- Sorted by `updated_at` descending (most recent first)
- Protected by RLS (users only see their own projects)

**3. Get Single Project**

```typescript
export async function getProject(id: number): Promise<Project | null>
```

- Fetches a specific project by ID
- Returns `null` if not found
- RLS ensures users can only access their own projects

**4. Update Project**

```typescript
export async function updateProject(
  id: number, 
  updates: { name?: string, description?: string }
): Promise<Project>
```

- Updates project fields
- Automatically updates `updated_at` timestamp
- Returns updated project

**5. Delete Project**

```typescript
export async function deleteProject(id: number): Promise<void>
```

- Deletes a project by ID
- RLS ensures users can only delete their own projects

**6. Save Chat History**

```typescript
export async function saveChatHistory(projectId: number, chatHistory: any[]): Promise<void>
```

- Saves chat conversation history to the `projects.chat_history` column
- Auto-updates `updated_at` timestamp
- Used for persisting chat across sessions
- Supports debounced auto-save (triggered every 2 seconds in Dashboard)

**Example**:
```typescript
const chatHistory = [
  { type: 'user', message: 'Search for GLP-1 trials' },
  { type: 'system', message: 'I found 206 trials...', searchSuggestions: [...] }
]
await saveChatHistory(projectId, chatHistory)
```

**7. Load Chat History**

```typescript
export async function loadChatHistory(projectId: number): Promise<any[]>
```

- Loads saved chat history for a project
- Returns empty array if no history or on error
- Called on project mount and project switch
- Supports seamless restoration of conversation context

**Example**:
```typescript
const chatHistory = await loadChatHistory(projectId)
if (chatHistory.length > 0) {
  console.log(`Restored ${chatHistory.length} messages`)
  setChatHistory(chatHistory)
}
```

#### Security

- All functions require authentication
- RLS policies enforce user isolation:
  - Users can only view their own projects
  - Users can only create projects for themselves
  - Users can only update/delete their own projects
- No API proxy needed - Supabase client handles authentication via JWT

#### Logging

All functions include comprehensive emoji-based logging:
- 🔵 `[ProjectService]` - Operation logs
- ✅ Success logs with returned data
- ❌ Error logs with detailed error information

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

