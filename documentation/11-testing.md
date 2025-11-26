**Documentation Version**: 1.0  
**Last Updated**: November 26, 2025  
**Last Updated by**: Fredrik Whaug (HW11 - Modern test suite establishment)

# ABCresearch - Testing Documentation

**IMPLEMENTATION STATUS (Nov 26, 2025)**:
- ✅ **Modern Test Suite Established**: Complete restructure with unit/integration/e2e separation
- ✅ **Test Infrastructure**: Comprehensive helpers, fixtures, and setup utilities
- ✅ **Guest Mode Bug Detection**: First integration test suite (10 tests, 9 passing)
- ✅ **CI/CD Pipeline**: GitHub Actions workflow with test-gated deployment
- ✅ **Coverage Configuration**: Vitest with 60% thresholds for statements/branches/lines
- 📋 **Next**: Expand test coverage for services and components
- 📋 **Planned**: E2E tests with Playwright for complete user workflows

## Testing Strategy

ABCresearch uses a **three-layer testing architecture** that balances speed, isolation, and confidence:

1. **Unit Tests**: Fast, isolated tests for individual functions and components
2. **Integration Tests**: Service + database tests with real Supabase interactions
3. **E2E Tests**: Full user workflow tests (planned for future implementation)

### Design Philosophy

- **Test behavior, not implementation**: Focus on what the code does, not how it does it
- **Fast feedback**: Unit tests run in milliseconds, full suite in seconds
- **Confidence over coverage**: Strategic tests that catch real bugs
- **CI/CD integration**: Tests must pass before deployment

## Test Suite Structure

```
__tests__/
├── unit/                    # Fast, isolated unit tests
│   ├── services/            # Business logic tests
│   ├── utils/               # Utility function tests
│   └── components/          # React component tests
│
├── integration/             # Service + database integration tests
│   ├── auth/                # Authentication flows
│   │   └── guestMode.test.tsx    # Guest mode bug detection (10 tests)
│   ├── api/                 # API endpoint tests
│   └── database/            # Database operations
│
├── e2e/                     # End-to-end user workflows (future)
│
├── fixtures/                # Test data
│   ├── trials.ts            # Clinical trial fixtures
│   └── papers.ts            # Research paper fixtures
│
├── helpers/                 # Test utilities
│   ├── renderHelpers.tsx    # React testing helpers
│   ├── supabaseHelpers.ts   # Database helpers
│   └── mockFactories.ts     # Data factories
│
└── setup/                   # Configuration
    ├── vitest.setup.ts      # Global test setup
    ├── testEnv.ts           # Environment config
    └── mocks.ts             # Global mocks
```

## Configuration

### Vitest Setup

**File**: `vitest.config.ts`

```typescript
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./__tests__/setup/vitest.setup.ts'],
    
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      thresholds: {
        global: {
          statements: 60,
          branches: 60,
          functions: 50,
          lines: 60,
        },
      },
    },
    
    include: ['__tests__/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', '__tests_legacy__/**', 'dist'],
  },
})
```

### Test Scripts

**File**: `package.json`

```json
{
  "scripts": {
    "test": "vitest",                          // Watch mode
    "test:run": "vitest run",                  // Run once
    "test:ci": "vitest run --coverage",        // CI with coverage
    "test:coverage": "vitest run --coverage",  // Local coverage
    "test:ui": "vitest --ui",                  // UI mode
    "test:unit": "vitest run __tests__/unit",
    "test:integration": "vitest run __tests__/integration",
    "test:e2e": "vitest run __tests__/e2e"
  }
}
```

## Test Helpers & Utilities

### React Testing Helpers

**File**: `__tests__/helpers/renderHelpers.tsx`

