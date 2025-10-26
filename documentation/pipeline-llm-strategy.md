# Pipeline Data Extraction: LLM Strategy Plan

## Overview

This document outlines two approaches for using LLMs to extract and populate Asset Development Pipeline data from clinical trials and research papers.

## Current State

- **Pattern-based extraction**: Simple string matching for stage, technology, mechanism
- **Limited accuracy**: Can't understand context or nuance
- **Fixed schema**: Hard to add new columns without code changes
- **No synthesis**: Can't combine information across multiple sources

## Approach 1: Direct LLM Prompting

### Architecture

```
Clinical Trials + Papers (per drug)
    ↓
Aggregate & Format
    ↓
Single LLM API Call (per drug)
    ↓
Structured JSON Response
    ↓
Pipeline Table
```

### Implementation Plan

#### 1.1 Create LLM Extraction API
**File**: `/api/extract-pipeline-data.ts`

```typescript
interface PipelineExtractionRequest {
  drugName: string;
  trials: ClinicalTrial[];
  papers: PubMedArticle[];
  customColumns?: string[]; // User can request additional fields
}

interface PipelineExtractionResponse {
  commercialName?: string;
  scientificName: string;
  sponsorCompany: string;
  stage: PipelineStage;
  technologies: string;
  mechanismOfAction: string;
  indications: string[];
  lastTrialStartDate: string;
  // Dynamic fields
  [key: string]: any;
}
```

**Prompt Template**:
```
You are a pharmaceutical research analyst. Extract structured information about the drug candidate from the provided clinical trials and research papers.

DRUG NAME: {drugName}

CLINICAL TRIALS:
{trials.map(t => `
- NCT ID: ${t.nctId}
- Title: ${t.briefTitle}
- Phase: ${t.phase?.join(', ')}
- Status: ${t.overallStatus}
- Sponsor: ${t.sponsors?.lead}
- Interventions: ${t.interventions?.join(', ')}
- Conditions: ${t.conditions?.join(', ')}
- Start Date: ${t.startDate}
`).join('\n')}

RESEARCH PAPERS (Top 5 most relevant):
{papers.slice(0, 5).map(p => `
- Title: ${p.title}
- Abstract: ${p.abstract}
- Journal: ${p.journal}
- Date: ${p.publicationDate}
`).join('\n')}

Extract the following information:
1. Commercial Name (if marketed, include ™ or ®)
2. Scientific Name (generic/INN name)
3. Sponsor Company (lead organization)
4. Development Stage (Marketed, Phase III, Phase II, Phase I, Pre-Clinical, Discovery)
5. Technologies (Biologics, Small Molecule, Gene Therapy, Cell Therapy, etc.)
6. Mechanism of Action (brief description)
7. Indications (list of diseases/conditions)
8. Last Trial Start Date (most recent)
9. Route of Administration (oral, IV, subcutaneous, etc.)
10. Target Population (adult, pediatric, specific demographics)
11. Safety Profile (key adverse events if mentioned)
12. Competitive Advantage (unique features vs other drugs)

{customColumns.length > 0 && `
ADDITIONAL REQUESTED FIELDS:
${customColumns.map(c => `- ${c}`).join('\n')}
`}

Return ONLY valid JSON in this exact format:
{
  "commercialName": "string or null",
  "scientificName": "string",
  "sponsorCompany": "string",
  "stage": "Marketed|Phase III|Phase II|Phase I|Pre-Clinical|Discovery",
  "technologies": "string",
  "mechanismOfAction": "string",
  "indications": ["string"],
  "lastTrialStartDate": "YYYY-MM-DD",
  "routeOfAdministration": "string",
  "targetPopulation": "string",
  "safetyProfile": "string",
  "competitiveAdvantage": "string"
}
```

#### 1.2 Frontend Service
**File**: `/src/services/pipelineLLMService.ts`

```typescript
export class PipelineLLMService {
  /**
   * Extract pipeline data for all drugs using LLM
   */
  static async extractPipelineData(
    drugGroups: DrugGroup[],
    customColumns?: string[]
  ): Promise<PipelineDrugCandidate[]> {
    const results: PipelineDrugCandidate[] = [];
    
    for (const group of drugGroups) {
      try {
        const response = await fetch('/api/extract-pipeline-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            drugName: group.drugName,
            trials: group.trials,
            papers: group.papers,
            customColumns
          })
        });
        
        const data = await response.json();
        results.push(data);
      } catch (error) {
        console.error(`Failed to extract data for ${group.drugName}:`, error);
        // Fallback to pattern-based extraction
        results.push(PipelineService.fallbackExtraction(group));
      }
    }
    
    return results;
  }
  
  /**
   * Stream extraction for real-time updates
   */
  static async *streamPipelineData(
    drugGroups: DrugGroup[]
  ): AsyncGenerator<PipelineDrugCandidate> {
    for (const group of drugGroups) {
      yield await this.extractSingleDrug(group);
    }
  }
}
```

