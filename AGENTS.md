# AGENTS.md

## Project Overview

ABCresearch is an AI-powered research assistant platform designed for biotech equity researchers. The application provides comprehensive data collection, analysis, and visualization of clinical trials and academic papers to support investment decision-making in the biotech sector.

### Core Technology Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Backend**: Supabase (PostgreSQL database, authentication, real-time)
- **AI Services**: Claude (Anthropic) for intent detection and analysis, Gemini (Google) for drug extraction
- **Styling**: Tailwind CSS + shadcn/ui components
- **Testing**: Vitest + React Testing Library
- **Linting**: ESLint with TypeScript support

### Key Architecture Decisions

1. **Project-Centric Database Architecture**: All research data is organized around a `projects` table. Market maps, trials, papers, and drugs are linked to projects via foreign keys.

2. **Normalized Schema (HW10)**: Data is stored in normalized tables (`trials`, `papers`, `drugs`) with junction tables (`project_trials`, `project_papers`, `project_drugs`) for many-to-many relationships. JSONB columns in `market_maps` are deprecated but maintained for backward compatibility during migration.

3. **Dual-Write Strategy**: New data is written to both JSONB (legacy) and normalized tables (new) asynchronously in the background to ensure smooth migration.

4. **Metadata-First AI Architecture (HW8)**: Claude receives structured metadata before content to improve parsing reliability and reduce costs.

### Database Schema

**Core Tables:**
- `projects` - User research projects (contains `chat_history` JSONB column)
- `market_maps` - Saved research sessions (deprecated JSONB columns: `trials_data`, `papers_data`, `drugs_data`, `chat_history`, `slide_data`)
- `trials` - Clinical trial data from ClinicalTrials.gov
- `papers` - Research papers from PubMed
- `drugs` - Pharmaceutical drug data
- `project_trials`, `project_papers`, `project_drugs` - Junction tables for many-to-many relationships

**Key Relationships:**
- Projects → Market Maps (one-to-many)
- Projects ↔ Trials (many-to-many via `project_trials`)
- Projects ↔ Papers (many-to-many via `project_papers`)
- Projects ↔ Drugs (many-to-many via `project_drugs`)

### Important Services

- `src/services/marketMapService.ts` - Handles saving/loading market maps with dual-write to normalized tables
- `src/services/trialService.ts` - CRUD for normalized trial data
- `src/services/paperService.ts` - CRUD for normalized paper data
- `src/services/drugService.ts` - CRUD for normalized drug data
- `src/services/projectService.ts` - Project management and chat history persistence

### Key Components

- `src/components/Dashboard.tsx` - Main dashboard with project switching, chat history management, and data loading
- `src/components/MarketMap.tsx` - Market map visualization and saving
- `src/components/SavedMaps.tsx` - Displays saved maps filtered by project
- `src/components/PapersDiscovery.tsx` - Paper search and display
- `src/components/TrialsList.tsx` - Trial search and display

### Git Workflow

**Branch Strategy:**
- `dev` - Development branch (target for feature branches)
- Feature branches: `{name}-feature{number}-{linear-id}` (e.g., `paul-feature2-abc43`)

**Rebase Workflow:**
1. Switch to target branch: `git checkout dev`
2. Pull latest: `git pull --rebase`
3. Switch to feature branch: `git checkout {branch-name}`
4. Rebase onto dev: `git rebase dev`
5. Resolve conflicts if any: `git add {file}` then `git rebase --continue`
6. Force push: `git push --force-with-lease origin {branch-name}`
7. Open PR and use "Rebase and merge" on GitHub

**Commit Message Format:**
- Brief commit message (one line)
- Include homework tag (e.g., `[HW9]`) and Linear ID (e.g., `ABC-12`) when applicable
- Suggest description text for PR body

### Supabase Configuration

- **Migrations**: Located in `supabase/migrations/`
- **Edge Functions**: Located in `supabase/functions/`
- **RLS Policies**: Row Level Security is enabled - tests require authenticated sessions
- **MCP Integration**: Supabase MCP server available for database operations

### Documentation