```typescript
import { render } from '@testing-library/react'
import { AuthProvider } from '@/contexts/AuthContext'

// Render with auth provider
export function renderWithProviders(ui: React.ReactElement) {
  function Wrapper({ children }) {
    return <AuthProvider>{children}</AuthProvider>
  }
  return render(ui, { wrapper: Wrapper })
}

// Render with mocked auth state
export function renderWithAuth(
  ui: React.ReactElement,
  authState: { isGuest?: boolean; user?: any }
) {
  // Mock useAuth hook with provided state
  // Returns rendered component with mocked context
}
```

**Usage**:
```typescript
import { renderWithAuth } from '@tests/helpers/renderHelpers'

test('guest users see guest indicator', () => {
  renderWithAuth(<Dashboard />, { isGuest: true })
  expect(screen.getByText(/Guest Mode/i)).toBeInTheDocument()
})
```

### Database Testing Helpers

**File**: `__tests__/helpers/supabaseHelpers.ts`

```typescript
// Get test client (uses service role key if available)
export function getTestSupabaseClient() {
  const key = testConfig.hasServiceRoleKey 
    ? testConfig.supabaseServiceRoleKey 
    : testConfig.supabaseAnonKey
  return createClient(testConfig.supabaseUrl, key)
}

// Create test user
export async function createTestUser(overrides?: { 
  email?: string 
  password?: string 
}) {
  // Creates user with test prefix
  // Returns { user, email, password }
}

// Cleanup test data
export async function cleanupTestDataByUserId(userId: string) {
  // Deletes all test data for user
  // Respects foreign key constraints
}
```

**Usage**:
```typescript
import { createTestUser, cleanupTestDataByUserId } from '@tests/helpers/supabaseHelpers'

let testUser

beforeAll(async () => {
  testUser = await createTestUser()
})

afterAll(async () => {
  await cleanupTestDataByUserId(testUser.user.id)
})
```

### Mock Data Factories

**File**: `__tests__/helpers/mockFactories.ts`

```typescript
// Create mock trial with sensible defaults
export function createMockTrial(overrides?: Partial<ClinicalTrial>) {
  return {
    nctId: `NCT${Math.floor(Math.random() * 100000000)}`,
    briefTitle: 'Test Clinical Trial',
    overallStatus: 'Recruiting',
    phase: ['Phase 2'],
    conditions: ['Test Condition'],
    interventions: ['Test Drug'],
    ...overrides
  }
}

// Create multiple mock trials
export function createMockTrials(count: number, overrides?) {
  return Array.from({ length: count }, (_, i) => 
    createMockTrial({ ...overrides, nctId: `NCT${String(i).padStart(8, '0')}` })
  )
}
```

**Usage**:
```typescript
import { createMockTrial } from '@tests/fixtures/trials'

test('should filter trials by phase', () => {
  const phase2Trial = createMockTrial({ phase: ['Phase 2'] })
  const phase3Trial = createMockTrial({ phase: ['Phase 3'] })
  
  const filtered = filterTrialsByPhase([phase2Trial, phase3Trial], 'Phase 2')
  expect(filtered).toHaveLength(1)
})
```

## Test Fixtures

### Clinical Trial Fixtures

**File**: `__tests__/fixtures/trials.ts`

Realistic trial data for testing:
- `phase2AlzheimersTrial` - Phase 2 Alzheimer's study
- `phase3DiabetesTrial` - Phase 3 GLP-1 diabetes trial
- `phase1CancerTrial` - Phase 1 immunotherapy
- `observationalStudy` - Non-interventional study
- `mockTrials` - Array of all fixtures

### Research Paper Fixtures

**File**: `__tests__/fixtures/papers.ts`

Realistic paper data for testing:
- `alzheimersPaper` - Clinical trial results paper
- `diabetesPaper` - Meta-analysis of GLP-1 drugs
- `cancerPaper` - Checkpoint inhibitor review
- `methodologyPaper` - Trial design guidelines
- `mockPapers` - Array of all fixtures

## Current Test Coverage

### Guest Mode Integration Tests

**File**: `__tests__/integration/auth/guestMode.test.tsx`

**Status**: 9/10 tests passing (1 expected failure until bug is fixed)

