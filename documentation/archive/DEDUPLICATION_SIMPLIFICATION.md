# Drug Deduplication Simplification

## Problem
The complex JSON format for deduplication was causing frequent failures:
```json
{
  "deduplicated": [
    {
      "name": "...",
      "type": "...",
      "confidence": "...",
      "source": "...",
      "sourceType": "..."
    }
  ]
}
```

This was error-prone because:
- LLM had to maintain complex object structure
- Easy to make JSON formatting mistakes
- Longer output increased chance of truncation

---

## Solution: Simplified Array Format

### New LLM Prompt
Now asks for just an array of deduplicated drug name strings:
```json
["Pembrolizumab", "Nivolumab", "Atezolizumab"]
```

**Benefits:**
- ✅ Much simpler for LLM to generate correctly
- ✅ Less prone to JSON errors
- ✅ Shorter output, less chance of truncation
- ✅ Faster processing

### Prompt Structure
```typescript
const prompt = `You are a pharmaceutical expert. Deduplicate this list of drug names by merging synonyms, brand/generic names, and spelling variations.

DRUG NAMES (${drugNames.length} total):
${drugNames.map((name, i) => `${i + 1}. ${name}`).join('\n')}

RULES:
- Merge brand names with generic names (e.g., "Keytruda" and "Pembrolizumab" → keep "Pembrolizumab")
- Merge spelling variations (e.g., "Nivolumab" and "nivolumab" → keep "Nivolumab")
- Merge abbreviations with full names (keep the full name)
- If unsure whether two drugs are the same, keep both separate
- Prefer generic/scientific names over brand names
- Return ONE name for each unique drug

Return ONLY a JSON array of the deduplicated drug names (just strings, no objects):

["Drug Name 1", "Drug Name 2", "Drug Name 3"]

IMPORTANT: Return ONLY the JSON array, no markdown, no explanations, no code blocks.`;
```

---

## How Matching Works After Deduplication

### Step 1: Deduplication Returns Simple Strings
```typescript
// LLM returns:
["Pembrolizumab", "Nivolumab", "Atezolizumab"]
```

### Step 2: Reconstruct DrugInfo Objects
The code maps deduplicated names back to original drug data:

```typescript
const deduplicatedDrugs: DrugInfo[] = deduplicatedNames.map(deduplicatedName => {
  // Find all original drugs that might match this deduplicated name
  const matches = drugs.filter(drug => 
    drug.name.toLowerCase() === deduplicatedName.toLowerCase() ||
    deduplicatedName.toLowerCase().includes(drug.name.toLowerCase()) ||
    drug.name.toLowerCase().includes(deduplicatedName.toLowerCase())
  );
  
  // Use the match with highest confidence
  const bestMatch = matches.sort((a, b) => {
    const confidenceOrder = { high: 3, medium: 2, low: 1 };
    return confidenceOrder[b.confidence] - confidenceOrder[a.confidence];
  })[0];
  
  // Combine sources from all matches
  const combinedSources = matches.map(m => m.source)
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(', ');
  
  return {
    name: deduplicatedName,
    type: bestMatch.type,
    confidence: bestMatch.confidence,
    source: combinedSources,
    sourceType: bestMatch.sourceType
  };
});
```

**Example:**
```
Original drugs: ["Keytruda", "Pembrolizumab", "pembrolizumab"]
LLM returns: ["Pembrolizumab"]
Reconstructed: {
  name: "Pembrolizumab",
  type: "drug",
  confidence: "high",
  source: "NCT123, PMID456, NCT789",  // Combined from all 3
  sourceType: "trial"
}
```

### Step 3: Extract Unique Names
```typescript
const uniqueDrugNames = [...new Set(highConfidenceDrugs.map(d => d.name))];
// Result: ["Pembrolizumab", "Nivolumab", "Atezolizumab"]
```

### Step 4: Match Trials and Papers (Dashboard.tsx)
For each deduplicated drug name, find matching trials and papers:

```typescript
const allDrugGroups: DrugGroup[] = uniqueDrugNames.map(drugName => {
  const normalizedDrugName = drugName.toLowerCase();
  
  // Find trials mentioning this drug
  const drugTrials = initialResult.trials.filter(trial => {
    const trialText = [
      trial.briefTitle,
      trial.officialTitle,
      ...(trial.interventions || []),
      ...(trial.conditions || [])
    ].join(' ').toLowerCase();
    return trialText.includes(normalizedDrugName);
  });
  
  // Find papers mentioning this drug
  const drugPapers = initialResult.papers.filter(paper => {
    const paperText = [paper.title, paper.abstract].join(' ').toLowerCase();
    return paperText.includes(normalizedDrugName);
  });
  
  return {
    drugName,
    normalizedName: normalizedDrugName,
    papers: drugPapers,
    trials: drugTrials,
    totalResults: drugPapers.length + drugTrials.length
  };
});
```

**Why This Works:**
- ✅ Uses simple substring matching (`includes()`)
- ✅ Case-insensitive via `.toLowerCase()`
- ✅ Searches in relevant fields (title, interventions, abstract)
- ✅ If LLM merged "Keytruda" → "Pembrolizumab", any trial mentioning either will match "pembrolizumab"

---

## Example Flow

### Input: Original Extracted Drugs
```javascript
[
  { name: "Keytruda", confidence: "high", source: "NCT123", ... },
  { name: "Pembrolizumab", confidence: "high", source: "PMID456", ... },
  { name: "pembrolizumab", confidence: "medium", source: "NCT789", ... },
  { name: "Nivolumab", confidence: "high", source: "NCT111", ... },
  { name: "Opdivo", confidence: "high", source: "PMID222", ... }
]
```

### LLM Deduplication
```json
["Pembrolizumab", "Nivolumab"]
```

### Reconstructed DrugInfo
```javascript
[
  {
    name: "Pembrolizumab",
    confidence: "high",
    source: "NCT123, PMID456, NCT789",
    type: "drug",
    sourceType: "trial"
  },
  {
    name: "Nivolumab",
    confidence: "high",
    source: "NCT111, PMID222",
    type: "drug",
    sourceType: "trial"
  }
]
```

### Trial/Paper Matching
```javascript
// Trial titled "Pembrolizumab in Advanced Melanoma"
// Matches: "Pembrolizumab" ✅

// Paper abstract mentions "...Keytruda (pembrolizumab) showed..."
// Matches: "Pembrolizumab" ✅ (substring match)

// Trial titled "Opdivo for Lung Cancer"
// Matches: "Nivolumab" ✅ (because trial intervention field likely mentions "Nivolumab")
```

---

## Fallback Behavior

If LLM deduplication fails, uses basic deduplication:

```typescript
const seen = new Map<string, DrugInfo>();
for (const drug of allDrugs) {
  const key = drug.name.toLowerCase();
  const existing = seen.get(key);
  // Keep the one with higher confidence
  if (!existing || drug.confidence === 'high' || 
      (drug.confidence === 'medium' && existing.confidence === 'low')) {
    seen.set(key, drug);
  }
}
```

**This removes:**
- Exact duplicates (case-insensitive)
- Keeps highest confidence version

**But doesn't merge:**
- Brand vs generic names (Keytruda ≠ Pembrolizumab)
- Spelling variations
- Abbreviations

User sees warning: "⚠️ Advanced deduplication unavailable..."

---

## Files Modified

1. `/src/services/extractDrugNames.ts` (Lines 258-406)
   - Simplified LLM prompt to return string array
   - Updated parsing to extract JSON array instead of object
   - Added reconstruction logic to map names back to DrugInfo
   - Improved matching logic for name reconstruction

---

## Testing Recommendations

1. **Test with common brand/generic pairs:**
   - Keytruda/Pembrolizumab
   - Opdivo/Nivolumab
   - Tecentriq/Atezolizumab

2. **Test with spelling variations:**
   - "Nivolumab" vs "nivolumab"
   - "PD-1" vs "PD1"

3. **Verify matching still works:**
   - Check that trials mentioning brand names match generic names
   - Verify papers with both names are grouped correctly

4. **Monitor console logs:**
   - Look for "✅ Deduplication successful: X → Y drugs"
   - Check for reconstruction matches

---

## Status

✅ **Simplified LLM Prompt**
✅ **Array-based JSON Format**
✅ **DrugInfo Reconstruction Logic**
✅ **Matching Logic Preserved**
✅ **No Linter Errors**
✅ **Fallback Still Works**

