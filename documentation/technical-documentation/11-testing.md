# ABCresearch - Testing Documentation

**Last Updated**: December 12th, 2025

## Quick Start (Fresh Clone)

### Step 1: Clone and Install

```bash
git clone https://github.com/fredrikWHaug/abcresearch.git
cd abcresearch
npm install
```

### Step 2: Create Environment File

Create `.env.local` with Supabase credentials (required for all tests):

```bash
echo "VITE_SUPABASE_URL=https://your-project.supabase.co" >> .env.local
echo "VITE_SUPABASE_ANON_KEY=your-anon-key" >> .env.local
```

### Step 3: Run Unit + Integration Tests (167 tests)

```bash
npm test
```

Press `q` to quit after tests pass.

### Step 4: Run E2E Tests (12 tests)

E2E tests require `vercel dev` for API routes to work.

**One-time setup:**
```bash
vercel login          # Free Vercel account required
npx playwright install chromium
```

**Terminal 1** - Start the dev server:
```bash
npm run build && npx vercel dev --listen 3000
```

**Terminal 2** - Run E2E tests (after server shows "Ready!"):
```bash
npx playwright test --config=__tests__/e2e/playwright.config.ts
```

**Expected Results:** 167 unit/integration + 11 E2E = **178 tests passing** (1 skipped)

---

## Test Suite Overview

| Type | Tests | Time | Requires `.env.local`? |
|------|-------|------|------------------------|
| Unit | 39 | ~1s | Yes |
| Integration | 128 | ~8s | Yes |
| E2E | 12 | ~3min | Yes + `vercel login` |
| **Total** | **179** | ~3.5min | |

---

## Running Tests

### Unit + Integration Tests

```bash
npm test                  # Run all unit + integration tests
npm run test:unit         # Unit tests only (39 tests)
npm run test:integration  # Integration tests only (128 tests)
```

### E2E Tests

E2E tests require `vercel dev` (not `vite preview`) because the tests need API routes.

**One-time setup:**
```bash
vercel login          # Free Vercel account required
npx playwright install chromium
```

**Terminal 1** - Start server:
```bash
npm run build && npx vercel dev --listen 3000
```

**Terminal 2** - Run tests (after "Ready!" appears):
```bash
npx playwright test --config=__tests__/e2e/playwright.config.ts
```

**Other E2E Commands:**
```bash
npx playwright test --config=__tests__/e2e/playwright.config.ts --headed  # Visible browser
npx playwright test --config=__tests__/e2e/playwright.config.ts --ui      # Interactive UI
```

---

## Test Architecture

```
__tests__/
├── unit/                    # Pure function tests (no mocks needed)
│   ├── pipelineService.test.ts
│   ├── pipelineLLMService.test.ts
│   ├── drugGroupingService.test.ts
│   ├── trialRankingService.test.ts
│   └── pipelineExportService.test.ts
│
├── integration/             # Service tests (mocked dependencies)
│   ├── projects/
│   ├── search/
│   ├── marketmap/
│   ├── database/
│   ├── feeds/
│   ├── ui/
│   ├── auth/
│   ├── routing/
│   └── api/
│
└── e2e/                     # Browser tests (real system)
    ├── playwright.config.ts
    ├── helpers/
    │   └── auth.ts
    ├── auth.spec.ts
    ├── navigation.spec.ts
    ├── smoke.spec.ts
    └── userJourney1.spec.ts
```

---

## Unit Tests

Unit tests verify individual functions in isolation. No external dependencies.

| File | Tests | Description |
|------|-------|-------------|
| pipelineService.test.ts | 4 | Trial-to-pipeline conversion |
| pipelineLLMService.test.ts | 6 | LLM helper functions |
| drugGroupingService.test.ts | 7 | Drug filtering logic |
| trialRankingService.test.ts | 7 | Weighted scoring algorithm |
| pipelineExportService.test.ts | 15 | PowerPoint export helpers |

---