#### 1.3 UI Integration
- Show loading state per drug as LLM processes
- Display progress bar (1/10 drugs processed...)
- Enable/disable LLM extraction toggle in settings
- Cache results to avoid re-processing

### Pros ✅

1. **High Accuracy**
   - LLM understands context and nuance
   - Can disambiguate complex cases (e.g., combination therapies)
   - Synthesizes information across trials and papers

2. **Flexible Schema**
   - Easy to add new columns via prompt engineering
   - No code changes needed for new fields
   - Users can request custom columns dynamically

3. **Rich Extraction**
   - Can extract complex fields (competitive advantage, safety profile)
   - Understands medical terminology
   - Handles incomplete data gracefully

4. **Simple Implementation**
   - Single API endpoint
   - Straightforward prompt engineering
   - No infrastructure beyond API calls

5. **Explainable**
   - Can ask LLM to cite sources
   - Can request confidence scores
   - Prompt tweaking is intuitive

### Cons ❌

1. **Cost**
   - ~$0.01-0.10 per drug (depending on token count)
   - For 50 drugs: ~$0.50-$5.00 per extraction
   - Adds up with repeated searches

2. **Latency**
   - 3-10 seconds per drug
   - 50 drugs = 2.5-8 minutes total
   - Users must wait for all drugs to process

3. **Rate Limits**
   - OpenAI: 3,500 requests/min (tier dependent)
   - May need queuing system for large datasets
   - Could hit limits with concurrent users

4. **Token Limits**
   - GPT-4: 128k tokens max
   - Large trials/papers may exceed context
   - Need truncation strategy

5. **Consistency**
   - LLM might format data differently
   - Requires strict JSON parsing
   - May hallucinate missing data

6. **No Persistence**
   - Re-processes on every search
   - Can't query historical data
   - No cross-drug analysis

---

## Approach 2: RAG Database

### Architecture

```
Clinical Trials + Papers
    ↓
Chunk & Embed
    ↓
Vector Database (Pinecone/Supabase Vector)
    ↓
Query with Column Names
    ↓
Retrieved Relevant Chunks
    ↓
LLM Synthesis
    ↓
Pipeline Table
```

### Implementation Plan

#### 2.1 Database Schema
**Using Supabase with pgvector extension**

```sql
-- Documents table (trials and papers)
CREATE TABLE pipeline_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drug_name TEXT NOT NULL,
  source_type TEXT NOT NULL, -- 'trial' or 'paper'
  source_id TEXT NOT NULL, -- NCT ID or PMID
  title TEXT,
  content TEXT NOT NULL, -- Full text or abstract
  metadata JSONB, -- trial phase, sponsor, date, etc.
  embedding vector(1536), -- OpenAI ada-002 embeddings
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for fast similarity search
CREATE INDEX ON pipeline_documents 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Index for drug lookups
CREATE INDEX idx_drug_name ON pipeline_documents(drug_name);
CREATE INDEX idx_source ON pipeline_documents(source_type, source_id);

-- Extracted pipeline data cache
CREATE TABLE pipeline_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drug_name TEXT NOT NULL UNIQUE,
  data JSONB NOT NULL, -- Full pipeline data
  source_doc_ids UUID[], -- Reference to documents used
  extracted_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '30 days'
);

-- Custom columns config
CREATE TABLE pipeline_columns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  column_name TEXT NOT NULL,
  column_description TEXT,
  query_template TEXT, -- RAG query for this column
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### 2.2 Ingestion Pipeline
**File**: `/api/ingest-pipeline-docs.ts`

```typescript
import { OpenAI } from 'openai';
import { supabase } from '@/lib/supabase';