- `documentation/` - Comprehensive project documentation
- `documentation/0-overview.md` - Project overview and architecture
- `documentation/3-database.md` - Database schema and relationships
- Test documentation in `test/README.md` and `test/MIGRATION_TESTING.md`

---

## CI/CD Pipeline Architecture

### Overview

The CI/CD pipeline implements a **test-gated deployment** strategy where:

1. **All pushes** trigger automated testing on multiple Node.js versions
2. **Preview deployments** are created for all branches (via Vercel)
3. **Production deployment** happens ONLY when:
   - Tests pass ✅
   - Push is to main/master branch ✅
   - GitHub Actions successfully deploys via Vercel CLI ✅

### Why This Architecture?

**Problem**: Vercel's default GitHub integration deploys to production regardless of test status, which can push broken code to users.

**Solution**: Configure Vercel to skip builds on main, and let GitHub Actions control production deployment after tests pass.

### Component Diagram

```
Push to GitHub
     ↓
┌────────────────────────────────────┐
│  GitHub Actions Workflow           │
│                                    │
│  ┌──────────────────────────────┐ │
│  │  Test Job (Matrix Strategy)   │ │
│  │  - Node 18.x                  │ │
│  │  - Node 20.x                  │ │
│  │  - Run Vitest tests           │ │
│  │  - Collect coverage           │ │
│  └──────────────────────────────┘ │
│            ↓                       │
│     Tests Pass? ────No──→ ❌ STOP │
│            ↓                       │
│           Yes                      │
│            ↓                       │
│  ┌──────────────────────────────┐ │
│  │  Deploy Job                   │ │
│  │  (Only runs on main branch)   │ │
│  │  - Install Vercel CLI         │ │
│  │  - Pull env variables         │ │
│  │  - Build project              │ │
│  │  - Deploy to production       │ │
│  └──────────────────────────────┘ │
└────────────────────────────────────┘
     ↓
✅ Production Deployment
```

### Parallel Vercel System

```
Push to Branch (not main)
     ↓
Vercel GitHub Integration
     ↓
✅ Preview Deployment (always happens)


Push to Main
     ↓
Vercel GitHub Integration
     ↓
⊘ Build SKIPPED (Ignored Build Step)
     ↓
GitHub Actions handles deployment instead
```

---

## Complete CI/CD Setup Guide

### Step 1: GitHub Actions Workflow Configuration

**File**: `.github/workflows/ci.yml`

```yaml
name: ABCresearch CI

on:
  push:
    branches: [ main, master, dev ]
  pull_request:
    branches: [ main, master, dev ]

jobs:
  test:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [18.x, 20.x]

    steps:
    - uses: actions/checkout@v4
    
    - name: Use Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v4
      with:
        node-version: ${{ matrix.node-version }}
        cache: 'npm'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Run tests
      run: npm run test:ci
      env:
        VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
        VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
        SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
      
    - name: Upload coverage report
      uses: actions/upload-artifact@v4
      with:
        name: coverage-report-${{ matrix.node-version }}
        path: coverage/
        
  lint:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18.x'
        cache: 'npm'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Run linter
      run: npm run lint
      
  deploy:
    needs: [test, lint]
    if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/master'
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18.x'
        
    - name: Install Vercel CLI
      run: npm install --global vercel@latest
      
    - name: Pull Vercel Environment Information
      run: vercel pull --yes --environment=production --token=${{ secrets.VERCEL_TOKEN }}
      
    - name: Build Project Artifacts
      run: vercel build --prod --token=${{ secrets.VERCEL_TOKEN }}
      
    - name: Deploy Project Artifacts to Vercel
      run: vercel deploy --prebuilt --prod --token=${{ secrets.VERCEL_TOKEN }}
```

#### Key Workflow Features

**1. Test Job**
- **Matrix Strategy**: Tests run on both Node 18.x and 20.x to ensure compatibility
- **npm ci**: Uses clean install for reproducible builds (faster than `npm install` in CI)
- **Environment Variables**: Supabase credentials passed for authenticated test operations
- **Coverage Upload**: Each Node version uploads its own coverage report with unique artifact name to avoid conflicts