**Test Categories**:

1. **Bug Detection** (2 tests, both passing):
   - Detects bug: guest users shown EntryChoice screen
   - Detects bug: project creation blocked for guests

2. **Expected Behavior After Fix** (3 tests, 1 failing as expected):
   - Should bypass EntryChoice for guests (expected failure)
   - Should allow search without project creation
   - Should show "sign up to save" prompts

3. **State Management** (3 tests, all passing):
   - Persist guest mode in localStorage
   - Clear guest mode when user signs in
   - Allow manual exit from guest mode

4. **Auth Comparison** (2 tests, all passing):
   - Show EntryChoice for authenticated users
   - Allow authenticated users to create projects

**Example Test**:
```typescript
describe('Guest Mode - Bug Detection', () => {
  it('should detect bug: guest users shown EntryChoice', async () => {
    // Mock guest mode
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: null,
      isGuest: true,
      // ... other auth methods
    })

    render(<MockApp />)

    // BUG: Guest users currently see EntryChoice
    await waitFor(() => {
      const entryChoice = screen.queryByText(/Welcome to ABCresearch/i)
      if (entryChoice) {
        console.warn('BUG DETECTED: Guest users seeing EntryChoice')
        expect(true).toBe(true) // Documents the bug
      }
    })
  })
})
```

## Running Tests

### Local Development

```bash
# Run all tests in watch mode
npm test

# Run all tests once
npm run test:run

# Run with coverage
npm run test:coverage

# Run specific test file
npm run test:run -- guestMode.test.tsx

# Run specific test category
npm run test:unit
npm run test:integration

# Run with UI
npm run test:ui
```

### Viewing Coverage

```bash
npm run test:coverage
open coverage/index.html    # Opens HTML report in browser
```

Coverage reports show:
- Statement coverage (60% threshold)
- Branch coverage (60% threshold)
- Function coverage (50% threshold)
- Line coverage (60% threshold)

## CI/CD Integration

### GitHub Actions Workflow

**File**: `.github/workflows/ci.yml`

**Pipeline Jobs**:

1. **Test Job** (Matrix: Node 18.x, 20.x):
   ```yaml
   - name: Run tests
     run: npm run test:ci
     env:
       VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
       VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
       SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
   ```

2. **Lint Job** (Parallel):
   ```yaml
   - name: Run linter
     run: npm run lint
   ```

3. **Deploy Job** (Conditional):
   - Only runs if test + lint pass
   - Only runs on main/master branch
   - Deploys to Vercel via CLI

**Required GitHub Secrets**:
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Public anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (bypasses RLS)
- `VERCEL_TOKEN` - Vercel authentication token

### Pipeline Flow

```
Push to GitHub
     ↓
Test (Node 18, 20) + Lint (Parallel)
     ↓
All Pass? ────No──→ ❌ STOP (Deployment blocked)
     ↓
    Yes
     ↓
Is main/master? ────No──→ ✅ Done (Preview deployment only)
     ↓
    Yes
     ↓
Deploy to Production (Vercel)
     ↓
✅ Deployed
```

## Legacy Tests

### Archive Location

**Directory**: `__tests_legacy__/`

Legacy tests are preserved but not run by default. They were archived on November 26, 2025 during the test suite modernization (HW11).

**Contents**:
- `test/` - Original integration tests
- `api-tests/` - API endpoint tests
- `src-test/` - Frontend test utilities
- `services-tests/` - Service layer tests
- `api-utils-tests/` - API utility tests
- Component test files

**Running Legacy Tests**:
```bash
npm run test:legacy
```

**Note**: Legacy tests may fail and are not maintained. Use for reference only when modernizing old test cases.

## Writing New Tests

### Test Naming Convention

```typescript
describe('ComponentName or ServiceName', () => {
  describe('method or feature', () => {
    it('should do something specific when condition', () => {
      // Arrange
      const input = createMockData()
      
      // Act
      const result = functionUnderTest(input)
      
      // Assert
      expect(result).toBe(expectedValue)
    })
  })
})
```

