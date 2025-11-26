# Legacy Test Archive

**Status**: DEPRECATED - Tests moved here on [Date] as part of HW11 test suite modernization.

## Why These Tests Are Archived

These tests were part of the original test suite but had several issues:
- Inconsistent organization across multiple directories
- Mixed concerns (unit, integration, and e2e tests all intermingled)
- Some tests were failing and committed (bug detection tests)
- No clear testing strategy or patterns
- Not integrated with CI/CD pipeline

## What's Here

- `test/` - Original integration tests (migration, search, drug extraction)
- `api-tests/` - API endpoint tests from `/api/__tests__/`
- `src-test/` - Frontend test utilities from `/src/test/`
- `services-tests/` - Service layer tests from `/src/services/__tests__/`
- `api-utils-tests/` - API utility tests from `/api/utils/__tests__/`
- `PDFExtraction.test.tsx` - Component tests from `/src/components/`
- `PDFExtraction.enhanced.test.tsx` - Enhanced component tests

## Using These Tests

These tests are NOT run by the main test suite. To run them:

```bash
# Not recommended - they may fail or be outdated
npm run test:legacy
```

## Migration Path

If you want to modernize one of these tests:
1. Review the test file for useful test cases
2. Create a new test in `__tests__/` following modern patterns
3. Use test helpers from `__tests__/helpers/`
4. Follow the separation: unit/integration/e2e
5. Document the migration in this file

## Modern Test Suite

See `__tests__/README.md` for the new test architecture.

---

**DO NOT** add new tests to this directory. All new tests go in `__tests__/`.

