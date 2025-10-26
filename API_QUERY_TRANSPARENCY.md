# API Query Transparency Enhancement ✅

## Overview
Updated the "View Search Terms" modal to show **exactly** how queries are formatted and sent to both ClinicalTrials.gov API and PubMed E-Utilities API, including all parameters and filters.

---

## Problem Solved
Previously, the modal only showed the base LLM-generated query strategy (e.g., "GLP-1 receptor agonist diabetes") but didn't clarify:
- What parameters were sent to each API
- What filters were applied (especially for PubMed)
- How the queries differed between the two APIs

This made it unclear what was actually being searched.

---

## Solution Implemented

### 1. Updated `StrategyResult` Interface
Added `formattedQueries` field to capture the actual API query strings:

```typescript
export interface StrategyResult {
  strategy: SearchStrategy;
  count: number;
  trials: ClinicalTrial[];
  formattedQueries?: {
    clinicalTrials: string;  // Actual query.term sent to ClinicalTrials.gov API
    pubmed: string;          // Actual term sent to PubMed E-Utilities API
  };
}
```

### 2. Captured Formatted Queries in `gatherSearchResults.ts`
When executing each strategy, we now capture the formatted queries:

```typescript
const formattedQueries = {
  clinicalTrials: strategy.query,
  pubmed: `${strategy.query} AND ("Clinical Trial"[Publication Type] OR "Randomized Controlled Trial"[Publication Type])`
};
```

**Key Differences:**
- **ClinicalTrials.gov**: Uses the strategy query as-is
- **PubMed**: Adds publication type filters to focus on clinical trials and RCTs

### 3. Updated Modal Display in `DrugsList.tsx`
Each strategy now shows **two separate API query boxes**:

#### ClinicalTrials.gov API
```
query.term=GLP-1 receptor agonist diabetes
&pageSize=50
&fields=NCTId,BriefTitle,Phase,Condition,InterventionName,...

→ https://clinicaltrials.gov/api/v2/studies?...
```

#### PubMed E-Utilities API
```
db=pubmed
&term=GLP-1 receptor agonist diabetes AND ("Clinical Trial"[Publication Type] OR "Randomized Controlled Trial"[Publication Type])
&retmax=30
&sort=relevance

→ https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?...
```

---

## Visual Layout

### Before:
```
Strategy #1 [high] [mechanism]
Query: "GLP-1 receptor agonist diabetes"
💡 Primary mechanism + indication
```

### After:
```
Strategy #1 [high] [mechanism]                    48 trials
💡 Primary mechanism + indication

🧪 ClinicalTrials.gov API
   query.term=GLP-1 receptor agonist diabetes&pageSize=50&fields=...
   → https://clinicaltrials.gov/api/v2/studies?...

📄 PubMed E-Utilities API
   db=pubmed&term=GLP-1 receptor agonist diabetes AND ("Clinical Trial"[Publication Type]...)&retmax=30&sort=relevance
   → https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?...
```

---

## Files Modified

### `/src/services/gatherSearchResults.ts`
1. **Updated `StrategyResult` interface:**
   - Added `formattedQueries?: { clinicalTrials: string; pubmed: string }`

2. **Updated `searchClinicalTrials()` method:**
   - Captures `formattedQueries` for each strategy result
   - Includes both ClinicalTrials.gov and PubMed query formats

### `/src/components/DrugsList.tsx`
1. **Updated strategy display:**
   - Extracts `formattedQueries` from `strategyResult`
   - Shows two separate API query sections per strategy
   - Color-coded borders (purple for ClinicalTrials, green for PubMed)
   - Displays API endpoints

2. **Enhanced info box:**
   - Added process explanation (parallel execution, union, deduplication)
   - Added filter details (PubMed filters, pageSize limits)

---

## API Query Details

### ClinicalTrials.gov API v2

**Base URL:** `https://clinicaltrials.gov/api/v2/studies`

**Parameters Sent:**
- `query.term`: The LLM-generated strategy query
- `pageSize`: 50 (maximum results per query)
- `fields`: Specific fields to reduce payload (NCTId, BriefTitle, Phase, Condition, InterventionName, LeadSponsorName, StartDate, CompletionDate, EnrollmentCount, etc.)

**Example:**
```
https://clinicaltrials.gov/api/v2/studies?query.term=GLP-1+receptor+agonist+diabetes&pageSize=50&fields=NCTId,BriefTitle,...
```

**Response:** JSON with array of clinical trials

---

### PubMed E-Utilities API

**Base URL:** `https://eutils.ncbi.nlm.nih.gov/entrez/eutils`

**Two-Step Process:**

#### Step 1: Search (`esearch.fcgi`)
**Parameters:**
- `db`: pubmed
- `term`: Strategy query + publication type filters
- `retmax`: 30 (maximum results per query)
- `sort`: relevance
- `retmode`: json

**Filters Applied:**
```
AND ("Clinical Trial"[Publication Type] OR "Randomized Controlled Trial"[Publication Type])
```

**Example:**
```
https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=GLP-1+receptor+agonist+diabetes+AND+%28%22Clinical+Trial%22%5BPublication+Type%5D+OR+%22Randomized+Controlled+Trial%22%5BPublication+Type%5D%29&retmax=30&sort=relevance&retmode=json
```

**Response:** JSON with list of PMIDs

#### Step 2: Fetch Details (`efetch.fcgi`)
**Parameters:**
- `db`: pubmed
- `id`: Comma-separated PMIDs from Step 1
- `retmode`: xml

**Response:** XML with full article metadata (title, abstract, authors, journal, publication date, DOI, etc.)

---

## Key Insights for Users