**2. Lint Job**
- **Separate Job**: Runs in parallel with tests for faster feedback
- **Fails Fast**: Linting errors block deployment

**3. Deploy Job**
- **`needs: [test, lint]`**: Deploy only runs if both test and lint jobs succeed
- **`if: github.ref == 'refs/heads/main'`**: Only deploy from main/master branches
- **Vercel CLI Steps**: 
  - `vercel pull`: Downloads project configuration and environment variables
  - `vercel build`: Builds the project locally
  - `vercel deploy --prebuilt`: Deploys the pre-built artifacts

**4. Environment Variables**
- `${{ secrets.VERCEL_TOKEN }}`: GitHub secret for Vercel authentication
- `${{ secrets.VITE_SUPABASE_URL }}`: Supabase project URL
- `${{ secrets.VITE_SUPABASE_ANON_KEY }}`: Supabase anonymous key
- `${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}`: Service role key for CI tests (bypasses RLS)

### Step 2: GitHub Secrets Configuration

Navigate to: `https://github.com/USERNAME/REPO/settings/secrets/actions`

**Required Secrets:**

1. **VERCEL_TOKEN**
   - Go to: https://vercel.com/account/tokens
   - Click "Create Token"
   - Name: "GitHub Actions Deploy"
   - Scope: Full Account or specific team
   - Copy the token (you won't see it again!)
   - Add as GitHub secret

2. **VITE_SUPABASE_URL**
   - Go to: Supabase Dashboard → Project Settings → API
   - Copy "Project URL"
   - Add as GitHub secret

3. **VITE_SUPABASE_ANON_KEY**
   - Go to: Supabase Dashboard → Project Settings → API
   - Copy "anon public" key
   - Add as GitHub secret

4. **SUPABASE_SERVICE_ROLE_KEY**
   - Go to: Supabase Dashboard → Project Settings → API
   - Copy "service_role" key (⚠️ Keep this secret!)
   - Add as GitHub secret
   - Used only for CI tests to bypass RLS

### Step 3: Vercel Configuration

#### A. Connect Repository to Vercel

1. Go to https://vercel.com/new
2. Import your GitHub repository
3. Configure project:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

#### B. Configure Ignored Build Step (CRITICAL)

This step prevents Vercel from auto-deploying to production on main branch pushes.

1. Go to: Vercel Project → Settings → Git
2. Scroll to "Ignored Build Step"
3. Change from "Automatic" to "Custom"
4. Enter the following command:

```bash
if [ "$VERCEL_GIT_COMMIT_REF" == "main" ] || [ "$VERCEL_GIT_COMMIT_REF" == "master" ]; then exit 0; else exit 1; fi
```

**What this does:**
- `exit 0` = Skip build (don't deploy)
- `exit 1` = Build and deploy

**Translation:**
- On `main`/`master` branch: Skip build (GitHub Actions will handle it)
- On other branches: Build and create preview deployment

**Result:**
- Main branch: GitHub Actions controls deployment ✅
- Feature branches: Vercel creates preview deployments ✅

#### C. Environment Variables in Vercel

Add these environment variables in Vercel Project → Settings → Environment Variables:

- `VITE_SUPABASE_URL` (Production, Preview, Development)
- `VITE_SUPABASE_ANON_KEY` (Production, Preview, Development)

**Note**: These are separate from GitHub secrets. These are for your app at runtime, while GitHub secrets are for the deploy process.

### Step 4: Package.json Configuration

Ensure these scripts are present:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest",
    "test:run": "vitest run",
    "test:ci": "vitest run --coverage",
    "test:ui": "vitest --ui",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0"
  }
}
```

**Key Script: `test:ci`**
- `vitest run`: Run tests once (non-watch mode)
- `--coverage`: Generates coverage reports for analysis

### Step 5: Vitest Configuration for CI/CD

**Coverage Collection** (in `vitest.config.ts`):

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'coverage/',
        '**/*.test.ts',
        '**/*.test.tsx',
        'src/test/',
        'test/',
      ],
    },
    coverageThreshold: {
      global: {
        statements: 60,
        branches: 60,
        functions: 50,
        lines: 60,
      },
    },
  },
})
```

