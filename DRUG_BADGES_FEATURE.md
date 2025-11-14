# Drug Keywords Display Feature

## Overview
Display extracted drug names as light blue badges next to NCT IDs (trials) and PMID (papers) to show which drugs were found in each result by Gemini LLM.

---

## Implementation

### 1. **Data Source** 
Drug names extracted by Gemini are stored directly in the trial/paper data structures:
- `ClinicalTrial.extractedDrugs?: string[]` - Drugs extracted from this trial
- `PubMedArticle.extractedDrugs?: string[]` - Drugs extracted from this paper
- No filtering needed - each object contains its own extracted drugs

### 2. **Data Types Updated**

#### **src/types/trials.ts**
```typescript
export interface ClinicalTrial {
  nctId: string;
  briefTitle: string;
  // ... other fields
  extractedDrugs?: string[]; // Drug names extracted by Gemini from this trial
}
```

#### **src/types/papers.ts**
```typescript
export interface PubMedArticle {
  pmid: string;
  title: string;
  // ... other fields
  extractedDrugs?: string[]; // Drug names extracted by Gemini from this paper
}
```

### 3. **Components Updated**

#### **TrialsList.tsx**
```typescript
// No props needed - reads directly from trial object
{trial.extractedDrugs && trial.extractedDrugs.slice(0, 3).map((drug, idx) => (
  <Badge 
    key={idx}
    className="text-xs bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200"
    variant="outline"
  >
    {drug}
  </Badge>
))}
```

#### **PapersDiscovery.tsx**
```typescript
// No props needed - reads directly from paper object
{paper.extractedDrugs && paper.extractedDrugs.slice(0, 3).map((drug, idx) => (
  <Badge 
    key={idx}
    className="text-xs bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200"
    variant="outline"
  >
    {drug}
  </Badge>
))}
```

#### **MarketMap.tsx**
```typescript
// Displays drugs in ranked trial cards
{trial.extractedDrugs && trial.extractedDrugs.slice(0, 3).map((drug, idx) => (
  <Badge 
    key={idx}
    className="text-xs bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200"
    variant="outline"
  >
    {drug}
  </Badge>
))}
```

### 4. **Data Flow**

```
Dashboard.tsx (handleSearchSuggestion)
  ├─ 1. Extract drugs: drugExtractionResult = await extractFromSearchResults(...)
  │
  ├─ 2. Attach drugs to each trial:
  │    trialsWithDrugs = trials.map(trial => ({
  │      ...trial,
  │      extractedDrugs: [...drugs that match trial.nctId]
  │    }))
  │
  ├─ 3. Attach drugs to each paper:
  │    papersWithDrugs = papers.map(paper => ({
  │      ...paper,
  │      extractedDrugs: [...drugs that match paper.pmid]
  │    }))
  │
  ├─ 4. Update state: setTrials(trialsWithDrugs), setPapers(papersWithDrugs)
  │
  └─ 5. Components read directly:
       ├─ MarketMap: trial.extractedDrugs
       ├─ TrialsList: trial.extractedDrugs
       └─ PapersDiscovery: paper.extractedDrugs
```

### 5. **Extraction Logic in Dashboard.tsx**

```typescript
// Extract drugs using Gemini
const drugExtractionResult = await ExtractDrugNamesService.extractFromSearchResults(
  initialResult.trials,
  initialResult.papers,
  suggestion.query
);

// Attach extracted drugs to each trial object
const trialsWithDrugs = initialResult.trials.map(trial => {
  const drugsForTrial = drugExtractionResult.trialDrugs
    .filter(drug => drug.source === trial.nctId)
    .map(drug => drug.name);
  return {
    ...trial,
    extractedDrugs: [...new Set(drugsForTrial)] // Deduplicate
  };
});

// Attach extracted drugs to each paper object
const papersWithDrugs = initialResult.papers.map(paper => {
  const drugsForPaper = drugExtractionResult.paperDrugs
    .filter(drug => drug.source === paper.pmid)
    .map(drug => drug.name);
  return {
    ...paper,
    extractedDrugs: [...new Set(drugsForPaper)] // Deduplicate
  };
});

// Update state with enhanced data
setTrials(trialsWithDrugs);
setPapers(papersWithDrugs);
```