### 1. PubMed Auto-Filters for Clinical Trials
The modal now clearly shows that PubMed searches automatically add:
```
AND ("Clinical Trial"[Publication Type] OR "Randomized Controlled Trial"[Publication Type])
```
This ensures only clinical trial publications are returned, not basic science papers.

### 2. Different Result Limits
- **ClinicalTrials.gov**: Up to 50 trials per strategy
- **PubMed**: Up to 30 papers per strategy
- **Total possible**: 5 strategies × (50 trials + 30 papers) = 250 trials + 150 papers (before deduplication)

### 3. Union + Deduplication
The info box now explains:
- Each strategy executes on **both APIs in parallel**
- Results are **unioned** (combined)
- **Deduplicated** by NCT ID (trials) or PMID (papers)
- Eliminates overlap between strategies (e.g., Strategy #1 and #2 may find the same trial)

### 4. Query Strategy is Same for Both APIs
The base query (e.g., "GLP-1 receptor agonist diabetes") is sent to both APIs. The difference is:
- ClinicalTrials.gov uses it as-is
- PubMed adds publication type filters

---

## Benefits

### For Users:
✅ **Complete transparency** into what's being searched  
✅ **Understand API differences** (filters, limits, endpoints)  
✅ **Verify search coverage** (can manually test queries if needed)  
✅ **Debug search issues** (see exact query if something seems missing)  
✅ **Learn API syntax** (for future custom integrations)

### For Developers:
✅ **Clear data flow** from strategy → API → results  
✅ **Easy debugging** when queries fail  
✅ **Documentation** of API parameters in UI  

---

## Example Output

For the query **"PD-1 receptors cancer"**, the modal might show:

### Strategy #1 [high] [mechanism] — 45 trials

💡 Primary PD-1 checkpoint inhibitor mechanism

**🧪 ClinicalTrials.gov API**
```
query.term=PD-1 checkpoint inhibitor cancer
&pageSize=50
&fields=NCTId,BriefTitle,Phase,Condition,InterventionName,...
```
→ `https://clinicaltrials.gov/api/v2/studies?...`

**📄 PubMed E-Utilities API**
```
db=pubmed
&term=PD-1 checkpoint inhibitor cancer AND ("Clinical Trial"[Publication Type] OR "Randomized Controlled Trial"[Publication Type])
&retmax=30
&sort=relevance
```
→ `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?...`

---

### Strategy #2 [high] [synonym] — 38 trials

💡 Alternative terminology for PD-1 blockade

**🧪 ClinicalTrials.gov API**
```
query.term=programmed death 1 receptor antagonist
&pageSize=50
&fields=NCTId,BriefTitle,Phase,Condition,InterventionName,...
```
→ `https://clinicaltrials.gov/api/v2/studies?...`

**📄 PubMed E-Utilities API**
```
db=pubmed
&term=programmed death 1 receptor antagonist AND ("Clinical Trial"[Publication Type] OR "Randomized Controlled Trial"[Publication Type])
&retmax=30
&sort=relevance
```
→ `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?...`

---

*...and 3 more strategies...*

---

**📊 Results:** Found 127 unique trials across 5 strategies.

**🔄 Process:** Each query executes on both APIs in parallel, results are unioned and deduplicated by NCT ID / PMID.

**🎯 Filters:** PubMed automatically filters for Clinical Trials and RCTs. ClinicalTrials.gov fetches up to 50 trials per query.

---

## Testing

### Test Transparency
1. Run search for "GLP-1 receptor agonists"
2. Click "View Search Terms" button
3. Verify each strategy shows:
   - ✅ ClinicalTrials.gov query with parameters
   - ✅ PubMed query with publication type filters
   - ✅ API endpoint URLs
   - ✅ Different parameter formats for each API

### Test Filters
1. Check PubMed queries
2. Verify they all include:
   ```
   AND ("Clinical Trial"[Publication Type] OR "Randomized Controlled Trial"[Publication Type])
   ```
3. Check ClinicalTrials.gov queries
4. Verify they include:
   ```
   pageSize=50
   ```

### Verify Deduplication
1. Look at info box stats
2. Note: "Found X unique trials across 5 strategies"
3. Verify X is less than 5 × 50 = 250 (shows deduplication working)

---

## API Rate Limits (Documented for Reference)

### ClinicalTrials.gov
- **No authentication required**
- **No documented rate limit**
- Recommended: Be respectful, don't hammer the API
- Our implementation: 5 parallel requests (acceptable)

### PubMed E-Utilities
- **Without API key**: 3 requests/second
- **With API key**: 10 requests/second
- Our implementation: 350ms delay between requests (safe for 3 req/sec)
- Our approach: 5 strategies × 2 API calls (search + fetch) = 10 calls total (~3.5 seconds with delays)

---

## Future Enhancements (Optional)

1. **Copy Query Button**
   - Add button to copy formatted query to clipboard
   - Useful for testing queries manually

2. **Open in Browser Button**
   - Link directly to ClinicalTrials.gov search results
   - Link directly to PubMed search results

3. **Show Rate Limit Info**
   - Display current rate limit status
   - Show estimated time for all queries

4. **Export All Queries**
   - Download all queries as JSON/CSV
   - Include results count per query

5. **Query Performance Metrics**
   - Show execution time per query
   - Highlight slow queries
   - Track success/failure rate

---

## Summary

✅ **Modal now shows exact API query formats** for both ClinicalTrials.gov and PubMed  
✅ **Publication type filters visible** in PubMed queries  
✅ **Parameter details shown** (pageSize, retmax, fields, sort)  
✅ **API endpoints displayed** for reference  
✅ **Info box explains process** (parallel, union, deduplication)  
✅ **No linting errors** - clean implementation

**Impact:**
- Complete transparency into search execution
- Users understand exactly what's being queried
- Clear visibility into API differences and filters
- Easy debugging and verification of search coverage