**Why Exclude Directories:**
- `dist/`: Build output not tested
- `test/`: Test files themselves don't need coverage
- This ensures coverage metrics reflect actual application code only

**Coverage Thresholds:**
- Tests fail if coverage drops below thresholds
- `functions: 50` is lower because React components contain many small functions
- Adjust thresholds based on your project needs

---

## Testing Strategy

### Test Architecture

**Three Layers:**

1. **Unit Tests** (`src/**/*.test.ts`, `src/**/*.test.tsx`)
   - Test individual functions and components in isolation
   - Mock external dependencies
   - Fast execution

2. **Integration Tests** (`test/*.test.ts`)
   - Test service layer with real Supabase database
   - Test data integrity and relationships
   - Require authenticated sessions or service role key

3. **Functional Tests** (Future)
   - Test complete user workflows
   - End-to-end testing with Playwright or similar
   - Test UI interactions

### Key Testing Patterns

**1. Testing with Supabase**

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Bypass RLS in CI
)

test('Should create and retrieve project', async () => {
  // Create test project
  const { data: project } = await supabase
    .from('projects')
    .insert({ name: 'Test Project', user_id: 'test-user-id' })
    .select()
    .single()
  
  expect(project).toBeDefined()
  
  // Cleanup
  await supabase.from('projects').delete().eq('id', project.id)
})
```

**Why this matters**: Tests must interact with real database structure to catch schema issues.

**2. Mocking External APIs**

```typescript
import { vi } from 'vitest'

test('Should handle API errors gracefully', async () => {
  const mockFetch = vi.fn().mockRejectedValue(new Error('API Error'))
  global.fetch = mockFetch
  
  // Test error handling
  await expect(fetchData()).rejects.toThrow('API Error')
})
```

**Why this matters**: Prevents tests from making real API calls, making them faster and more reliable.

**3. Test Data Cleanup**

```typescript
afterAll(async () => {
  // Clean up test data
  await supabase
    .from('projects')
    .delete()
    .eq('name', 'Test Project')
})
```

**Why this matters**: Prevents test data from polluting the database and affecting other tests.

### Running Tests

**Local Development:**
```bash
npm test              # Run all tests in watch mode
npm run test:run      # Run all tests once
npm run test:ui       # Run tests with UI
```

**CI Environment:**
```bash
npm run test:ci       # Run with coverage, optimized for CI
```

**Expected Output:**
```
Test Files  3 passed (3)
     Tests  15 passed (15)
   Duration  2.45s
```

---

## Verifying the CI/CD Pipeline

### Test 1: Verify Tests Block Deployment

**Objective**: Prove that failing tests prevent production deployment.

**Steps:**

1. Create a test branch:
```bash
git checkout -b test-failing-deployment
```

2. Add a failing test to any test file:
```typescript
test('INTENTIONAL FAILING TEST', () => {
  expect(true).toBe(false)
})
```

3. Commit and push to main:
```bash
git add .
git commit -m "TEST: Add failing test"
git checkout main
git merge test-failing-deployment
git push
```

4. Check GitHub Actions: https://github.com/USERNAME/REPO/actions

**Expected Result:**
- ❌ Test job fails
- ⊘ Deploy job is **skipped** (doesn't run at all)
- ⊘ Vercel shows "Canceled by Ignored Build Step"
- ✅ Production URL unchanged (no deployment happened)

5. Remove the failing test and push again to restore working state.

### Test 2: Verify Successful Deployment

**Objective**: Prove that passing tests enable production deployment.

**Steps:**

1. Ensure all tests pass:
```bash
npm run test:ci
npm run lint
```

2. Make a visible change (e.g., update a component)

3. Commit and push to main:
```bash
git add .
git commit -m "Update component styling"
git push
```

4. Monitor deployment:
   - GitHub Actions: https://github.com/USERNAME/REPO/actions
   - Vercel Deployments: https://vercel.com/TEAM/PROJECT

**Expected Result:**
- ✅ Test job passes (both Node versions)
- ✅ Lint job passes
- ✅ Deploy job runs and succeeds
- ⊘ Vercel shows "Canceled by Ignored Build Step" (for auto-deploy)
- ✅ New deployment appears in Vercel from "GitHub Actions"
- ✅ Production URL shows the changes

**Timeline**: Full deployment takes 3-5 minutes (2-3 min for tests, 1 min for lint, 2-3 min for deployment).

### Test 3: Verify Preview Deployments

**Objective**: Prove that feature branches get preview deployments.

**Steps:**

1. Create a feature branch:
```bash
git checkout -b feature-test-preview
```

2. Make any change and push:
```bash
echo "// Test comment" >> src/App.tsx
git add src/App.tsx
git commit -m "Test preview deployment"
git push -u origin feature-test-preview
```

3. Check Vercel deployments

**Expected Result:**
- ✅ GitHub Actions runs tests and lint (but skips deploy because not on main)
- ✅ Vercel creates preview deployment (exit 1 = build)
- ✅ Preview URL: `https://PROJECT-git-BRANCHNAME-TEAM.vercel.app`