export async function ingestDocuments(
  drugName: string,
  trials: ClinicalTrial[],
  papers: PubMedArticle[]
) {
  const openai = new OpenAI();
  const documents = [];
  
  // Process trials
  for (const trial of trials) {
    const content = `
      Trial: ${trial.briefTitle}
      Phase: ${trial.phase?.join(', ')}
      Status: ${trial.overallStatus}
      Sponsor: ${trial.sponsors?.lead}
      Interventions: ${trial.interventions?.join(', ')}
      Conditions: ${trial.conditions?.join(', ')}
      Start Date: ${trial.startDate}
      Description: ${trial.officialTitle}
    `.trim();
    
    // Generate embedding
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: content
    });
    
    documents.push({
      drug_name: drugName,
      source_type: 'trial',
      source_id: trial.nctId,
      title: trial.briefTitle,
      content,
      metadata: {
        phase: trial.phase,
        status: trial.overallStatus,
        sponsor: trial.sponsors?.lead,
        start_date: trial.startDate
      },
      embedding: embeddingResponse.data[0].embedding
    });
  }
  
  // Process papers (similar approach)
  for (const paper of papers.slice(0, 10)) { // Limit to top 10
    const content = `
      Title: ${paper.title}
      Abstract: ${paper.abstract}
      Journal: ${paper.journal}
      Date: ${paper.publicationDate}
      Authors: ${paper.authors?.join(', ')}
    `.trim();
    
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: content
    });
    
    documents.push({
      drug_name: drugName,
      source_type: 'paper',
      source_id: paper.pmid,
      title: paper.title,
      content,
      metadata: {
        journal: paper.journal,
        date: paper.publicationDate
      },
      embedding: embeddingResponse.data[0].embedding
    });
  }
  
  // Batch insert into Supabase
  const { error } = await supabase
    .from('pipeline_documents')
    .upsert(documents, { 
      onConflict: 'source_type,source_id',
      ignoreDuplicates: false 
    });
    
  if (error) throw error;
  
  return documents.length;
}
```

#### 2.3 RAG Query Service
**File**: `/src/services/pipelineRAGService.ts`

```typescript
export class PipelineRAGService {
  /**
   * Query RAG database for a specific column
   */
  static async queryColumn(
    drugName: string,
    columnName: string,
    columnDescription: string
  ): Promise<string> {
    // Generate query embedding
    const queryText = `${columnName} for ${drugName}: ${columnDescription}`;
    const embeddingResponse = await fetch('/api/generate-embedding', {
      method: 'POST',
      body: JSON.stringify({ text: queryText })
    });
    const { embedding } = await embeddingResponse.json();
    
    // Vector similarity search
    const { data: documents } = await supabase
      .rpc('match_pipeline_documents', {
        query_embedding: embedding,
        match_drug_name: drugName,
        match_threshold: 0.7,
        match_count: 5
      });
    
    // Synthesize answer with LLM
    const context = documents
      .map(d => `[${d.source_type.toUpperCase()}] ${d.content}`)
      .join('\n\n---\n\n');
    
    const response = await fetch('/api/generate-response', {
      method: 'POST',
      body: JSON.stringify({
        userQuery: `Based on the following documents about ${drugName}, extract: ${columnDescription}`,
        contextPapers: documents
      })
    });
    
    const { answer } = await response.json();
    return answer;
  }
  
