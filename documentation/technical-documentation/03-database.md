**Documentation Version**: 4.0  
**Last Updated**: December 14, 2025  
**Last Updated by**: Database Security and Performance Migration

# ABCresearch - Database Documentation

## Implementation Status

### Completed Phases

**Phase 1 - Project Creation and Storage (Nov 8, 2025)**
- Basic project CRUD operations implemented
- Project creation UI connected and working
- Service layer implemented (`src/services/projectService.ts`)
- RLS policies configured for user isolation

**Phase 2 - Normalized Schema with Dual-Write (Nov 10, 2025)**
- Created normalized tables: `trials`, `papers`, `drugs`
- Created junction tables: `project_trials`, `project_papers`, `project_drugs`
- Implemented background dual-write to both JSONB and normalized tables
- UI reads from normalized tables with automatic fallback to JSONB
- Migration utility created for backfilling old data

**Phase 3 - Drug-Entity Associations (Nov 23, 2025)**
- Created entity tables: `press_releases`, `ir_decks`
- Created drug association junction tables: `drug_trials`, `drug_papers`, `drug_press_releases`, `drug_ir_decks`
- Replaced text-based matching with proper database relationships
- Implemented `drugAssociationService` (809 lines) for managing associations
- All drug groups now persist with exact associations (no re-derivation needed)

**Phase 4 - PDF Extraction Async System (Nov 10-29, 2025)**
- Created `pdf_extraction_jobs` and `pdf_extraction_results` tables
- Job status tracking: pending, processing, partial, completed, failed
- Progressive loading: `partial` status enables viewing markdown while graphs analyze
- SessionStorage caching for faster history loading on repeat visits
- Auto-refresh history when jobs complete

**Phase 5 - Security and Performance Hardening (Dec 14, 2025)**
- Enabled RLS on all 19 public tables
- Added 50+ RLS policies with proper access control
- Optimized all policies with `(select auth.uid())` pattern for performance
- Added missing foreign key indexes on junction tables
- Removed duplicate policies and indexes
- Fixed function security (`update_updated_at_column` search_path)

### Pending Items

- Run migration script to backfill existing JSONB data for legacy projects
- Deprecate JSONB columns after migration and testing period

---

## Table of Contents