## Integration Tests

Integration tests verify multiple components working together. External services (Supabase, APIs) are mocked.

| File | Tests | Description |
|------|-------|-------------|
| projectManagement.test.ts | 18 | Project CRUD operations |
| drugDiscoveryFlow.test.ts | 10 | Search and discovery workflow |
| marketMapManagement.test.ts | 15 | Market map persistence |
| databaseCRUD.test.ts | 14 | Normalized database operations |
| rssFeedService.test.ts | 29 | RSS feed monitoring |
| pipelineView.test.tsx | 11 | Pipeline UI component |
| dataExtraction.test.tsx | 13 | Data extraction feature |
| guestMode.test.tsx | 9 | Guest mode functionality |
| authRedirect.test.tsx | 4 | Authentication redirects |
| chatTruncation.test.tsx | 5 | Chat response handling |

---

## E2E Tests

E2E tests run in a real browser (Chromium) against the full application.

| File | Tests | Description |
|------|-------|-------------|
| auth.spec.ts | 5 | Login, auth redirects, guest mode |
| navigation.spec.ts | 3 | Dashboard, logo, navigation tabs |
| smoke.spec.ts | 3 | Page loads, no JS errors |
| userJourney1.spec.ts | 1 | Full journey: login → project → search → pipeline → export |

**Test Credentials:**
- Email: `e2e@test.com`
- Password: `abcresearch`
- These are hardcoded in `playwright.config.ts` for convenience

---

## Troubleshooting

### "Missing Supabase environment variables"

Create `.env.local` with your credentials:

```bash
echo "VITE_SUPABASE_URL=https://your-project.supabase.co" >> .env.local
echo "VITE_SUPABASE_ANON_KEY=your-anon-key" >> .env.local
```

### E2E tests show 404 errors

E2E tests require `vercel dev` (not `vite preview`) for API routes:

```bash
# One-time: vercel login

# Terminal 1: Build and start vercel dev
npm run build && npx vercel dev --listen 3000

# Terminal 2: Run tests after "Ready!" appears
npx playwright test --config=__tests__/e2e/playwright.config.ts
```

**Note:** The auto-start in Playwright config doesn't work reliably - always start the server manually.

### "Chromium not installed"

```bash
npx playwright install chromium
```

### Port 3000 already in use

```bash
lsof -ti:3000 | xargs kill -9
```

---

## CI/CD

Tests run automatically on every PR via GitHub Actions.

**CI Environment:**
- Unit + Integration: Run on every push
- E2E: Run with test credentials from GitHub Secrets

**Required Secrets for E2E:**
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `TEST_USER_EMAIL`
- `TEST_USER_PASSWORD`
- `VERCEL_TOKEN` (for vercel dev in CI)
- `ANTHROPIC_API_KEY` (for AI features)
- `GOOGLE_GEMINI_API_KEY` (for AI features)

---

## Coverage

```bash
npm run test:coverage
```

Coverage thresholds:
- Statements: 60%
- Branches: 60%
- Functions: 50%
- Lines: 60%

---

## Adding New Tests

### Unit Test

```typescript
import { describe, it, expect } from 'vitest'
import { myFunction } from '@/services/myService'

describe('myFunction', () => {
  it('should return expected output', () => {
    expect(myFunction('input')).toBe('expected')
  })
})
```

### Integration Test

```typescript
import { describe, it, expect, vi } from 'vitest'
import { supabase } from '@/lib/supabase'

vi.mock('@/lib/supabase')

describe('MyService', () => {
  it('should fetch data', async () => {
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: [], error: null })
    } as any)

    // Test code here
  })
})
```

### E2E Test

```typescript
import { test, expect } from '@playwright/test'
import { loginWithTestUser } from './helpers/auth'

test('user can complete workflow', async ({ page }) => {
  await loginWithTestUser(page)
  await page.getByRole('button', { name: /start/i }).click()
  await expect(page).toHaveURL(/success/)
})
```