---

## Deployment URLs Explained

### Production URL

**Format**: `https://projectname-RANDOM.vercel.app` or custom domain

**Characteristics:**
- Stable, permanent URL
- Only updates when main/master branch is deployed
- This is what you share publicly
- Example: `https://abcresearch-xyz.vercel.app`

**Vercel Dashboard Label**: "Production" + "Current"

### Preview URL

**Format**: `https://projectname-git-BRANCHNAME-TEAM.vercel.app`

**Characteristics:**
- Unique URL per branch
- Updates every time branch is pushed
- Temporary (deleted after branch is merged/deleted)
- Used for testing before merging to main
- Example: `https://abcresearch-git-feature-test-preview-team.vercel.app`

**Vercel Dashboard Label**: "Preview"

### Understanding Deployment Status

**In Vercel Dashboard:**

| Status | Branch | Method | Meaning |
|--------|--------|--------|---------|
| Production + Current | main | GitHub Actions | Latest production deployment |
| Production | main | GitHub Actions | Previous production deployment |
| Preview | feature-branch | Vercel Auto | Feature branch preview |
| Canceled | main | Vercel Auto | Skipped by Ignored Build Step ✅ |

**Seeing "Canceled by Ignored Build Step"** on main branch pushes is **CORRECT** - it means Vercel is letting GitHub Actions handle deployment.

---

## Troubleshooting Common Issues

### Issue 1: Deploy Job Skipped (But Tests Passing)

**Symptom**: Deploy job shows "Skipped" even though tests passed.

**Cause**: Not pushing to main/master branch.

**Solution**: Check `if: github.ref == 'refs/heads/main'` condition in workflow. Deploy only runs on main.

**Verification**: Check which branch you're on: `git branch`

### Issue 2: Vercel CLI Fails (Missing Secrets)

**Symptom**: Deploy job fails with "Error: Missing required environment variable"

**Cause**: GitHub secrets not configured correctly.

**Solution**:
1. Verify secrets exist: GitHub → Settings → Secrets → Actions
2. Check secret names match exactly: `VERCEL_TOKEN`, `VITE_SUPABASE_URL`, etc.
3. Try regenerating Vercel token

### Issue 3: Coverage Threshold Not Met

**Symptom**: Tests pass locally but fail in CI with "Coverage for X (Y%) does not meet global threshold (Z%)"

**Cause**: Coverage configuration too strict or new code added without tests.

**Solution**:
1. Check `coverageThreshold` in `vitest.config.ts`
2. Add tests for new code
3. Adjust thresholds if necessary (but discuss with team first)

### Issue 4: Artifact Upload Conflict

**Symptom**: "Failed to CreateArtifact: Conflict: an artifact with this name already exists"

**Cause**: Multiple test jobs (Node 18.x and 20.x) uploading artifacts with the same name.

