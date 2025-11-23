# Drug Deduplication JSON Parsing Fix

## Problem
Users were seeing this error:
```
Error: Failed to extract drug names: Drug deduplication failed: 
Expected ',' or ']' after array element in JSON at position 5041 (line 205 column 6). 
Please try again.
```

This was causing the entire search to fail when the LLM (Gemini) returned malformed JSON during the drug deduplication step.

---

## Root Causes

1. **Malformed JSON from LLM**: Gemini API sometimes returns JSON with:
   - Trailing commas (`,]` or `,}`)
   - Comments (`//` or `/* */`)
   - Extra text outside the JSON object
   - Truncated responses due to token limits

2. **Critical Failure Mode**: Deduplication failure caused entire search to fail, even though deduplication is a "nice-to-have" enhancement feature.

---

## Solutions Implemented

### 1. Enhanced JSON Parsing (Lines 321-353)

**Added robust JSON cleaning:**

```typescript
// Remove markdown code blocks
if (cleanedContent.startsWith('```json')) {
  cleanedContent = cleanedContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
} else if (cleanedContent.startsWith('```')) {
  cleanedContent = cleanedContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
}

// Extract JSON object (find first { to last })
const firstBrace = cleanedContent.indexOf('{');
const lastBrace = cleanedContent.lastIndexOf('}');
if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
  cleanedContent = cleanedContent.substring(firstBrace, lastBrace + 1);
}

// Fix common JSON errors from LLMs
// Remove trailing commas before ] or }
cleanedContent = cleanedContent.replace(/,(\s*[\]}])/g, '$1');

