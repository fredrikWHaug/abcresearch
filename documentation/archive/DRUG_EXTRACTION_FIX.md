# Drug Extraction Bug Fix

## Problem
Drug badges were only showing up on the first ~20 trials and papers, not on all results.

## Root Cause
Two issues in `/src/services/extractDrugNames.ts`:

1. **Limited Extraction**: `extractFromSearchResults()` was only extracting from the first 20 trials and 20 papers:
   ```typescript
   this.extractFromTrials(trials.slice(0, 20), userQuery)  // ❌ Only first 20
   this.extractFromPapers(papers.slice(0, 20), userQuery)  // ❌ Only first 20
   ```

2. **Premature Deduplication**: `extractFromTrials()` and `extractFromPapers()` were calling `deduplicateDrugs()` individually, which:
   - Lost the source information (NCT ID / PMID) needed to attach drugs to objects
   - Deduplicated trials and papers separately instead of together
   - Made it impossible to map drugs back to their original trials/papers

## Solution

### 1. Remove Extraction Limit (Line 192-193)
```typescript
// BEFORE
const [trialDrugs, paperDrugs] = await Promise.all([
  this.extractFromTrials(trials.slice(0, 20), userQuery),  // ❌ Limited
  this.extractFromPapers(papers.slice(0, 20), userQuery)   // ❌ Limited
]);

// AFTER
const [trialDrugs, paperDrugs] = await Promise.all([
  this.extractFromTrials(trials, userQuery),  // ✅ All trials
  this.extractFromPapers(papers, userQuery)   // ✅ All papers
]);
```

### 2. Return Raw Extraction Results (Lines 118-119, 171-172)
```typescript
// BEFORE (in extractFromTrials)
return await this.deduplicateDrugs(allDrugs);  // ❌ Loses source info

// AFTER
return allDrugs;  // ✅ Keep source info (NCT ID / PMID)
```

Same change applied to `extractFromPapers()`.

## Data Flow (Fixed)

```
extractFromSearchResults()
  │
  ├─ extractFromTrials(ALL trials)
  │   ├─ Batch process in groups of 5
  │   ├─ Call Gemini API for each trial
  │   └─ Return: DrugInfo[] with source=nctId
  │
  ├─ extractFromPapers(ALL papers)
  │   ├─ Batch process in groups of 5
  │   ├─ Call Gemini API for each paper
  │   └─ Return: DrugInfo[] with source=pmid
  │
  ├─ Combine: allDrugs = [...trialDrugs, ...paperDrugs]
  │
  ├─ Deduplicate: deduplicateDrugs(allDrugs)
  │   └─ Returns unique drug names
  │
  └─ Return: { trialDrugs, paperDrugs, uniqueDrugNames }
      │
      └─ Dashboard attaches drugs to each object:
           │
           ├─ trial.extractedDrugs = drugs where source === nctId
           └─ paper.extractedDrugs = drugs where source === pmid
```

## Batch Processing
The service still respects rate limits:
- **Batch size**: 5 trials/papers at a time
- **Delay**: 500ms between batches
- **Parallel**: Trials and papers processed in parallel

Example: 50 trials + 30 papers
- Trials: 10 batches × 5 = 50 extractions (~5 seconds)
- Papers: 6 batches × 5 = 30 extractions (~3 seconds)
- Total: ~5 seconds (parallel execution)

## Result
✅ Every trial now has `extractedDrugs: string[]` with all drugs Gemini found  
✅ Every paper now has `extractedDrugs: string[]` with all drugs Gemini found  
✅ Drug badges display on all trial/paper cards (up to 3 drugs each)  
✅ Source information preserved for accurate mapping  

## Files Modified
- `/src/services/extractDrugNames.ts`
  - Line 192-193: Removed `.slice(0, 20)` limits
  - Line 119: Return raw `allDrugs` instead of deduplicated
  - Line 172: Return raw `allDrugs` instead of deduplicated