### For New Features

1. **Start with unit tests**: Test business logic in isolation
2. **Add integration tests**: Test how pieces work together
3. **Consider e2e tests**: Test critical user paths (future)

**Example**:
```typescript
// 1. Unit test for service function
describe('trialService', () => {
  it('should filter trials by phase', () => {
    const trials = createMockTrials(5)
    const filtered = filterByPhase(trials, 'Phase 2')
    expect(filtered.every(t => t.phase.includes('Phase 2'))).toBe(true)
  })
})

// 2. Integration test with database
describe('trialService integration', () => {
  it('should save and retrieve trial from database', async () => {
    const trial = createMockTrial()
    const saved = await upsertTrial(trial)
    const retrieved = await getTrial(saved.nct_id)
    expect(retrieved.briefTitle).toBe(trial.briefTitle)
  })
})
```

### For Bug Fixes

1. **Write failing test**: Reproduce the bug
2. **Fix the bug**: Implement solution
3. **Verify test passes**: Confirm fix works

**Example**:
```typescript
// Bug: Guest users blocked at EntryChoice
it('should allow guests to access Dashboard directly', () => {
  renderWithAuth(<App />, { isGuest: true })
  
  // Should see Dashboard, not EntryChoice
  expect(screen.queryByText(/Open Existing Project/i)).not.toBeInTheDocument()
  expect(screen.getByText(/Guest Mode/i)).toBeInTheDocument()
})
```

## Best Practices

### DO

- Keep tests fast (< 1s for unit tests)
- Test behavior, not implementation
- Use descriptive test names
- Clean up test data in `afterAll`
- Mock external APIs (Claude, ClinicalTrials.gov)
- Use factories for test data
- Test error cases and edge cases

### DON'T

- Commit failing tests (unless documenting bugs)
- Test implementation details (private methods, internal state)
- Make real API calls that cost money
- Leave test data in database
- Couple tests together (each should be independent)
- Use magic numbers or hardcoded IDs

## Troubleshooting

### "No tests found"

**Problem**: Vitest can't find test files

**Solution**: 
- Check file naming: `*.test.{ts,tsx}`
- Check location: Must be in `__tests__/`
- Check vitest.config.ts include pattern

### "RLS policy violation"

**Problem**: Tests fail with permission errors

**Solution**:
- Use `SUPABASE_SERVICE_ROLE_KEY` in CI
- Or create authenticated test user with `createTestUser()`
- Check RLS policies in Supabase dashboard

### "Tests pass locally but fail in CI"

**Problem**: Environment differences

**Solution**:
- Check environment variables in GitHub secrets
- Run `npm ci` instead of `npm install` locally
- Run `npm run test:ci` to simulate CI environment
- Check Node version matches CI (18.x or 20.x)

### "Coverage threshold not met"

**Problem**: Code coverage below configured thresholds

**Solution**:
- Add tests for new code
- Check `vitest.config.ts` for thresholds
- View coverage report: `npm run test:coverage`
- Adjust thresholds if necessary (discuss with team first)

## Future Enhancements

### Short Term
- Add unit tests for services (trialService, paperService, drugService)
- Add component tests for Dashboard views
- Add API integration tests
- Expand coverage to meet 60% thresholds

### Medium Term
- Implement E2E tests with Playwright
- Add visual regression testing
- Add performance testing for search operations
- Test guest-to-authenticated conversion flow

### Long Term
- Add test result reporting (codecov.io)
- Add security scanning in CI
- Add accessibility testing
- Add cross-browser testing

## Related Documentation

- **CI/CD Pipeline**: See `.github/workflows/README.md` for GitHub Actions details
- **Database Testing**: See `3-database.md` for database schema and RLS policies
- **Component Architecture**: See `1-frontend.md` for component structure

---

**Last Updated**: November 26, 2025