- [Database Architecture Overview](#database-architecture-overview)
- [Database Connection](#database-connection)
- [Schema Architecture](#schema-architecture)
- [Tables Reference](#tables-reference)
- [Row Level Security](#row-level-security)
- [Performance Optimizations](#performance-optimizations)
- [Database Operations](#database-operations)
- [Migrations](#migrations)
- [Troubleshooting](#troubleshooting)

---

## Database Architecture Overview

ABCresearch uses **Supabase** as its backend database and authentication platform. Supabase is built on top of PostgreSQL, providing a modern, scalable, and developer-friendly database solution with built-in authentication, real-time subscriptions, and RESTful APIs.

### Design Philosophy

The database follows a **project-centric architecture** where a project is the central entity that contains all related research data. This approach:

- Aligns with user mental model (users work on "projects")
- Supports multiple views (Market Map, Asset Pipeline, Papers, Trials)
- Enables flexible data organization and future feature expansion
- Maintains data consistency across different UI views

### Key Components

| Component | Technology | Version |
|-----------|------------|---------|
| Database | PostgreSQL | 17.x (managed by Supabase) |
| Authentication | Supabase Auth | JWT-based |
| Client Library | @supabase/supabase-js | v2.57.4 |
| Edge Functions | Deno | Serverless |

---

## Database Connection

### Client Configuration

**File**: `src/lib/supabase.ts`

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

### Environment Variables

Required environment variables in `.env`:

```bash
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**Security Notes**:

- `VITE_SUPABASE_ANON_KEY` is safe to expose client-side (public key)
- Row Level Security (RLS) policies protect data access
- Service role key should NEVER be exposed client-side

---

## Schema Architecture

### Hybrid Architecture: JSONB + Normalized Tables

ABCresearch uses a **hybrid dual-write architecture** during the transition from JSONB blobs to normalized relational tables:

**Current State**:
- Write Path: Data is written to BOTH legacy JSONB columns AND new normalized tables
- Read Path: UI reads from normalized tables, falls back to JSONB if needed
- Goal: Complete migration to normalized schema, then deprecate JSONB columns

**Benefits of Normalization**:
- Deduplication: Same trial/paper stored once, referenced by multiple projects
- Performance: 10-100x faster queries with proper indexes
- Integrity: Foreign key constraints prevent orphaned data
- Flexibility: Easy to add columns without restructuring JSONB
- Cross-Project Analysis: Query "all GLP-1 trials" across all user projects

### Entity Relationship Diagram

```
                        auth.users (Supabase)
                              |
              +---------------+---------------+
              |                               |
              v                               v
         projects                      watched_feeds
              |                               |
    +---------+---------+                     v
    |         |         |              trial_updates
    v         v         v
project_   project_   project_
trials     papers     drugs
    |         |         |
    v         v         v
 trials    papers     drugs
                        |
        +-------+-------+-------+
        |       |       |       |
        v       v       v       v
   drug_    drug_   drug_    drug_
   trials   papers  press_   ir_decks
                    releases
        |       |       |       |
        v       v       v       v
   trials   papers   press_   ir_decks
                    releases


Additional Tables:
- market_maps (linked to projects)
- pdf_extraction_jobs --> pdf_extraction_results
- search_sessions
```

### Table Categories

**Core Tables**:
- `projects` - User research projects (central entity)
- `market_maps` - Saved research sessions (legacy, linked to projects)

**Entity Tables** (normalized research data):
- `trials` - Clinical trial data from ClinicalTrials.gov
- `papers` - Research papers from PubMed
- `drugs` - Pharmaceutical drug data
- `press_releases` - Company press release data
- `ir_decks` - Investor relations deck data

**Project Junction Tables** (many-to-many: projects to entities):
- `project_trials`
- `project_papers`
- `project_drugs`

**Drug Association Tables** (many-to-many: drugs to entities within project context):
- `drug_trials`
- `drug_papers`
- `drug_press_releases`
- `drug_ir_decks`

**Feature Tables**:
- `watched_feeds` - RSS feed monitoring subscriptions
- `trial_updates` - Tracked changes to clinical trials
- `pdf_extraction_jobs` - Async PDF extraction job queue
- `pdf_extraction_results` - Completed extraction results
- `search_sessions` - User search session data

---

## Tables Reference

### projects

**Purpose**: Core table storing research projects with all associated data.

```sql
CREATE TABLE projects (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  chat_history JSONB DEFAULT '[]'::jsonb,
  search_queries JSONB,
  pipeline_candidates JSONB
);
```

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGSERIAL | Primary key |
| `user_id` | UUID | Owner of the project (references auth.users) |
| `name` | TEXT | User-defined project name |
| `description` | TEXT | Optional project description |
| `chat_history` | JSONB | Array of chat messages between user and AI |
| `search_queries` | JSONB | Latest search query and strategies |
| `pipeline_candidates` | JSONB | AI-extracted pipeline drug candidates |

### trials

**Purpose**: Normalized clinical trial data from ClinicalTrials.gov.

```sql
CREATE TABLE trials (
  id BIGSERIAL PRIMARY KEY,
  nct_id TEXT UNIQUE NOT NULL,
  brief_title TEXT NOT NULL,
  official_title TEXT,
  overall_status TEXT,
  phase TEXT[],
  conditions TEXT[],
  interventions TEXT[],
  sponsors_lead TEXT,
  enrollment INTEGER,
  start_date TEXT,
  completion_date TEXT,
  locations JSONB,
  study_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### papers

**Purpose**: Normalized research paper data from PubMed.

```sql
CREATE TABLE papers (
  id BIGSERIAL PRIMARY KEY,
  pmid TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  abstract TEXT,
  journal TEXT,
  publication_date TEXT,
  authors TEXT[],
  doi TEXT,
  nct_number TEXT,
  relevance_score INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### drugs

**Purpose**: Normalized pharmaceutical drug data.

```sql
CREATE TABLE drugs (
  id BIGSERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  normalized_name TEXT NOT NULL,
  drug_type TEXT,
  brand_names TEXT[],
  mechanism TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Junction Tables

**project_trials, project_papers, project_drugs**:

```sql
CREATE TABLE project_trials (
  project_id BIGINT REFERENCES projects(id) ON DELETE CASCADE,
  trial_id BIGINT REFERENCES trials(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (project_id, trial_id)
);
```

**drug_trials, drug_papers, drug_press_releases, drug_ir_decks**:

```sql
CREATE TABLE drug_trials (
  drug_id BIGINT REFERENCES drugs(id) ON DELETE CASCADE,
  trial_id BIGINT REFERENCES trials(id) ON DELETE CASCADE,
  project_id BIGINT REFERENCES projects(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (drug_id, trial_id, project_id)
);
```

Note: Drug association tables include `project_id` to scope associations within a project context (multi-tenant).

### pdf_extraction_jobs

**Purpose**: Track async PDF extraction jobs with status and progress.

```sql
CREATE TABLE pdf_extraction_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id BIGINT REFERENCES projects(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  enable_graphify BOOLEAN DEFAULT true,
  force_ocr BOOLEAN DEFAULT false,
  max_graphify_images INTEGER DEFAULT 10,
  status TEXT NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'processing', 'partial', 'completed', 'failed', 'cancelled')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  current_stage TEXT,
  datalab_job_id TEXT,
  datalab_check_url TEXT,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Job Status Lifecycle**:

```
pending      --> Job created, waiting to start
processing   --> Datalab extraction in progress (0-80%)
partial      --> Markdown/images ready, graphs analyzing (80-95%)
completed    --> All done including graphs (100%)
failed       --> Error at any stage (can retry)
```

### watched_feeds and trial_updates

**Purpose**: RSS feed monitoring and clinical trial change tracking.

```sql
CREATE TABLE watched_feeds (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  feed_url TEXT NOT NULL,
  label TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_checked_at TIMESTAMPTZ,
  refresh_status JSONB,
  notification_email TEXT,
  last_email_sent_at TIMESTAMPTZ
);

CREATE TABLE trial_updates (
  id BIGSERIAL PRIMARY KEY,
  feed_id BIGINT NOT NULL REFERENCES watched_feeds(id) ON DELETE CASCADE,
  nct_id TEXT NOT NULL,
  title TEXT NOT NULL,
  last_update TIMESTAMPTZ NOT NULL,
  study_url TEXT NOT NULL,
  history_url TEXT NOT NULL,
  comparison_url TEXT NOT NULL,
  version_a INTEGER NOT NULL,
  version_b INTEGER NOT NULL,
  raw_diff_blocks TEXT[] DEFAULT '{}',
  llm_summary TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sponsor TEXT,
  email_sent BOOLEAN DEFAULT false
);
```

---

## Row Level Security

All 19 tables in the public schema have Row Level Security (RLS) enabled. This ensures users can only access data they own or have permission to view.

### Security Model

The security model follows these principles:

1. **Projects are user-scoped**: Each project has a `user_id` that matches `auth.uid()`
2. **Entity tables contain public data**: Trials, papers, and drugs from public sources are readable by all authenticated users
3. **Junction tables are project-scoped**: Users can only access junction table rows for projects they own
4. **User-specific tables check user_id**: Tables like `watched_feeds` and `pdf_extraction_jobs` check `user_id = auth.uid()`

### RLS Status by Table

| Table | RLS Enabled | Policy Type |
|-------|-------------|-------------|
| `projects` | Yes | Direct ownership (`user_id = auth.uid()`) |
| `market_maps` | Yes | Direct ownership (`user_id = auth.uid()`) |
| `trials` | Yes | Public read for authenticated users |
| `papers` | Yes | Public read for authenticated users |
| `drugs` | Yes | Public read for authenticated users |
| `press_releases` | Yes | Public read for authenticated users |
| `ir_decks` | Yes | Public read for authenticated users |
| `project_trials` | Yes | Project-scoped (via project ownership) |
| `project_papers` | Yes | Project-scoped (via project ownership) |
| `project_drugs` | Yes | Project-scoped (via project ownership) |
| `drug_trials` | Yes | Project-scoped (via project ownership) |
| `drug_papers` | Yes | Project-scoped (via project ownership) |
| `drug_press_releases` | Yes | Project-scoped (via project ownership) |
| `drug_ir_decks` | Yes | Project-scoped (via project ownership) |
| `watched_feeds` | Yes | Direct ownership (`user_id = auth.uid()`) |
| `trial_updates` | Yes | Feed-scoped (via watched_feeds ownership) |
| `pdf_extraction_jobs` | Yes | Direct ownership (`user_id = auth.uid()`) |
| `pdf_extraction_results` | Yes | Direct ownership (`user_id = auth.uid()`) |
| `search_sessions` | Yes | Direct ownership (`userID = auth.uid()`) |

### Policy Patterns

#### Direct User Ownership

For tables with a `user_id` column:

```sql
CREATE POLICY "Users can view their own records"
ON public.table_name FOR SELECT
USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert their own records"
ON public.table_name FOR INSERT
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update their own records"
ON public.table_name FOR UPDATE
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete their own records"
ON public.table_name FOR DELETE
USING ((select auth.uid()) = user_id);
```

#### Project-Scoped Access

For junction tables that reference projects:

```sql
CREATE POLICY "Users can view records for their projects"
ON public.project_trials FOR SELECT
USING (project_id IN (
  SELECT id FROM projects WHERE user_id = (select auth.uid())
));

CREATE POLICY "Users can insert records for their projects"
ON public.project_trials FOR INSERT
WITH CHECK (project_id IN (
  SELECT id FROM projects WHERE user_id = (select auth.uid())
));

CREATE POLICY "Users can delete records for their projects"
ON public.project_trials FOR DELETE
USING (project_id IN (
  SELECT id FROM projects WHERE user_id = (select auth.uid())
));
```

#### Public Research Data

For entity tables containing public research data:

```sql
CREATE POLICY "Authenticated users can view"
ON public.trials FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert"
ON public.trials FOR INSERT TO authenticated
WITH CHECK ((select auth.uid()) IS NOT NULL);
```

---

## Performance Optimizations

### RLS Policy Optimization

All RLS policies use `(select auth.uid())` instead of `auth.uid()` directly. This caches the user ID once per query instead of re-evaluating it for every row.

**Slow (re-evaluates per row)**:
```sql
USING (auth.uid() = user_id)
```

**Fast (evaluates once)**:
```sql
USING ((select auth.uid()) = user_id)
```

This optimization was applied in the December 2024 security migration (`20251214_optimize_rls_policies.sql`).

### Foreign Key Indexes

Junction tables have indexes on their foreign key columns to optimize JOIN operations:

```sql
CREATE INDEX idx_project_trials_trial_id ON project_trials(trial_id);
CREATE INDEX idx_project_papers_paper_id ON project_papers(paper_id);
CREATE INDEX idx_project_drugs_drug_id ON project_drugs(drug_id);
```

### Entity Table Indexes

```sql
CREATE INDEX idx_trials_nct_id ON trials(nct_id);
CREATE INDEX idx_trials_phase ON trials USING GIN(phase);
CREATE INDEX idx_trials_conditions ON trials USING GIN(conditions);

CREATE INDEX idx_papers_pmid ON papers(pmid);
CREATE INDEX idx_papers_publication_date ON papers(publication_date);

CREATE INDEX idx_drugs_normalized_name ON drugs(normalized_name);
```

### Best Practices

1. **Avoid duplicate policies**: Each table should have only one policy per role and action combination
2. **Use specific JSONB operators**: For JSONB queries, use `@>`, `?`, and path operators
3. **Limit result sets**: Always use pagination for large datasets
4. **Select specific fields**: Avoid `SELECT *` when only specific fields are needed

---

## Database Operations

### CRUD Operations

#### Create

```typescript
const { data, error } = await supabase
  .from('projects')
  .insert({
    user_id: user.id,
    name: 'GLP-1 Research Project',
    description: 'Analysis of GLP-1 agonists'
  })
  .select()
  .single()
```

#### Read

```typescript
// Get all user's projects
const { data, error } = await supabase
  .from('projects')
  .select('*')
  .order('created_at', { ascending: false })

// Get project with trials
const { data, error } = await supabase
  .from('project_trials')
  .select('added_at, trials (*)')
  .eq('project_id', projectId)
```

#### Update

```typescript
const { data, error } = await supabase
  .from('projects')
  .update({
    name: 'Updated Project Name',
    updated_at: new Date().toISOString()
  })
  .eq('id', projectId)
  .select()
  .single()
```

#### Delete

```typescript
const { error } = await supabase
  .from('projects')
  .delete()
  .eq('id', projectId)
```

### Service Layer

**Implementation Files**:

| Service | File | Purpose |
|---------|------|---------|
| Project Service | `src/services/projectService.ts` | CRUD for projects |
| Trial Service | `src/services/trialService.ts` | CRUD for trials |
| Paper Service | `src/services/paperService.ts` | CRUD for papers |
| Drug Service | `src/services/drugService.ts` | CRUD for drugs |
| Drug Association Service | `src/services/drugAssociationService.ts` | Drug-entity associations |
| Market Map Service | `src/services/marketMapService.ts` | Dual-write logic |
| PDF Extraction Service | `src/services/pdfExtractionJobService.ts` | PDF job management |

### Dual-Write Strategy

```typescript
export async function saveMarketMap(data, projectId) {
  // 1. Write to market_maps (JSONB) - backward compatible
  const { data: result } = await supabase
    .from('market_maps')
    .insert({
      ...data,
      trials_data: data.trials,
      papers_data: data.papers
    })
  
  // 2. Write to normalized tables (background, non-blocking)
  if (projectId) {
    backgroundDualWrite(projectId, data)
  }
  
  return result
}
```

---

## Migrations

### Migration Files

Migrations are located in `supabase/migrations/`. See `supabase/migrations/README.md` for comprehensive documentation.

**Core Migrations**:

| File | Description |
|------|-------------|
| `add_chat_history_to_projects.sql` | Adds chat_history JSONB column |
| `add_pdf_extraction_async.sql` | Creates PDF extraction tables |
| `20251123_add_drug_entity_junction_tables.sql` | Drug association junction tables |
| `20251126_create_watched_feeds_table.sql` | RSS feed monitoring |
| `20251126_create_trial_updates_table.sql` | Trial change tracking |

**Security and Performance Migrations (Dec 2024)**:

| File | Description |
|------|-------------|
| `20251214_add_rls_policies_entity_tables.sql` | Enables RLS on entity and junction tables |
| `20251214_add_foreign_key_indexes.sql` | Adds missing FK indexes |
| `20251214_optimize_rls_policies.sql` | Optimizes RLS with (select auth.uid()) |

### Running Migrations

**Via Supabase MCP**:
```typescript
apply_migration({
  project_id: "your-project-id",
  name: "migration_name",
  query: "SQL content"
})
```

**Via Supabase Dashboard**:
1. Navigate to SQL Editor
2. Paste migration SQL
3. Click Run

**Via Supabase CLI**:
```bash
supabase db push
```

### Data Migration (JSONB to Normalized)

To backfill existing JSONB data into normalized tables:

1. Open browser console on the running app
2. Run migration command:
   ```javascript
   await window.runMigration()
   ```
3. Monitor progress in the console

**Safety Features**:
- Non-destructive: JSONB data remains untouched as fallback
- Idempotent: Can run multiple times safely (upserts, not inserts)
- Error handling: Individual failures do not stop entire migration
- Automatic fallback: UI uses JSONB if normalized tables are empty

---

## Troubleshooting

### Common Issues

**"new row violates row-level security policy"**

Solution: Ensure user is authenticated and `user_id` matches `auth.uid()`. Check that the user owns the project being referenced.

**"relation does not exist"**

Solution:
1. Check table name spelling
2. Verify migrations have been applied
3. Check RLS policies are not blocking access

**Slow JSONB queries**

Solution:
1. Add GIN indexes on JSONB columns
2. Use specific JSONB operators (`@>`, `?`, path operators)
3. Consider normalizing data into separate tables

**Connection errors**

Solution:
1. Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
2. Check network connectivity
3. Verify Supabase project is active

### Debug Queries

**Check RLS status**:
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;
```

**View policies on a table**:
```sql
SELECT tablename, policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'your_table';
```

**Run database advisors**:
```typescript
// Check security issues
get_advisors({ project_id: "your-project-id", type: "security" })

// Check performance issues
get_advisors({ project_id: "your-project-id", type: "performance" })
```

### Testing RLS Policies

```sql
-- Switch to authenticated user context
SET request.jwt.claims.sub = 'user-uuid-here';

-- Test query (should only return user's data)
SELECT * FROM projects;

-- Switch to anonymous (no authentication)
RESET request.jwt.claims.sub;

-- Test query (should return empty - no access)
SELECT * FROM projects;
```

---

## Security Best Practices

### 1. Row Level Security

Always enable RLS on tables with user data:
```sql
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
```

### 2. Service Role Key Protection

Never expose service role key client-side:
```typescript
// WRONG - Service role key exposed
const supabase = createClient(url, SERVICE_ROLE_KEY)  // DO NOT DO THIS

// CORRECT - Anon key for client
const supabase = createClient(url, ANON_KEY)
```

### 3. Input Validation

Validate data before database operations:
```typescript
function validateProject(data: any) {
  if (!data.name || data.name.length > 255) {
    throw new Error('Invalid name')
  }
  // Additional validation...
}
```

### 4. SQL Injection Prevention

Supabase client uses parameterized queries automatically:
```typescript
// Safe - parameterized query
const { data } = await supabase
  .from('projects')
  .select('*')
  .eq('name', userInput)  // Automatically escaped
```

---

## Quick Reference

### Essential Commands

```bash
# Supabase CLI
supabase init                    # Initialize project
supabase start                   # Start local instance
supabase stop                    # Stop local instance
supabase db push                 # Apply migrations
supabase db reset                # Reset database
supabase migration new <name>    # Create migration
supabase db dump                 # Export database
```

### Common Queries

```typescript
// Get all user's projects
supabase.from('projects').select('*')

// Get project with trials
supabase.from('project_trials')
  .select('added_at, trials (*)')
  .eq('project_id', projectId)

// Get drug associations
supabase.from('drug_trials')
  .select('trials (*)')
  .eq('drug_id', drugId)
  .eq('project_id', projectId)
```

---

## References

- [Supabase RLS Documentation](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Performance Guide](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select)
- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Migrations README](../../supabase/migrations/README.md)