---

## Visual Design

### Badge Styling
```css
className="text-xs bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200"
```

- **Color**: Light blue (`bg-blue-100`)
- **Text**: Blue (`text-blue-700`)
- **Border**: Light blue (`border-blue-200`)
- **Hover**: Slightly darker (`hover:bg-blue-200`)
- **Size**: Extra small (`text-xs`)

### Display Logic
- Shows up to **3 drugs** per trial/paper
- Deduplicated automatically (uses `Set`)
- Appears after NCT ID / PMID in the badge row

---

## Example Display

### Trial Card
```
Pembrolizumab vs Chemotherapy in Advanced NSCLC
Sponsor: Merck
Match: 95%  RECRUITING  NCT04567890  Pembrolizumab  Nivolumab
          ↑              ↑            ↑               ↑           ↑
       Score         Status        NCT ID       Drug badges (light blue)
```

### Paper Card
```
Efficacy of Pembrolizumab in Melanoma
By: Smith J, et al.
Journal Name  2024-01-15  PMID:38234567  Pembrolizumab  Atezolizumab
      ↑            ↑            ↑              ↑               ↑
   Journal      Date        PMID         Drug badges (light blue)
```

---

## Data Structure

### DrugInfo (from extractDrugNames.ts)
```typescript
interface DrugInfo {
  name: string;          // "Pembrolizumab"
  type?: string;         // "drug"
  confidence: 'high' | 'medium' | 'low';
  source: string;        // "NCT04567890" or "38234567"
  sourceType: 'trial' | 'paper';
}
```

### Example Data
```javascript
[
  {
    name: "Pembrolizumab",
    type: "drug",
    confidence: "high",
    source: "NCT04567890",  // ← Matches trial NCT ID
    sourceType: "trial"
  },
  {
    name: "Nivolumab",
    type: "drug",
    confidence: "high",
    source: "NCT04567890",  // ← Same trial
    sourceType: "trial"
  },
  {
    name: "Pembrolizumab",
    type: "drug",
    confidence: "high",
    source: "38234567",     // ← Matches paper PMID
    sourceType: "paper"
  }
]
```

---

## Benefits

1. **Clean Architecture**: Drug data embedded directly in each trial/paper object
2. **No Props Drilling**: Components read from data objects, no need to pass separate arrays
3. **Accurate**: Shows exactly which drugs Gemini extracted from each source
4. **Visual Clarity**: Easy to see relevant drugs at a glance
5. **Performance**: No filtering needed - data is pre-attached
6. **Type Safe**: Properly typed in TypeScript interfaces

---

## Files Modified

1. **`/src/types/trials.ts`**
   - Added `extractedDrugs?: string[]` field to `ClinicalTrial` interface

2. **`/src/types/papers.ts`**
   - Added `extractedDrugs?: string[]` field to `PubMedArticle` interface

3. **`/src/components/Dashboard.tsx`**
   - Attaches extracted drugs to trial/paper objects after extraction
   - Creates `trialsWithDrugs` and `papersWithDrugs` with embedded drug data
   - Updates state with enhanced objects

4. **`/src/components/TrialsList.tsx`**
   - Displays drug badges from `trial.extractedDrugs` (no prop needed)
   - Shows up to 3 drugs per trial

5. **`/src/components/PapersDiscovery.tsx`**
   - Displays drug badges from `paper.extractedDrugs` (no prop needed)
   - Shows up to 3 drugs per paper

6. **`/src/components/MarketMap.tsx`**
   - Displays drug badges from `trial.extractedDrugs` in ranked trial cards
   - Shows up to 3 drugs per trial

7. **`/src/components/DrugDetail.tsx`** & **`/src/components/DrugDetailModal.tsx`**
   - No changes needed - child components read data directly from objects

---

## Status

✅ **Feature Complete**
✅ **No Linter Errors**
✅ **Uses Existing Data**
✅ **Light Blue Styling**
✅ **Limited to 3 Drugs per Item**
✅ **Deduplicated Display**

