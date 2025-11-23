# LLM-Based Query Parsing Implementation

## Overview
Replaced manual code-based query parsing with LLM-powered query construction using Gemini. The system now intelligently parses natural language queries and constructs well-formed API calls to ClinicalTrials.gov and PubMed.

## Changes Made

### 1. ClinicalTrials.gov API (`api/search-clinical-trials.ts`)

**Enhanced with LLM-based Query Parsing:**
- Added `parseQueryWithLLM()` function that uses Gemini to parse natural language queries
- Constructs structured ClinicalTrials.gov API v2 parameters following the proper format:
  - `query.cond` - Medical condition (e.g., "obesity", "diabetes")
  - `query.intr` - Intervention/drug name (e.g., "semaglutide")
  - `query.term` - General search terms with AREA syntax for phase: `AREA[Phase](Phase 3)`
  - `query.locn` - Geographic location (e.g., "United States")
  - `filter.overallStatus` - Trial status (e.g., "RECRUITING,ACTIVE_NOT_RECRUITING")
  - `query.patient` - Patient population (e.g., "adult", "child")

**Example Well-Formed Query:**
```
https://clinicaltrials.gov/api/v2/studies?query.cond=obesity&query.intr=semaglutide&query.term=AREA[Phase](Phase%203)&query.locn=United%20States&filter.overallStatus=RECRUITING,ACTIVE_NOT_RECRUITING&query.patient=adult&pageSize=20
```

**How It Works:**
1. User provides natural language query (e.g., "Phase 3 semaglutide obesity trials that are recruiting")
2. LLM parses the query and extracts structured parameters
3. API constructs proper ClinicalTrials.gov API v2 URL with structured parameters
4. Falls back to direct query if LLM unavailable

**Example Transformations:**
- Input: "Show me Phase 3 trials for semaglutide in obesity that are recruiting"
- Output:
  ```json
  {
    "query.cond": "obesity",
    "query.intr": "semaglutide",
    "query.term": "AREA[Phase](Phase 3)",
    "filter.overallStatus": "RECRUITING,ACTIVE_NOT_RECRUITING"
  }
  ```

- Input: "Phase 2 GLP-1 receptor agonist trials"
- Output:
  ```json
  {
    "query.term": "GLP-1 receptor agonist AREA[Phase](Phase 2)"
  }
  ```

### 2. PubMed API (`api/search-papers.ts`)

**Enhanced with LLM-based Query Enhancement:**
- Added `enhancePubMedQuery()` function that uses Gemini to construct optimized PubMed queries
- Constructs proper E-Utilities API syntax with:
  - Field tags: `[Title/Abstract]`, `[Publication Type]`, `[MeSH Terms]`
  - Boolean operators: `AND`, `OR`, `NOT`
  - Phrase matching with quotes
  - Clinical trial publication type filters

**Example Transformations:**
- Input: "Phase 3 semaglutide obesity trials"
- Enhanced: `semaglutide[Title/Abstract] AND obesity[Title/Abstract] AND ("Clinical Trial, Phase III"[Publication Type] OR "Clinical Trial"[Publication Type])`

- Input: "GLP-1 receptor agonist diabetes"
- Enhanced: `("GLP-1 receptor agonist"[Title/Abstract] OR "glucagon-like peptide-1"[Title/Abstract]) AND diabetes[Title/Abstract] AND ("Clinical Trial"[Publication Type] OR "Randomized Controlled Trial"[Publication Type])`

**How It Works:**
1. User query is sent to the API with `enhanceQuery: true` flag
2. LLM constructs optimized PubMed search syntax
3. Enhanced query is sent to PubMed E-Utilities API
4. Falls back to original query if LLM unavailable

### 3. SearchParams Interface (`src/types/trials.ts`)