**Solution**: Use unique artifact names per matrix job:
```yaml
- name: Upload coverage report
  uses: actions/upload-artifact@v4
  with:
    name: coverage-report-${{ matrix.node-version }}
    path: coverage/
```

### Issue 5: Tests Fail in CI But Pass Locally

**Symptom**: `npm test` passes on your machine but fails in GitHub Actions.

**Common Causes:**
1. **Environment differences**: Missing environment variables (Supabase credentials)
2. **RLS policies**: Tests need service role key to bypass RLS
3. **Timing issues**: Tests with setTimeout/async operations
4. **Dependencies**: Different Node versions or npm cache issues

**Solutions:**
1. Run tests with `npm run test:ci` locally to simulate CI
2. Use `npm ci` instead of `npm install` for reproducible builds
3. Check GitHub Actions logs for specific error messages
4. Ensure `SUPABASE_SERVICE_ROLE_KEY` is set in GitHub secrets

### Issue 6: Vercel Deployment Succeeds But Site Broken

**Symptom**: Deployment completes successfully, but production site shows errors.

**Common Causes:**
1. Missing environment variables in Vercel (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
2. Build command doesn't match local development
3. TypeScript errors not caught in build

**Solutions:**
1. Check Vercel runtime logs: Project → Deployments → Click deployment → Runtime Logs
2. Verify environment variables in Vercel project settings
3. Test build locally: `npm run build && npm run preview`
4. Check TypeScript compilation: `npx tsc --noEmit`

---

## Best Practices & Lessons Learned

### 1. Test Coverage Configuration

**DO**: Exclude irrelevant files from coverage
```typescript
coverage: {
  exclude: [
    'node_modules/',
    'dist/',
    '**/*.test.ts',
    'test/',
  ],
}
```

**WHY**: Test files and build output shouldn't count toward coverage.

### 2. Separate Test Command for CI

**DO**: Use dedicated CI test script
```json
{
  "scripts": {
    "test": "vitest",
    "test:ci": "vitest run --coverage"
  }
}
```

**WHY**: CI-specific flags optimize for automation environments.

### 3. Test Actual Application Code

**DO**: Test real service functions and components
```typescript
import { getProjectTrials } from '@/services/trialService'

test('Should fetch trials for project', async () => {
  const trials = await getProjectTrials(projectId)
  expect(trials).toBeDefined()
})
```

**DON'T**: Mock everything - test real database interactions
```typescript
// ❌ This doesn't test your actual database schema!
const mockTrials = [{ id: 1, title: 'Test' }]
```

**WHY**: Coverage only counts if you test the actual application code.

### 4. Matrix Testing for Compatibility

**DO**: Test on multiple Node versions
```yaml
strategy:
  matrix:
    node-version: [18.x, 20.x]
```

**WHY**: Catches compatibility issues before users encounter them.

### 5. Gating Deployments on Tests

**DO**: Use `needs: [test, lint]` to create dependency
```yaml
deploy:
  needs: [test, lint]
  if: github.ref == 'refs/heads/main'
```

**WHY**: Prevents broken code from reaching production.

### 6. Unique Artifact Names in Matrix Jobs

**DO**: Include matrix variable in artifact name
```yaml
name: coverage-report-${{ matrix.node-version }}
```

**WHY**: Prevents naming conflicts when multiple jobs run in parallel.

### 7. Vercel Ignored Build Step

**DO**: Configure custom ignored build step for main branch
```bash
if [ "$VERCEL_GIT_COMMIT_REF" == "main" ] || [ "$VERCEL_GIT_COMMIT_REF" == "master" ]; then exit 0; else exit 1; fi
```

**WHY**: Prevents Vercel from auto-deploying main, letting GitHub Actions control when production updates.

### 8. Clear Commit Messages

**DO**: Include context in commit messages
```bash
git commit -m "ABC-77: Fix test coverage configuration"
```

**WHY**: Makes git history readable and helps debug CI failures.

### 9. Test CI Configuration Changes Locally

**DO**: Run CI-equivalent commands locally before pushing
```bash
npm ci           # Clean install
npm run test:ci  # CI test mode
npm run lint     # Linter check
```

**WHY**: Catches issues before they break CI pipeline.

### 10. Monitor CI/CD Execution Times

**DO**: Keep an eye on how long jobs take
- Test job: 1-3 minutes ideal
- Lint job: 30-60 seconds ideal
- Deploy job: 2-4 minutes typical

**WHY**: Slow CI frustrates developers. Optimize if jobs take >5 minutes.

---

## Testing Instructions

### Continuous Integration (CI)

**Current Status**: CI/CD pipeline configured with GitHub Actions and Vercel.

**CI Pipeline:**
- Run tests on all pull requests
- Run linter on all commits
- Require all tests to pass before merge
- Use Supabase service role key for authenticated test operations
- Deploy to production only from main branch after tests pass

### How to Run Tests

**Unit and Integration Tests:**
```bash
# Run all tests in watch mode
npm test

# Run all tests once (CI mode)
npm run test:run

# Run tests with UI
npm run test:ui

# Run tests with coverage (CI mode)
npm run test:ci

# Run specific test file
npm run test:run test/migration-normalized-tables.test.ts
```

**Test Structure:**
- Unit tests: `src/**/*.test.ts` and `src/**/*.test.tsx`
- Integration tests: `test/*.test.ts`
- Test setup files: `src/test/setup.ts` and `test/setup.ts`

**Important Notes:**
- Integration tests that interact with Supabase require an authenticated session
- Some tests will skip if no user is authenticated (see test output for warnings)
- For CI/CD, use Supabase service role key in GitHub secrets to bypass RLS

**Manual Testing:**
- Migration utility available in browser console: `window.runMigration()`
- Supabase client available: `window.supabase`
- See `test/MIGRATION_TESTING.md` for detailed manual testing instructions

### How to Run Linters

**ESLint:**
```bash
# Run linter
npm run lint

# Auto-fix issues (when possible)
npm run lint -- --fix
```

**Linter Configuration:**
- ESLint config: `eslint.config.js`
- TypeScript ESLint for type checking
- React Hooks linting rules enabled
- React Refresh plugin for Vite

**Pre-commit Checks:**
- Currently no pre-commit hooks configured
- Run `npm run lint` before committing
- Fix all linter errors before pushing

### When to Update Tests

**Add new tests when:**
1. Implementing new features (write tests alongside implementation)
2. Fixing bugs (add regression test to prevent recurrence)
3. Refactoring critical paths (ensure behavior unchanged)
4. Adding new service functions (test CRUD operations)
5. Database schema changes (test migration scripts and data integrity)

**Update existing tests when:**
1. Test is failing due to intentional behavior change
2. Test data structure has changed (e.g., schema migration)
3. API contract has changed (e.g., service function signature)
4. User explicitly requests test updates

### Instructions NOT to Change Existing Tests

**CRITICAL**: Do NOT modify existing tests unless:
1. The test is explicitly broken by a user-requested change
2. The user explicitly asks you to update the test
3. The test is preventing a user-requested feature implementation (and user approves test modification)

**Why this matters:**
- Existing tests serve as regression tests
- Changing tests without user approval can hide bugs
- Tests document expected behavior - changing them changes the contract

**If a test is failing:**
1. First, understand WHY it's failing
2. Determine if the failure indicates a bug in the code or an outdated test
3. If it's a bug, fix the code, not the test
4. If the test is outdated, ask the user before modifying it
5. Document the reason for any test changes in commit messages

### Test Coverage Expectations

**Current Coverage:**
- Migration tests: Comprehensive (data integrity, deduplication, relationships)
- Service layer tests: Partial (CRUD operations for normalized tables)
- Performance tests: Not yet implemented
- Functional/UI tests: Not yet implemented (manual testing only)

**Coverage Goals:**
- Data integrity: 100% (critical for migration)
- Service layer: 80%+ (all CRUD operations)
- Performance: Benchmark queries before/after schema changes
- Functional: Core user workflows (search, save, load, project switching)

### Other Testing Instructions

**Database Migrations:**
- Always test migrations on a copy of production data first
- Verify no data loss after migration
- Test rollback procedures (if applicable)
- Document migration results in test output

**Authentication & RLS:**
- Tests that interact with Supabase must handle RLS policies
- Use authenticated sessions for integration tests
- For CI/CD, use service role key to bypass RLS
- Document authentication requirements in test files

**Performance Testing:**
- Measure query performance before/after schema changes
- Use `EXPLAIN ANALYZE` for PostgreSQL query optimization
- Test with realistic data volumes (1000+ records)
- Document performance improvements in commit messages

**Manual Testing Checklist:**
- Project switching preserves chat history
- Saved maps load correctly from normalized tables
- Fallback to JSONB works if normalized tables empty
- Dual-write completes in background without blocking UI
- Search results populate normalized tables correctly

**Test Data Management:**
- Use mock data for unit tests
- Create isolated test projects for integration tests
- Clean up test data in `afterAll` hooks
- Never use production data in tests

**Error Handling:**
- Test error cases (network failures, invalid data, RLS violations)
- Verify graceful degradation (e.g., fallback to JSONB)
- Ensure user-friendly error messages

---

## Development Guidelines

### Code Style

- Use TypeScript strict mode
- Prefer functional components with hooks
- Use async/await for asynchronous operations
- Handle errors explicitly (no silent failures)
- Use descriptive variable and function names

### Database Operations

- Always use parameterized queries (Supabase handles this)
- Respect RLS policies - don't bypass unless necessary
- Use transactions for multi-step operations
- Handle foreign key constraints properly
- Clean up test data after operations

### AI Integration

- Claude: Used for intent detection and analysis (metadata-first architecture)
- Gemini: Used for drug name extraction
- Always handle API errors gracefully
- Implement retry logic for transient failures
- Cache responses when appropriate

### State Management

- Use React hooks (`useState`, `useEffect`, `useRef`) for component state
- Use Supabase real-time subscriptions for live data updates
- Implement in-memory caching for frequently accessed data
- Persist critical state to database (e.g., chat history)

### Performance Considerations

- Batch database operations (e.g., Promise.all with batch size limits)
- Use background processing for heavy operations (e.g., dual-write)
- Implement debouncing for auto-save operations
- Optimize database queries with proper indexes
- Use React.memo for expensive components

---

## Common Tasks

### Adding a New Feature

1. Create feature branch from `dev`
2. Implement feature with tests
3. Update documentation if needed
4. Run linter and fix issues
5. Run tests and ensure they pass
6. Rebase onto `dev` before PR
7. Create PR with brief commit message and description

### Fixing a Bug

1. Reproduce the bug
2. Write a failing test that demonstrates the bug
3. Fix the bug
4. Verify the test passes
5. Run full test suite
6. Commit with descriptive message

### Database Migration

1. Create migration file in `supabase/migrations/`
2. Test migration on local/staging database
3. Verify data integrity after migration
4. Update service layer if schema changes
5. Update tests to reflect new schema
6. Document migration in commit message

### Updating Dependencies

1. Check for breaking changes in changelog
2. Update package.json
3. Run `npm install`
4. Run linter and tests
5. Fix any compatibility issues
6. Update documentation if API changes

---

## Resources

- **Project Documentation**: `documentation/` directory
- **Supabase Docs**: https://supabase.com/docs
- **React Docs**: https://react.dev
- **Vitest Docs**: https://vitest.dev
- **TypeScript Docs**: https://www.typescriptlang.org/docs
- **GitHub Actions Docs**: https://docs.github.com/en/actions
- **Vercel Docs**: https://vercel.com/docs

---

## Notes for AI Agents

- Always read existing code before modifying
- Check for similar patterns in the codebase
- Follow the established git workflow
- Don't modify tests unless explicitly requested
- Ask for clarification if requirements are unclear
- Document complex logic and architectural decisions
- Consider performance implications of changes
- Respect RLS policies and authentication requirements
- Run tests and linter before committing
- Understand the CI/CD pipeline before making changes that affect it