  /**
   * Extract all pipeline data for a drug
   */
  static async extractDrugData(
    drugName: string,
    columns: PipelineColumn[]
  ): Promise<PipelineDrugCandidate> {
    // Check cache first
    const cached = await this.getCachedData(drugName);
    if (cached && !this.isExpired(cached)) {
      return cached.data;
    }
    
    // Query each column in parallel
    const results = await Promise.all(
      columns.map(col => 
        this.queryColumn(drugName, col.name, col.description)
      )
    );
    
    // Build candidate object
    const candidate: PipelineDrugCandidate = {
      id: drugName.toLowerCase(),
      scientificName: drugName,
      ...Object.fromEntries(
        columns.map((col, idx) => [col.name, results[idx]])
      )
    };
    
    // Cache result
    await this.cacheData(drugName, candidate);
    
    return candidate;
  }
}
```

#### 2.4 SQL Function for Vector Search
```sql
CREATE OR REPLACE FUNCTION match_pipeline_documents(
  query_embedding vector(1536),
  match_drug_name text,
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  drug_name text,
  source_type text,
  source_id text,
  title text,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pipeline_documents.id,
    pipeline_documents.drug_name,
    pipeline_documents.source_type,
    pipeline_documents.source_id,
    pipeline_documents.title,
    pipeline_documents.content,
    pipeline_documents.metadata,
    1 - (pipeline_documents.embedding <=> query_embedding) as similarity
  FROM pipeline_documents
  WHERE pipeline_documents.drug_name = match_drug_name
    AND 1 - (pipeline_documents.embedding <=> query_embedding) > match_threshold
  ORDER BY pipeline_documents.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

#### 2.5 UI Integration
```typescript
// In AssetDevelopmentPipeline.tsx
const [useRAG, setUseRAG] = useState(true);
const [customColumns, setCustomColumns] = useState<PipelineColumn[]>([]);

// Toggle between pattern-based and RAG extraction
const handleExtract = async () => {
  if (useRAG) {
    // First, ingest all documents
    await Promise.all(
      drugGroups.map(g => 
        PipelineRAGService.ingestDocuments(g.drugName, g.trials, g.papers)
      )
    );
    
    // Then extract data
    const candidates = await Promise.all(
      drugGroups.map(g => 
        PipelineRAGService.extractDrugData(g.drugName, customColumns)
      )
    );
    
    setCandidates(candidates);
  } else {
    // Use pattern-based extraction
    setCandidates(PipelineService.trialsToPipeline(trials));
  }
};

// Add custom column UI
const handleAddColumn = async (name: string, description: string) => {
  const newColumn = { name, description };
  setCustomColumns([...customColumns, newColumn]);
  
  // Re-extract data with new column
  await handleExtract();
};
```

### Pros ✅

1. **Scalability**
   - One-time ingestion per drug
   - Fast queries (50ms-500ms per column)
   - Can handle thousands of drugs efficiently

2. **Cost Efficiency**
   - Ingestion: ~$0.001 per 1k tokens (embeddings cheap)
   - Queries: Only pay for synthesis, not full context
   - Cached results avoid re-processing

3. **Queryable**
   - Can ask questions across all drugs
   - "Which Phase III drugs target APOE4?"
   - Enable drug discovery insights

4. **Incremental Updates**
   - Add new trials/papers without full reprocess
   - Update specific drugs as new data arrives
   - TTL-based cache invalidation

5. **Dynamic Columns**
   - Users define custom columns in UI
   - Query template stored in database
   - No code deployment needed

6. **Granular Retrieval**
   - Only fetches relevant chunks
   - Better token efficiency
   - More accurate for specific questions

7. **Multi-User Support**
   - Shared vector database across users
   - Reduced redundant API calls
   - Collaborative column definitions

8. **Audit Trail**
   - Track which documents influenced extraction
   - Show confidence/source citations
   - Debug extraction issues

### Cons ❌

1. **Complexity**
   - Requires vector database setup
   - More moving parts (embeddings, search, synthesis)
   - Harder to debug

2. **Infrastructure Costs**
   - Supabase Vector or Pinecone subscription
   - Storage costs for embeddings
   - Ongoing maintenance

3. **Initial Latency**
   - Must ingest all documents first
   - Embedding generation takes time
   - First query slower than subsequent

4. **Data Freshness**
   - Cached data may be stale
   - Need invalidation strategy
   - Balance between freshness and cost

5. **Retrieval Quality**
   - Vector search may miss relevant chunks
   - Requires tuning (threshold, chunk size)
   - May need hybrid search (vector + keyword)

6. **Development Time**
   - More upfront engineering
   - Schema design and migrations
   - Testing and optimization

---

## Comparison Matrix

| Criteria | Direct LLM | RAG Database |
|----------|-----------|--------------|
| **Accuracy** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Speed (per drug)** | ⭐⭐ (3-10s) | ⭐⭐⭐⭐ (0.5-2s) |
| **Cost (50 drugs)** | ⭐⭐ ($2-5) | ⭐⭐⭐⭐ ($0.20-0.50) |
| **Scalability** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Flexibility** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Implementation** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Maintenance** | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Cross-Drug Analysis** | ⭐ | ⭐⭐⭐⭐⭐ |
| **Caching** | Manual | Built-in |
| **Multi-User** | ⭐⭐ | ⭐⭐⭐⭐⭐ |

---

## Hybrid Approach (Recommended)

### Best of Both Worlds

```
                    User Request
                         ↓
                    Check Cache
                    /         \
              [Hit]            [Miss]
                ↓                ↓
          Return Cached      Ingest to RAG
                ↓                ↓
                          Quick Query (RAG)
                                ↓
                          Fallback to Direct LLM
                          (if RAG low confidence)
                                ↓
                            Cache Result
                                ↓
                          Return to User
```

### Implementation Strategy

1. **Phase 1: Direct LLM** (Week 1-2)
   - Quick wins, immediate value
   - Validate extraction quality
   - Gather user feedback on columns

2. **Phase 2: Add Caching** (Week 3)
   - Cache LLM responses in Supabase
   - Reduce costs for repeated queries
   - Track cache hit rate

3. **Phase 3: RAG Migration** (Week 4-6)
   - Set up vector database
   - Migrate cached data
   - Implement ingestion pipeline

4. **Phase 4: Optimization** (Week 7-8)
   - Tune retrieval thresholds
   - Add hybrid search
   - Implement smart fallback

### Code Structure
```typescript
export class HybridPipelineService {
  static async extractDrugData(
    drugName: string,
    trials: ClinicalTrial[],
    papers: PubMedArticle[]
  ): Promise<PipelineDrugCandidate> {
    // 1. Check cache
    const cached = await this.checkCache(drugName);
    if (cached && !this.isStale(cached)) {
      return cached;
    }
    
    // 2. Try RAG approach
    try {
      await this.ingestIfNeeded(drugName, trials, papers);
      const ragResult = await PipelineRAGService.extractDrugData(drugName);
      
      if (ragResult.confidence > 0.8) {
        await this.cacheResult(drugName, ragResult);
        return ragResult;
      }
    } catch (error) {
      console.warn('RAG extraction failed, falling back to direct LLM:', error);
    }
    
    // 3. Fallback to direct LLM
    const llmResult = await PipelineLLMService.extractSingleDrug(
      drugName,
      trials,
      papers
    );
    
    await this.cacheResult(drugName, llmResult);
    return llmResult;
  }
}
```

---

## Cost Analysis

### Scenario: 50 Drugs, 10 Trials + 10 Papers Each

#### Direct LLM Approach
```
Input tokens per drug: ~15,000 (trials + papers)
Output tokens per drug: ~500 (structured JSON)

GPT-4 Turbo Cost:
- Input: $0.01/1k tokens = $0.15/drug
- Output: $0.03/1k tokens = $0.015/drug
- Total: $0.165/drug × 50 = $8.25

With 10 searches/day: $82.50/day = $2,475/month
```

#### RAG Approach
```
Embedding cost (one-time):
- 50 drugs × 20 docs × 500 tokens = 500k tokens
- $0.0001/1k tokens = $0.05 one-time

Query cost per extraction:
- 5 chunks retrieved × 500 tokens = 2,500 input
- GPT-4 synthesis: $0.01/1k × 2.5 = $0.025/drug
- Total: $0.025/drug × 50 = $1.25/search

With caching (80% hit rate):
- $1.25 × 0.2 = $0.25/search
- 10 searches/day: $2.50/day = $75/month

Supabase Vector: ~$25/month (Pro plan)
Total: ~$100/month
```

**Savings: $2,375/month with RAG + caching**

---

## Recommendations

### For Your Use Case:

1. **Start with Direct LLM** ✅
   - You have relatively small datasets (<100 drugs typically)
   - Fast time to value
   - Easy to iterate on prompts
   - Users can see results immediately

2. **Add Caching Early** ⚡
   - Store results in Supabase (simple table)
   - 30-day TTL
   - Cuts costs by 80%+

3. **Consider RAG if:** 🔄
   - Users run >20 searches/day
   - Dataset grows to >500 drugs
   - You want cross-drug analytics
   - Multiple users querying same drugs

4. **Must-Have Features:**
   - ✅ Streaming updates (show drugs as processed)
   - ✅ Error handling with fallback
   - ✅ Confidence scores
   - ✅ Source citations
   - ✅ Custom column support

---

## Next Steps

### Immediate (Week 1)
1. Implement `/api/extract-pipeline-data.ts` with direct LLM
2. Add streaming UI in AssetDevelopmentPipeline
3. Test on 5-10 drugs, validate accuracy
4. Gather user feedback

### Short-term (Weeks 2-3)
1. Add caching layer
2. Implement custom columns UI
3. Add confidence scores and citations
4. Optimize prompts based on feedback

### Long-term (Months 2-3)
1. Evaluate need for RAG based on usage
2. If needed, implement vector database
3. Migrate cached data
4. Add advanced analytics features

Would you like me to start implementing the Direct LLM approach first?

