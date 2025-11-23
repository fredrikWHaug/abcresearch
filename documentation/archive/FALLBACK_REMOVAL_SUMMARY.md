# Fallback Removal Summary

## Overview
Removed silent fallback behaviors across the codebase to ensure errors are properly thrown, caught, and displayed to users in the frontend/logs.

---

## Changes Made

### 1. ✅ API: `generate-asset-pipeline-table.ts` (Lines 201-216)

**Before:**
```typescript
catch (error) {
  console.error(`Error extracting data for ${drugGroup.drugName}:`, error);
  
  // Return fallback data with low confidence
  return {
    id: drugGroup.drugName.toLowerCase(),
    scientificName: drugGroup.drugName,
    sponsorCompany: drugGroup.trials[0]?.sponsors?.lead || 'Unknown',
    stage: drugGroup.trials[0]?.phase?.includes('Phase 3') ? 'Phase III' : 'Phase II',
    technologies: 'Unknown',
    mechanismOfAction: 'Unknown',
    indications: drugGroup.trials[0]?.conditions || [],
    lastTrialStartDate: drugGroup.trials[0]?.startDate,
    confidence: 0.3 // Low confidence for fallback
  };
}
```

**After:**
```typescript
catch (error) {
  console.error(`Error extracting data for ${drugGroup.drugName}:`, error);
  throw error;
}
```

**Why:** Returning fake data with 0.3 confidence was misleading. Users should know when extraction fails.

---

### 2. ✅ API: `extract-drug-names.ts` (Lines 120-129)

**Before:**
```typescript
if (!response.ok) {
  const errorText = await response.text();
  console.error('Gemini API error:', errorText);
  
  // Fallback to empty response if Gemini fails
  return res.status(200).json({
    success: true,
    drugs: []
  });
}
```

**After:**
```typescript
if (!response.ok) {
  const errorText = await response.text();
  console.error('Gemini API error:', errorText);
  
  return res.status(500).json({
    success: false,
    error: 'Drug extraction failed',
    details: errorText
  });
}
```

**Why:** Empty array masks API failures. Users think no drugs exist instead of knowing extraction failed.

---

### 3. ✅ API: `extract-drug-names.ts` (Lines 154-160)

**Before:**
```typescript
catch (parseError) {
  console.error('Failed to parse Gemini response:', content);
  console.error('Parse error:', parseError);
  
  // Fallback: return empty array
  result = { drugs: [] };
}
```

**After:**
```typescript
catch (parseError) {
  console.error('Failed to parse Gemini response:', content);
  console.error('Parse error:', parseError);
  
  return res.status(500).json({
    success: false,
    error: 'Failed to parse drug extraction response',
    details: parseError instanceof Error ? parseError.message : 'Unknown parsing error'
  });
}
```

**Why:** Same issue - empty array masks parse failures.

---

### 4. ✅ API: `enhance-search.ts` (Lines 69-89)

**Before:**
```typescript
if (!response.ok) {
  const errorText = await response.text();
  console.error('Gemini API error:', errorText);
  
  // Fallback to basic search strategies
  return res.status(200).json({
    success: true,
    strategies: [
      {
        query: query,
        queryTerm: query,
        phase: '',
        interventionName: '',
        description: 'Original query',
        priority: 'high',
        searchType: 'targeted'
      }
    ],
    totalStrategies: 1
  });
}
```

**After:**
```typescript
if (!response.ok) {
  const errorText = await response.text();
  console.error('Gemini API error:', errorText);
  
  return res.status(500).json({
    success: false,
    error: 'Search enhancement failed',
    details: errorText
  });
}
```

**Why:** Although search could work without enhancement, masking the error prevents debugging and monitoring of API issues.

---

### 5. ✅ API: `enhance-search.ts` (Lines 125-141)

**Before:**
```typescript
catch (parseError) {
  console.error('Failed to parse Gemini response:', content);
  console.error('Parse error:', parseError);
  
  // Fallback: return basic strategies
  strategies = [
    {
      query: query,
      queryTerm: query,
      phase: '',
      interventionName: '',
      description: 'Original query',
      priority: 'high',
      searchType: 'targeted'
    }
  ];
}
```

**After:**
```typescript
catch (parseError) {
  console.error('Failed to parse Gemini response:', content);
  console.error('Parse error:', parseError);
  
  return res.status(500).json({
    success: false,
    error: 'Failed to parse search enhancement response',
    details: parseError instanceof Error ? parseError.message : 'Unknown parsing error'
  });
}
```

**Why:** Parse errors indicate API issues that need to be surfaced, not hidden.

---