// Remove comments (// and /* */)
cleanedContent = cleanedContent.replace(/\/\/.*$/gm, '');
cleanedContent = cleanedContent.replace(/\/\*[\s\S]*?\*\//g, '');

// Better error reporting
try {
  result = JSON.parse(cleanedContent);
} catch (parseError) {
  console.error('Failed to parse deduplication response:', cleanedContent);
  console.error('Parse error:', parseError);
  throw new Error(`Invalid JSON in deduplication response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
}
```

**What this fixes:**
- ✅ Handles trailing commas
- ✅ Removes LLM comments
- ✅ Extracts JSON from mixed content
- ✅ Better error messages with actual content logged

---

### 2. Graceful Degradation with User Notification (Lines 199-248)

**Added fallback to basic deduplication with user notification:**

```typescript
// Try to deduplicate, but if it fails, continue with undeduped list
let deduplicatedDrugs: DrugInfo[];
let deduplicationWarning: string | undefined;

try {
  deduplicatedDrugs = await this.deduplicateDrugs(allDrugs);
  console.log(`✅ Deduplication successful: ${allDrugs.length} → ${deduplicatedDrugs.length} drugs`);
} catch (error) {
  const errorMsg = error instanceof Error ? error.message : 'Unknown error';
  console.warn('⚠️ Deduplication failed, using basic deduplication:', errorMsg);
  
  // Fall back to basic deduplication by name (case-insensitive)
  const seen = new Map<string, DrugInfo>();
  for (const drug of allDrugs) {
    const key = drug.name.toLowerCase();
    const existing = seen.get(key);
    // Keep the one with higher confidence
    if (!existing || drug.confidence === 'high' || (drug.confidence === 'medium' && existing.confidence === 'low')) {
      seen.set(key, drug);
    }
  }
  deduplicatedDrugs = Array.from(seen.values());
  console.log(`📋 Basic deduplication: ${allDrugs.length} → ${deduplicatedDrugs.length} drugs`);
  
  // Set warning message for user
  deduplicationWarning = `⚠️ Advanced deduplication unavailable. Using basic deduplication - some duplicate drugs (brand/generic names) may appear separately in results.`;
}

// Return warning along with results
return {
  allDrugs: deduplicatedDrugs,
  trialDrugs,
  paperDrugs,
  uniqueDrugNames,
  deduplicationWarning  // ← New field
};
```

**What this fixes:**
- ✅ Search continues even if LLM deduplication fails
- ✅ Falls back to simple name-based deduplication
- ✅ Clear logging shows when fallback is used
- ✅ Users still get results (may have more duplicates)
- ✅ **Warning message displayed in chat UI** to inform users
- ✅ Users understand why they might see duplicate brand/generic names

---

## Why This Fallback Is Acceptable

This is different from the "bad fallbacks" we removed earlier:

| Aspect | Bad Fallbacks (Removed) | This Fallback (Acceptable) |
|--------|------------------------|----------------------------|
| **Feature Type** | Core functionality (extraction, search) | Enhancement (synonym merging) |
| **Impact** | Masking failures with fake/empty data | Degraded quality but valid results |
| **Visibility** | Silent failures | Clear warning logs |
| **User Experience** | Confusing (no data vs failed) | Acceptable (more duplicates) |

**Deduplication is "nice-to-have" because:**
- Search results are still valid without it
- Users can manually identify duplicates
- The basic fallback still removes exact duplicates
- It only affects result organization, not correctness

---

## What Users Will See Now

### Scenario 1: LLM Deduplication Succeeds ✅
```
Console: ✅ Deduplication successful: 145 → 87 drugs
Result: Clean list with brand/generic names merged
```

### Scenario 2: LLM Returns Bad JSON, But Cleaning Fixes It ✅
```
Console: [Cleaned trailing commas and comments]
Console: ✅ Deduplication successful: 145 → 87 drugs
Result: Clean list with brand/generic names merged
```

### Scenario 3: LLM Deduplication Completely Fails ⚠️
```
Console: ⚠️ Deduplication failed, using basic deduplication: [error details]
Console: 📋 Basic deduplication: 145 → 132 drugs
Chat UI: ⚠️ Advanced deduplication unavailable. Using basic deduplication - 
         some duplicate drugs (brand/generic names) may appear separately in results.
Result: List with some duplicates (e.g., "Keytruda" and "Pembrolizumab" separate)
User Impact: More items in list, but still functional. User is informed via chat message.
```

### Scenario 4: Complete Search Failure (other errors) ❌
```
Console: Error executing search suggestion: [error]
UI: ❌ Search failed: [error message]
      Please try again or contact support if the issue persists.
Result: Error shown in chat, user stays on results screen
```

---

## Testing Recommendations

1. **Normal Flow**: Search for common drugs (should use LLM deduplication)
2. **Stress Test**: Search with many results (might trigger JSON truncation)
3. **API Failure**: Temporarily break Gemini key (should use basic dedup)
4. **Console Monitoring**: Watch for warning messages about dedup failures

---

## Files Modified

1. `/src/services/extractDrugNames.ts` (Lines 178-247, 321-368)
   - Enhanced JSON parsing with cleaning
   - Added graceful degradation for deduplication
   - Added `deduplicationWarning` to return type
   - Captures and returns warning message when fallback is used

2. `/src/components/Dashboard.tsx` (Lines 489-507)
   - Displays deduplication warning in chat when present
   - Shows user-friendly message about fallback mode

---

### 3. Frontend Display (Dashboard.tsx Lines 489-507)

**Display warning in chat:**

```typescript
// Add final message to chat
const chatMessages: Array<{type: 'system' | 'user', message: string, searchSuggestions: any[]}> = [
  { 
    type: 'system' as const, 
    message: `Discovery complete! Found ${filteredDrugGroups.length} drugs...`,
    searchSuggestions: []
  }
];

// Add deduplication warning if present
if (drugExtractionResult.deduplicationWarning) {
  chatMessages.push({
    type: 'system' as const,
    message: drugExtractionResult.deduplicationWarning,
    searchSuggestions: []
  });
}

setChatHistory(prev => [...prev, ...chatMessages]);
```

**What this adds:**
- ✅ Warning appears as separate chat message after success message
- ✅ Only shown when deduplication actually fails
- ✅ Clear, user-friendly explanation
- ✅ Users understand results are still valid, just less refined

---

## Status

✅ **Fix Complete**
✅ **No Linter Errors**
✅ **Graceful Degradation Implemented**
✅ **Better Error Messages**
✅ **Search Won't Fail Due to Deduplication**
✅ **Warning Displayed to Users in Chat**

