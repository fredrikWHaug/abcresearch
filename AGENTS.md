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

## Testing Instructions

### Continuous Integration (CI)

**Current Status**: No CI/CD pipeline is currently configured. Tests are run manually during development.

**Future CI Plan** (when implemented):
- Run tests on all pull requests
- Run linter on all commits
- Require all tests to pass before merge
- Use Supabase service role key for authenticated test operations

### How to Run Tests

**Unit and Integration Tests:**
```bash
# Run all tests in watch mode
npm test

# Run all tests once (CI mode)
npm run test:run

# Run tests with UI
npm run test:ui

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
- For CI/CD, use Supabase service role key in `.env.test` to bypass RLS

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