### 6. ✅ Service: `extractDrugNames.ts` (Lines 46-62)

**Before:**
```typescript
if (!response.ok) {
  const errorData = await response.json().catch(() => ({}));
  console.error('Drug extraction API error:', errorData);
  return [];
}

const data: ExtractDrugNamesResponse = await response.json();

if (!data.success) {
  return [];
}

return data.drugs || [];
} catch (error) {
  console.error('Error calling extract-drug-names API:', error);
  return [];
}
```

**After:**
```typescript
if (!response.ok) {
  const errorData = await response.json().catch(() => ({}));
  console.error('Drug extraction API error:', errorData);
  throw new Error(errorData.error || `Drug extraction failed: ${response.status}`);
}

const data: ExtractDrugNamesResponse = await response.json();

if (!data.success) {
  throw new Error(data.error || 'Drug extraction failed');
}

return data.drugs || [];
} catch (error) {
  console.error('Error calling extract-drug-names API:', error);
  throw error;
}
```

**Why:** Frontend service was silently swallowing errors by returning empty arrays.

---

### 7. ✅ Service: `gatherSearchResults.ts` (Lines 209-216)

**Before:**
```typescript
} catch (error) {
  console.error('Error enhancing search query:', error);
  // Fallback to basic search if enhancement fails
  return [{
    query: userQuery,
    description: 'Original query (fallback)',
    priority: 'high',
    searchType: 'broad'
  }];
}
```

**After:**
```typescript
} catch (error) {
  console.error('Error enhancing search query:', error);
  // Re-throw the error to be handled by the caller
  throw new Error(`Search enhancement failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
}
```

**Why:** Service was masking enhancement failures. Errors should propagate to UI.

---

### 8. ✅ Documentation: `FLEXIBLE_SEARCH_IMPLEMENTATION.md` (Lines 575-585)

Updated documentation to reflect that parse errors now throw proper errors instead of falling back.

---

### 9. ✅ Service: `extractDrugNames.ts` - Interface Update

**Added:**
```typescript
interface ExtractDrugNamesResponse {
  success: boolean;
  drugs: Omit<DrugInfo, 'source' | 'sourceType'>[];
  error?: string;      // NEW
  details?: string;    // NEW
}
```

**Why:** Added error fields to support new error response format from API.

---

## Fallbacks That Were KEPT (Intentional & Necessary)

### ✅ Python: `graphify_images.py` (Lines 266-274)
**Why:** Individual image failure shouldn't break entire PDF extraction. Error is captured and returned in results.

### ✅ API: `extract-pdf-content.ts` (Lines 288-295)
**Why:** Same rationale - partial results better than total failure for batch image processing.

### ✅ Service: `gatherSearchResults.ts` - `simpleSearch()` method
**Why:** This is an intentional alternative method, not error handling. It's never actually called in the codebase.

### ✅ Component: `AssetDevelopmentPipeline.tsx` (Lines 129-133)
**Why:** Showing mock data when no real data exists is appropriate for empty state. Has clear UI indicator.

---

## Impact

### Before
- **Silent failures** masked by fallbacks
- **Empty results** confused users (no data vs. extraction failed)
- **Fake data** (0.3 confidence) misleading
- **Hard to debug** - errors hidden in logs

### After
- **Errors propagate** to UI/logs
- **Clear error messages** inform users
- **No fake data** - fail explicitly
- **Easy to debug** - errors visible

---

## Testing Recommendations

1. **Test API Failures:**
   - Disable API keys temporarily
   - Verify error messages display in frontend
   - Check logs show proper error details

2. **Test Parse Failures:**
   - Mock malformed API responses
   - Verify error handling displays meaningful messages

3. **Test Network Failures:**
   - Simulate network timeout/disconnection
   - Verify graceful error handling

4. **Test UI Error Display:**
   - Verify all error states show user-friendly messages
   - Check that errors don't crash the application
   - Ensure users can recover from errors

---

## Files Modified

1. `/api/generate-asset-pipeline-table.ts` - Removed fake data fallback
2. `/api/extract-drug-names.ts` - Return errors instead of empty arrays (2 places)
3. `/api/enhance-search.ts` - Return errors instead of basic strategies (2 places)
4. `/src/services/extractDrugNames.ts` - Throw errors instead of returning empty arrays
5. `/src/services/gatherSearchResults.ts` - Throw errors instead of basic strategies
6. `/FLEXIBLE_SEARCH_IMPLEMENTATION.md` - Updated documentation

---

## Status

✅ **All Changes Complete**
✅ **No Linter Errors**
✅ **Documentation Updated**
✅ **Ready for Testing**