**Updated to Support ClinicalTrials.gov API v2:**
```typescript
export interface SearchParams {
  // ClinicalTrials.gov API v2 structured parameters
  'query.cond'?: string;        // Condition
  'query.intr'?: string;        // Intervention/drug name
  'query.term'?: string;        // General search terms with AREA syntax
  'query.locn'?: string;        // Location
  'filter.overallStatus'?: string;  // Status
  'query.patient'?: string;     // Patient population
  
  // Legacy support (backward compatibility)
  query?: string;
  condition?: string;
  sponsor?: string;
  phase?: string;
  status?: string;
  
  // Pagination
  pageSize?: number;
  pageToken?: string;
  sort?: string;
}
```

### 4. GatherSearchResults Service (`src/services/gatherSearchResults.ts`)

**Removed Manual Parsing:**
- ❌ Deleted `parseQuery()` method (68 lines of manual parsing code)
- ❌ Deleted `cleanQuery()` method (no longer needed)
- ✅ Updated `simpleSearch()` to rely on LLM-based parsing in API layer
- ✅ All query parsing now happens via Gemini LLM

## Benefits

### 1. **More Accurate Parsing**
- LLM understands context and intent better than regex patterns
- Handles synonyms, medical terminology, and natural language variations
- Adapts to different query formats automatically

### 2. **Better API Utilization**
- Constructs proper ClinicalTrials.gov API v2 structured queries
- Uses correct AREA syntax for phase filtering: `AREA[Phase](Phase 3)`
- Separates conditions, interventions, and search terms into proper fields
- Creates optimized PubMed queries with field tags and boolean operators

### 3. **Reduced Maintenance**
- No need to maintain lists of conditions, sponsors, drugs
- No complex regex patterns to update
- LLM adapts to new terminology automatically

### 4. **Backward Compatibility**
- Maintains legacy parameter support
- Falls back to direct query if LLM unavailable
- Existing code continues to work

## Query Flow

### Before (Manual Parsing):
```
User Query → Manual Regex/String Matching → Basic Parameters → API Call
```

### After (LLM Parsing):
```
User Query → Gemini LLM → Structured Parameters → Well-Formed API Call
```

## Example Usage

### ClinicalTrials.gov Search:
```typescript
// User provides natural language query
const userQuery = "Phase 2 Alzheimer's trials in the United States that are recruiting";

// API automatically parses with LLM and constructs:
// https://clinicaltrials.gov/api/v2/studies?
//   query.cond=Alzheimer's disease
//   &query.locn=United States
//   &query.term=AREA[Phase](Phase 2)
//   &filter.overallStatus=RECRUITING,ACTIVE_NOT_RECRUITING
```

### PubMed Search:
```typescript
// User provides natural language query
const userQuery = "GLP-1 receptor agonist diabetes trials";

// API enhances with LLM to construct:
// ("GLP-1 receptor agonist"[Title/Abstract] OR "glucagon-like peptide-1"[Title/Abstract]) 
// AND diabetes[Title/Abstract] 
// AND ("Clinical Trial"[Publication Type] OR "Randomized Controlled Trial"[Publication Type])
```

## Error Handling

Both APIs include robust error handling:
- If Gemini API is unavailable → Falls back to direct query
- If LLM parsing fails → Uses original query string
- If API key is missing → Logs warning and continues with original query

## Configuration

Requires `GOOGLE_GEMINI_API_KEY` environment variable to be set for LLM parsing.

## Testing

The LLM-based parsing has been tested with various query formats:
- ✅ Specific drug + condition + phase queries
- ✅ Mechanism of action searches (e.g., "GLP-1 receptor agonist")
- ✅ Indication-based searches (e.g., "obesity trials")
- ✅ Complex queries with multiple parameters
- ✅ Location and status filters
- ✅ Patient population specifications

## Summary

This implementation replaces ~100 lines of manual parsing code with intelligent LLM-based query construction that:
1. Better understands user intent
2. Constructs properly formatted API calls following ClinicalTrials.gov API v2 structure
3. Creates optimized PubMed queries with proper E-Utilities syntax
4. Reduces maintenance burden
5. Maintains backward compatibility

