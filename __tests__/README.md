# ABCresearch Test Suite

Modern, comprehensive test suite following industry best practices for React 19 + TypeScript + Vitest.

## Architecture

```
__tests__/
├── unit/              # Fast, isolated unit tests
├── integration/       # Service + database integration tests
├── e2e/              # End-to-end user workflow tests
├── fixtures/         # Test data and mock objects
├── helpers/          # Shared test utilities
└── setup/            # Test environment configuration
```

## Test Categories

### Unit Tests (`__tests__/unit/`)
**Purpose**: Test individual functions/components in isolation
**Speed**: < 100ms per test
**Mocking**: Heavy - mock all external dependencies

**Structure**:
- `services/` - Business logic tests
- `utils/` - Utility function tests
- `components/` - React component tests

**Example**:
```typescript
// __tests__/unit/services/projectService.test.ts
import { createProject } from '@/services/projectService'

describe('projectService', () => {
  it('should validate project name', () => {
    expect(() => createProject('')).toThrow('Name required')
  })
})
```

### Integration Tests (`__tests__/integration/`)
**Purpose**: Test interactions between layers (services + database, API + services)
**Speed**: 100ms - 1s per test
**Mocking**: Minimal - use real database with test data

**Structure**:
- `auth/` - Authentication and authorization flows
- `api/` - API endpoint tests with real services
- `database/` - Database operations and migrations

**Example**:
```typescript
// __tests__/integration/auth/guestMode.test.ts
import { render } from '@testing-library/react'
import { App } from '@/App'

describe('Guest Mode', () => {
  it('should allow guests to search without creating projects', async () => {
    // Test full auth flow with real components
  })
})
```

### E2E Tests (`__tests__/e2e/`)
**Purpose**: Test complete user workflows from start to finish
**Speed**: 1s - 10s per test
**Mocking**: None - test as close to production as possible

**Structure**:
- Full user journeys (login, search, save, load)
- Critical path testing
- Cross-browser testing (future: Playwright)

## Running Tests

```bash
# All tests (watch mode)
npm test

# Run once (CI mode)
npm run test:run

# With coverage
npm run test:ci

# Specific category
npm run test:unit
npm run test:integration
npm run test:e2e

# Watch mode
npm run test:watch

# UI mode
npm run test:ui
```

## Coverage Requirements

| Metric     | Threshold | Rationale                          |
|------------|-----------|-------------------------------------|
| Statements | 60%       | Core business logic coverage        |
| Branches   | 60%       | Decision path validation            |
| Functions  | 50%       | Lower for React components          |
| Lines      | 60%       | Overall code coverage               |

## Test Patterns

### 1. Arrange-Act-Assert (AAA)
```typescript
it('should save project', async () => {
  // Arrange
  const project = createMockProject({ name: 'Test' })
  
  // Act
  const saved = await saveProject(project)
  
  // Assert
  expect(saved.id).toBeDefined()
})
```

### 2. Test Data Factories
Use fixtures and factories for consistent test data:
```typescript
import { createMockTrial } from '@tests/fixtures/trials'

const trial = createMockTrial({ phase: ['Phase 2'] })
```

### 3. Test Helpers
Use shared helpers for common operations:
```typescript
import { renderWithAuth } from '@tests/helpers/renderHelpers'

const { user } = renderWithAuth(<Dashboard />, { isGuest: true })
```

### 4. Database Testing
```typescript
import { createTestUser, cleanupTestData } from '@tests/helpers/supabaseHelpers'

beforeAll(async () => {
  testUser = await createTestUser()
})

afterAll(async () => {
  await cleanupTestData(testUser.id)
})
```

## Writing New Tests

### For New Features
1. **Start with unit tests** - Test business logic in isolation
2. **Add integration tests** - Test how pieces work together
3. **Add e2e tests** - Test critical user paths

### For Bug Fixes
1. **Write failing test** - Reproduce the bug
2. **Fix the bug** - Implement solution
3. **Verify test passes** - Confirm fix works

### Test Naming
```typescript
describe('ComponentName or ServiceName', () => {
  describe('method or feature', () => {
    it('should do something specific when condition', () => {
      // test
    })
  })
})
```

## Debugging Tests

### Run single test file
```bash
npm test -- guestMode.test.ts
```

### Run with debugger
```bash
node --inspect-brk node_modules/.bin/vitest run
```

### UI mode (best for debugging)
```bash
npm run test:ui
```

## CI/CD Integration

Tests run automatically on:
- ✅ Every push to any branch
- ✅ Every pull request
- ✅ Before deployment to main

**Pipeline**:
1. Install dependencies (`npm ci`)
2. Run linter (`npm run lint`)
3. Run tests with coverage (`npm run test:ci`)
4. Upload coverage reports
5. Deploy (only if all pass + main branch)

## Environment Variables

Tests use the same environment variables as the app:
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Public anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (CI only, bypasses RLS)

## Troubleshooting

### "No tests found"
- Check file naming: `*.test.{ts,tsx}`
- Check location: Must be in `__tests__/`

### "RLS policy violation"
- Use `SUPABASE_SERVICE_ROLE_KEY` in CI
- Or create authenticated test user

### "Tests pass locally but fail in CI"
- Check environment variables in GitHub secrets
- Run `npm ci` instead of `npm install`
- Run `npm run test:ci` locally to simulate CI

## Best Practices

✅ **DO**:
- Keep tests fast (< 1s for unit tests)
- Test behavior, not implementation
- Use descriptive test names
- Clean up test data in `afterAll`
- Mock external APIs (Claude, ClinicalTrials.gov)
- Use factories for test data
- Test error cases and edge cases

❌ **DON'T**:
- Commit failing tests (unless bug detection tests in legacy)
- Test implementation details (private methods, internal state)
- Make real API calls that cost money
- Leave test data in database
- Couple tests together (each test should be independent)
- Use magic numbers or hardcoded IDs

## Resources

- [Vitest Docs](https://vitest.dev)
- [Testing Library Docs](https://testing-library.com/react)
- [React Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- Project: `documentation/` for architecture details

---

**Questions?** Check `__tests_legacy__/README.md` for information about the old test suite.

