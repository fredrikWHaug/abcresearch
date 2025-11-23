# Drug Deduplication API Key Error - Fix Summary

## Problem

Users were intermittently seeing this error in the browser console:

```
Gemini API key not configured for drug deduplication
⚠️ Deduplication failed, using basic deduplication: Gemini API key not configured for drug deduplication
```

Even though the Gemini API key was working for other features like search enhancement and drug extraction.

## Root Cause

The issue was in `src/services/extractDrugNames.ts` (lines 267-272):

```typescript
const geminiApiKey = import.meta.env.VITE_GOOGLE_GEMINI_API_KEY;
if (!geminiApiKey) {
  const error = 'Gemini API key not configured for drug deduplication';
  console.error(error);
  throw new Error(error);
}
```

**Three problems with this approach:**

1. **Security Issue**: The code was trying to access the Gemini API key directly in the browser, which exposes sensitive credentials to the client
2. **Configuration Issue**: The API key was set as `GOOGLE_GEMINI_API_KEY` (without `VITE_` prefix) for server-side use, making it unavailable in the browser environment
3. **Architectural Inconsistency**: All other Gemini API calls in the codebase happen server-side through API routes (e.g., `/api/extract-drug-names`, `/api/enhance-search`), but deduplication was calling Gemini directly from the browser

## Why It Was Intermittent

The error appeared intermittent because:
- It only occurred when drug deduplication was triggered (when multiple drugs were found)
- Basic deduplication fallback worked silently, so users didn't see the full impact
- Some environments might have had `VITE_GOOGLE_GEMINI_API_KEY` set while others didn't

## Solution

### 1. Created New Server-Side API Endpoint

Created `/api/deduplicate-drugs.ts` that:
- Runs server-side with access to `process.env.GOOGLE_GEMINI_API_KEY`
- Keeps the API key secure (never exposed to browser)
- Follows the same pattern as other API endpoints in the codebase

**Key features:**
- Takes an array of `DrugInfo` objects
- Calls Gemini API to deduplicate drug names
- Handles brand/generic name merging (e.g., "Keytruda" → "Pembrolizumab")
- Combines sources when merging drugs
- Preserves highest confidence level when merging
- Returns deduplicated drugs with metadata intact

### 2. Updated Client-Side Service

Modified `src/services/extractDrugNames.ts` to:
- Call the new `/api/deduplicate-drugs` endpoint instead of directly accessing Gemini
- Removed browser-side API key check (lines 267-272)
- Simplified the `deduplicateDrugs` method from 147 lines to 27 lines
- Improved error handling

**Before (147 lines):**
```typescript
private static async deduplicateDrugs(drugs: DrugInfo[]): Promise<DrugInfo[]> {
  // Check for API key in browser
  const geminiApiKey = import.meta.env.VITE_GOOGLE_GEMINI_API_KEY;
  if (!geminiApiKey) {
    throw new Error('Gemini API key not configured');
  }
  
  // 140+ lines of direct Gemini API calls, JSON parsing, etc.
}
```

**After (27 lines):**
```typescript
private static async deduplicateDrugs(drugs: DrugInfo[]): Promise<DrugInfo[]> {
  // Call server-side API endpoint
  const response = await fetch('/api/deduplicate-drugs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ drugs })
  });
  
  const data = await response.json();
  return data.drugs;
}
```

### 3. Added Comprehensive Tests

Created `/api/__tests__/deduplicate-drugs.test.ts` with 10 test cases:

✅ All 10 tests passing:
- Reject non-POST requests
- Reject requests without drugs array
- Return drugs as-is if only 1 drug
- Return 500 if API key not configured
- Deduplicate drugs using Gemini API
- Handle JSON in markdown code blocks
- Handle Gemini API errors
- Handle invalid JSON responses
- Combine sources when merging drugs
- Preserve highest confidence when merging

## Architecture Comparison

### Before (❌ Insecure)

```
Browser (extractDrugNames.ts)
  ↓
  Access: import.meta.env.VITE_GOOGLE_GEMINI_API_KEY
  ↓
  Call Gemini API directly with exposed key
  ↓
  Parse and process response
```

