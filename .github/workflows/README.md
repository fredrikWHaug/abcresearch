# CI/CD Pipeline

GitHub Actions workflow for automated testing and deployment.

## Workflow: `ci.yml`

### Triggers
- Push to `main`, `master`, or `dev` branches
- Pull requests to `main`, `master`, or `dev` branches

### Jobs

#### 1. Test Job
**Purpose**: Run test suite on multiple Node versions

**Matrix Strategy**: Tests on Node 18.x and 20.x

**Steps**:
1. Checkout code
2. Setup Node.js with npm cache
3. Install dependencies with `npm ci`
4. Run tests with coverage: `npm run test:ci`
5. Upload coverage reports as artifacts

**Environment Variables Required**:
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase public anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (bypasses RLS)

#### 2. Lint Job
**Purpose**: Check code quality and style

**Steps**:
1. Checkout code
2. Setup Node.js 18.x
3. Install dependencies
4. Run ESLint: `npm run lint`

#### 3. Deploy Job
**Purpose**: Deploy to production via Vercel

**Conditions**:
- Only runs if test and lint jobs pass
- Only runs on `main` or `master` branch

**Steps**:
1. Checkout code
2. Setup Node.js
3. Install Vercel CLI
4. Pull Vercel environment configuration
5. Build project artifacts
6. Deploy to production

**Environment Variable Required**:
- `VERCEL_TOKEN` - Vercel authentication token

## Required GitHub Secrets

Set these in: `Settings → Secrets and variables → Actions`

| Secret Name | Description | Where to Get |
|-------------|-------------|--------------|
| `VITE_SUPABASE_URL` | Supabase project URL | Supabase Dashboard → Project Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Public anonymous key | Supabase Dashboard → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (⚠️ sensitive) | Supabase Dashboard → Project Settings → API |
| `VERCEL_TOKEN` | Vercel authentication token | https://vercel.com/account/tokens |

## Coverage Reports

Coverage reports are uploaded as artifacts for each Node version:
- `coverage-report-18.x`
- `coverage-report-20.x`

Download from: Actions → Workflow run → Artifacts

## Vercel Configuration

**Important**: Configure Vercel "Ignored Build Step" to prevent auto-deploys on main:

```bash
if [ "$VERCEL_GIT_COMMIT_REF" == "main" ] || [ "$VERCEL_GIT_COMMIT_REF" == "master" ]; then exit 0; else exit 1; fi
```

This ensures:
- Main branch: GitHub Actions controls deployment ✅
- Feature branches: Vercel creates preview deployments ✅

## Local Testing

Test your code before pushing:

```bash
# Install dependencies
npm ci

# Run linter
npm run lint

# Run tests with coverage
npm run test:ci

# Run specific test category
npm run test:unit
npm run test:integration
```

## Troubleshooting

### Tests fail in CI but pass locally
- Run `npm ci` instead of `npm install`
- Run `npm run test:ci` to simulate CI environment
- Check environment variables in GitHub secrets

### Coverage threshold not met
- Check `vitest.config.ts` for thresholds
- Add tests for new code
- View coverage report locally: `npm run test:coverage`

### Deployment fails
- Verify `VERCEL_TOKEN` is set correctly
- Check Vercel project settings
- Ensure build succeeds locally: `npm run build`

## Pipeline Flow

```
Push to GitHub
     ↓
┌────────────────────────────────────┐
│  Test Job (Matrix: Node 18, 20)   │
│  + Lint Job (Parallel)             │
└────────────────────────────────────┘
     ↓
Tests/Lint Pass? ────No──→ ❌ STOP
     ↓
    Yes
     ↓
Is main/master? ────No──→ ✅ Done (Preview only)
     ↓
    Yes
     ↓
┌────────────────────────────────────┐
│  Deploy Job                        │
│  (Vercel Production)               │
└────────────────────────────────────┘
     ↓
✅ Production Deployed
```

## Best Practices

✅ **DO**:
- Run tests locally before pushing
- Keep commits atomic and well-tested
- Fix linter errors before committing
- Monitor CI/CD execution times

❌ **DON'T**:
- Push failing tests
- Commit with linter errors
- Skip CI checks with force pushes
- Ignore coverage drops

---

For detailed CI/CD architecture, see `AGENTS.md`.

