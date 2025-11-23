# Integration Tests Guide

This guide explains how to run full integration tests that call real APIs (Gemini, ClinicalTrials.gov, PubMed).

## Prerequisites

1. **Environment Variables**: Ensure `GOOGLE_GEMINI_API_KEY` is set
2. **Dev Server**: Tests run against `http://localhost:5173`

## Running Integration Tests

### Option 1: Automated Script (Recommended)

```bash
npm run test:integration
```

or

```bash
./run-integration-tests.sh
```

This script will:
1. Check if dev server is running (start it if needed)
2. Wait for server to be ready
3. Run integration tests
4. Stop server (if it started it)

### Option 2: Manual (Two Terminals)

**Terminal 1 - Start Dev Server:**
```bash
npm run dev
```

Wait for: `Local: http://localhost:5173/`

**Terminal 2 - Run Integration Tests:**
```bash
TEST_SERVER_URL=http://localhost:5173 npm run test:run -- search-clinical-trials.test.ts
```

### Option 3: Unit Tests Only (No Server)

To run tests without a server (will have 0 results but validates code):
```bash
npm run test:run
```

## Test Files

### Integration Tests
- **`test/search-clinical-trials.test.ts`** - Phase-aware search with real APIs
  - Tests LLM-generated queries include correct phases
  - Validates ClinicalTrials.gov returns matching results
  - Calls real Gemini API, ClinicalTrials.gov API

### Unit Tests  
- **`test/extract-drug-names.test.ts`** - Drug extraction with placebo filtering
  - Calls real Gemini API
  - Validates exclusion rules work

## Environment Variables

### Required
- `GOOGLE_GEMINI_API_KEY` - For search enhancement and drug extraction

### Optional (for testing)
- `TEST_SERVER_URL` - Override server URL (default: `http://localhost:5173`)
  ```bash
  TEST_SERVER_URL=http://localhost:3000 npm run test:run
  ```

## Architecture

### How Services Handle URLs

The services (`gatherSearchResults.ts`, `pubmedAPI.ts`) detect the environment:

```typescript
function getApiBaseUrl(): string {
  // In test environment with TEST_SERVER_URL
  if (process.env?.TEST_SERVER_URL) {
    return process.env.TEST_SERVER_URL;
  }
  
  // In browser (relative URLs work)
  if (typeof window !== 'undefined') {
    return '';
  }
  
  // In Node.js (fallback to localhost)
  return 'http://localhost:5173';
}
```

This allows the same code to work in:
- **Browser**: Uses relative URLs like `/api/enhance-search`
- **Tests with server**: Uses `http://localhost:5173/api/enhance-search`
- **Tests without server**: Falls back gracefully

## Expected Test Behavior

### With Dev Server Running ✅
- LLM generates 5 phase-aware search queries
- ClinicalTrials.gov returns real trial data
- Tests validate phase matching in results
- Full integration validation

### Without Dev Server ⚠️
- Tests pass with 0 trials (graceful fallback)
- Validates code structure
- Doesn't test actual API integration

## Troubleshooting

### Tests show "0 trials"
- ✅ **Check**: Is dev server running? (`npm run dev`)
- ✅ **Check**: Is `TEST_SERVER_URL` set correctly?
- ✅ **Check**: Can you access `http://localhost:5173` in browser?

### "Failed to parse URL" errors
- This means the service is trying to use relative URLs in Node.js
- ✅ **Solution**: Make sure `TEST_SERVER_URL` environment variable is set
- ✅ **Solution**: Run `npm run test:integration` instead of `npm run test:run`

### Server won't start
- ✅ **Check**: Port 5173 isn't already in use
- ✅ **Try**: Kill existing process: `lsof -ti:5173 | xargs kill -9`
- ✅ **Try**: Use different port: `PORT=3000 npm run dev`

### Gemini API errors
- ✅ **Check**: `GOOGLE_GEMINI_API_KEY` is set
- ✅ **Check**: API key is valid
- ✅ **Check**: You have quota remaining

## CI/CD Integration

For continuous integration, use the automated script:

```yaml
# .github/workflows/test.yml
- name: Run integration tests
  run: |
    npm run test:integration
  env:
    GOOGLE_GEMINI_API_KEY: ${{ secrets.GOOGLE_GEMINI_API_KEY }}
```

## Test Output

Successful integration test output:
```
📋 User Query: "Alzheimer's drugs in Phase 2 trials"

🔍 LLM Generated 5 Search Strategies:
  1. "Phase 2 Alzheimer beta-amyloid inhibitor" (25 trials)
  2. "Phase 2 Alzheimer tau protein" (18 trials)
  3. "Phase 2 cognitive decline neurodegeneration" (32 trials)
  4. "Phase 2 Alzheimer immunotherapy" (15 trials)
  5. "Phase 2 dementia neuroprotection" (22 trials)

📊 Total Trials Retrieved: 89

📈 Phase Distribution:
  Phase 2: 89 trials

✅ All trials are Phase 2 or include Phase 2
```

## Performance

Integration tests take longer due to real API calls:
- **LLM query generation**: ~2-5 seconds per query
- **ClinicalTrials.gov**: ~3-10 seconds per query
- **Total per test**: ~30-60 seconds
- **Full suite**: ~3-5 minutes

Use `npm run test:run` (without server) for quick validation during development.