**Problems:**
- API key exposed to browser
- Configuration mismatch (`VITE_` prefix required but not set)
- Inconsistent with other API patterns

### After (✅ Secure)

```
Browser (extractDrugNames.ts)
  ↓
  Call: POST /api/deduplicate-drugs
  ↓
Server (deduplicate-drugs.ts)
  ↓
  Access: process.env.GOOGLE_GEMINI_API_KEY
  ↓
  Call Gemini API securely
  ↓
  Return: deduplicated drugs
  ↓
Browser: Receive and display results
```

**Benefits:**
- API key never exposed to browser
- Consistent with other API endpoints
- Better error handling
- Easier to test and maintain

## Configuration

No changes needed to environment variables! The existing `GOOGLE_GEMINI_API_KEY` environment variable (without `VITE_` prefix) now works correctly because it's only accessed server-side.

**Environment Variables (unchanged):**
```bash
# .env or Vercel environment variables
GOOGLE_GEMINI_API_KEY=your_gemini_api_key_here
```

**Note:** Do NOT add `VITE_GOOGLE_GEMINI_API_KEY` - this would expose the key to the browser.

## Files Changed

### New Files
- `/api/deduplicate-drugs.ts` - New server-side deduplication endpoint (185 lines)
- `/api/__tests__/deduplicate-drugs.test.ts` - Comprehensive test suite (239 lines)

### Modified Files
- `/src/services/extractDrugNames.ts` - Updated to call new API endpoint
  - Removed direct Gemini API access from browser
  - Simplified `deduplicateDrugs` method from 147 to 27 lines
  - Better error messages

## Testing

Run the tests:
```bash
npm run test:run api/__tests__/deduplicate-drugs.test.ts
```

**Expected Output:**
```
✓ api/__tests__/deduplicate-drugs.test.ts (10 tests) 6ms
Test Files  1 passed (1)
     Tests  10 passed (10)
```

## User Impact

**Before:**
- ❌ Intermittent error messages in console
- ❌ Deduplication silently falling back to basic mode
- ❌ Duplicate drugs appearing (e.g., "Keytruda" and "Pembrolizumab" listed separately)

**After:**
- ✅ No error messages (deduplication works reliably)
- ✅ Advanced LLM-based deduplication always active
- ✅ Cleaner drug lists with brand/generic names properly merged

## Security Improvements

1. **API Key Protection**: Gemini API key no longer exposed to browser
2. **Server-Side Validation**: Input validation happens server-side
3. **Error Handling**: Detailed errors logged server-side, user-friendly messages sent to client
4. **Consistent Pattern**: Matches security pattern used by other API endpoints

## Deployment Checklist

- [x] New API endpoint created
- [x] Client service updated
- [x] Tests added and passing
- [x] No linting errors
- [x] No environment variable changes needed
- [x] Backward compatible (fallback to basic deduplication still works)

## Related Files

**Deduplication:**
- `/api/deduplicate-drugs.ts` - New server-side endpoint
- `/src/services/extractDrugNames.ts` - Client-side service

**Similar Patterns (for reference):**
- `/api/extract-drug-names.ts` - Drug extraction API (server-side Gemini call)
- `/api/enhance-search.ts` - Search enhancement API (server-side Gemini call)
- `/api/search.ts` - Query parsing API (server-side Gemini call)

All Gemini API calls now consistently happen server-side! 🎉

## Summary

The "Gemini API key not configured" error was caused by trying to access the API key directly in the browser. The fix moves the deduplication logic to a secure server-side endpoint, matching the architecture used by all other Gemini API integrations in the codebase. This eliminates the intermittent error and improves security.

**Key Changes:**
- ✅ Security: API key no longer exposed to browser
- ✅ Reliability: Error eliminated by using proper server-side configuration
- ✅ Architecture: Consistent with other API endpoints
- ✅ Maintainability: Cleaner code with better separation of concerns
- ✅ Testing: Comprehensive test coverage added

