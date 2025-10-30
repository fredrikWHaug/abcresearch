# Test Suite for ABC Research

This directory contains tests for the ABC Research application, focusing on bug detection and validation.

## Test Files

### 1. `search-clinical-trials.test.ts`
Tests for the Clinical Trials Search API with focus on **Phase Filtering Bug**.

**Bug Description:** Trials that don't match the clinical PHASE specified in the user query are being included in results.

**Test Queries:**
- "Alzheimer's drugs in Phase 2 trials"
- "GLP-1 oral drugs in Phase 3 trials"

**Test Cases:**
- ✓ Only Phase 2 trials returned for Alzheimer's Phase 2 query
- ✓ Only Phase 3 trials returned for GLP-1 Phase 3 query
- ✓ Correct phase query parameter construction
- ✓ Mixed phase trials (e.g., Phase 2/3) handled appropriately
- ✓ Trials in wrong phases are rejected

### 2. `extract-drug-names.test.ts`
Tests for the Drug Name Extraction API with focus on **Placebo Filtering Bug**.

**Bug Description:** The word "placebo" is incorrectly being extracted as a valid drug name.

**Test Queries:**
- "Alzheimer's drugs in Phase 2 trials"
- "GLP-1 oral drugs in Phase 3 trials"

**Test Cases:**
- ✓ Placebo NOT extracted from Alzheimer's trial text
- ✓ Placebo NOT extracted from GLP-1 trial descriptions
- ✓ Common non-drug control terms filtered out (placebo, control, standard of care)
- ✓ Only actual drug names extracted from complex descriptions
- ✓ Multiple mentions of placebo handled correctly
- ✓ Case variations of placebo filtered (PLACEBO, Placebo, placebo)
- ✓ Drug name deduplication works correctly

## Running Tests

### Run all tests (watch mode)
```bash
npm test
```

### Run tests once (CI mode)
```bash
npm run test:run
```

### Run tests with UI
```bash
npm run test:ui
```

### Run tests with coverage
```bash
npm run test:coverage
```

### Run specific test file
```bash
npm test -- search-clinical-trials.test.ts
npm test -- extract-drug-names.test.ts
```

## Test Structure

Each test follows this pattern:

1. **Mock Setup**: Create mock request/response objects
2. **API Call**: Call the handler with test data
3. **Assertion**: Verify the bug is detected or fixed
4. **Logging**: If bug is present, console.error logs details

## Expected Behavior

### When Bugs Are Present
Tests will **FAIL** and output detailed error messages showing:
- Which trials/drugs should have been filtered
- The incorrect data that was returned
- Specific details about what went wrong

### When Bugs Are Fixed
Tests will **PASS** silently, confirming:
- Phase filtering works correctly
- Placebo is not extracted as a drug
- Only valid drugs are returned

## Fixing the Bugs

### Clinical Trials Phase Bug

The issue is in `/api/search-clinical-trials.ts`. The API currently:
1. Sends the phase filter to ClinicalTrials.gov API
2. BUT doesn't validate the returned results match the requested phase

**Suggested Fix:** Add server-side filtering after receiving results:

```typescript
const trials = (data.studies || [])
  .filter((study: any) => {
    // If phase is specified in params, validate the trial matches
    if (params.phase) {
      const trialPhases = study.protocolSection?.designModule?.phases || [];
      return trialPhases.some((p: string) => 
        p.includes(params.phase)
      );
    }
    return true;
  })
  .map((study: any) => ({
    // ... rest of mapping
  }));
```

### Drug Extraction Placebo Bug

The issue is in `/api/extract-drug-names.ts`. The LLM prompt doesn't explicitly exclude placebo.

**Suggested Fix:** Update the prompt to exclude non-drugs:

```typescript
const prompt = `You are a medical AI expert specializing in pharmacology. Extract all drug names, medications, and therapeutic interventions from the following text that are relevant to the user's interests.

Context: ${contextInstructions[context]}${userQueryContext}

Text: "${text}"

Return ONLY a valid JSON object with this exact structure (no markdown, no explanations):

{
  "drugs": [
    {
      "name": "drug name",
      "type": "drug|intervention|therapy",
      "confidence": "high|medium|low"
    }
  ]
}

Rules:
- Extract brand names and generic names
- Include biological therapies, vaccines, and medical interventions
- Set confidence to "high" for standard drug names, "medium" for less common, "low" for uncertain
- For type: "drug" for pharmaceuticals, "intervention" for procedures, "therapy" for treatment approaches
- Return empty array if no drugs found
- Only extract drugs that are relevant to the user's query context
- **DO NOT include placebo, control groups, standard of care, or sham treatments**
- **EXCLUDE any terms that represent comparison groups rather than actual therapeutic agents**
- Only return the JSON object, nothing else`;
```

Alternatively, add post-processing to filter out placebo:

```typescript
// After deduplication
const filteredDrugs = deduplicatedDrugs.filter((drug: DrugInfo) => {
  const nameLower = drug.name.toLowerCase().trim();
  const excludedTerms = ['placebo', 'control', 'sham', 'standard of care'];
  return !excludedTerms.some(term => nameLower === term || nameLower.includes(term));
});

return res.status(200).json({
  success: true,
  drugs: filteredDrugs
});
```

## CI/CD Integration

Add to your CI pipeline:

```yaml
- name: Run tests
  run: npm run test:run
```

## Notes

- These tests use mock data to simulate API responses
- Real API calls are mocked using `vi.fn()`
- Tests focus on the specific bugs mentioned by the user
- Additional edge cases are included for comprehensive coverage

