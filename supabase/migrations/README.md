# Database Migrations

This directory contains all SQL migrations for the ABCresearch Supabase database. Migrations are applied in chronological order based on their filename prefix.

## Table of Contents

- [Migration Naming Convention](#migration-naming-convention)
- [Current Migrations](#current-migrations)
- [Database Architecture](#database-architecture)
- [Row Level Security (RLS)](#row-level-security-rls)
- [Performance Optimizations](#performance-optimizations)
- [Creating New Migrations](#creating-new-migrations)
- [Applying Migrations](#applying-migrations)
- [Troubleshooting](#troubleshooting)

---

## Migration Naming Convention

Migrations follow this naming pattern:

```
YYYYMMDD_description_in_snake_case.sql
```

For example:
- `20251214_add_rls_policies_entity_tables.sql`
- `20251126_create_watched_feeds_table.sql`

Migrations without a date prefix are legacy migrations that should be considered as applied before dated migrations.

---

## Current Migrations

### Core Schema Migrations

| File | Description |
|------|-------------|
| `add_chat_history_to_projects.sql` | Adds `chat_history` JSONB column to projects table |
| `deprecate_jsonb_columns.sql` | Marks legacy JSONB columns in market_maps as deprecated |
| `add_pdf_extraction_async.sql` | Creates `pdf_extraction_jobs` and `pdf_extraction_results` tables |

### Feature Migrations

| File | Description |
|------|-------------|
| `20251123_add_drug_entity_junction_tables.sql` | Creates junction tables for drug-entity associations (`drug_trials`, `drug_papers`, `drug_press_releases`, `drug_ir_decks`) |
| `20251123_add_search_queries_to_projects.sql` | Adds `search_queries` JSONB column to projects |
| `20251126_create_watched_feeds_table.sql` | Creates `watched_feeds` table for RSS feed monitoring |
| `20251126_create_trial_updates_table.sql` | Creates `trial_updates` table for tracking clinical trial changes |
| `20251126_add_sponsor_to_trial_updates.sql` | Adds `sponsor` column to trial_updates |
| `20251127_add_pipeline_candidates_to_projects.sql` | Adds `pipeline_candidates` JSONB column for AI-extracted drug candidates |
| `add_email_notifications_to_watched_feeds.sql` | Adds email notification support to watched_feeds |

### Security and Performance Migrations (December 2024)

| File | Description |
|------|-------------|
| `20251214_add_rls_policies_entity_tables.sql` | Enables RLS and adds policies to entity tables (`trials`, `papers`, `drugs`) and junction tables (`project_trials`, `project_papers`, `project_drugs`) |
| `20251214_add_foreign_key_indexes.sql` | Adds missing indexes on foreign key columns for query performance |
| `20251214_optimize_rls_policies.sql` | Optimizes existing RLS policies for better performance |

---

## Database Architecture

### Core Tables

```
projects (user research projects)
    |
    +-- market_maps (saved research sessions)
    |
    +-- project_trials (junction) --> trials
    |
    +-- project_papers (junction) --> papers
    |
    +-- project_drugs (junction) --> drugs
    |
    +-- pdf_extraction_jobs --> pdf_extraction_results
    |
    +-- watched_feeds --> trial_updates
```

### Entity Tables

These tables store normalized research data from external sources:

- **trials**: Clinical trial data from ClinicalTrials.gov
- **papers**: Research papers from PubMed
- **drugs**: Pharmaceutical drug data extracted from trials and papers
- **press_releases**: Company press release data
- **ir_decks**: Investor relations deck data

### Junction Tables

Junction tables implement many-to-many relationships between projects and entities:

- **project_trials**: Links projects to trials
- **project_papers**: Links projects to papers
- **project_drugs**: Links projects to drugs

Drug association tables link drugs to other entities within a project context:

- **drug_trials**: Links drugs to trials (scoped by project)
- **drug_papers**: Links drugs to papers (scoped by project)
- **drug_press_releases**: Links drugs to press releases (scoped by project)
- **drug_ir_decks**: Links drugs to IR decks (scoped by project)

---

## Row Level Security (RLS)

All tables exposed to the API have Row Level Security enabled. This ensures users can only access data they own or have permission to view.

### Security Model

The security model follows these principles:

1. **Projects are user-scoped**: Each project has a `user_id` that matches `auth.uid()`
2. **Entity tables contain public data**: Trials, papers, and drugs from public sources are readable by all authenticated users
3. **Junction tables are project-scoped**: Users can only access junction table rows for projects they own
4. **User-specific tables check user_id**: Tables like `watched_feeds` and `pdf_extraction_jobs` check `user_id = auth.uid()`

### Policy Patterns

#### Direct User Ownership

For tables with a `user_id` column:

```sql
CREATE POLICY "Users can view their own records"
ON public.table_name FOR SELECT
USING ((select auth.uid()) = user_id);
```

#### Project-Scoped Access

For junction tables that reference projects:

```sql
CREATE POLICY "Users can view records for their projects"
ON public.junction_table FOR SELECT
USING (project_id IN (
  SELECT id FROM projects WHERE user_id = (select auth.uid())
));
```

#### Public Research Data

For entity tables containing public research data:

```sql
CREATE POLICY "Authenticated users can view"
ON public.entity_table FOR SELECT TO authenticated
USING (true);
```

### Tables with RLS Enabled

| Table | Policy Type | Notes |
|-------|-------------|-------|
| `projects` | Direct ownership | `user_id = auth.uid()` |
| `market_maps` | Direct ownership | `user_id = auth.uid()` |
| `trials` | Public read | All authenticated users can read |
| `papers` | Public read | All authenticated users can read |
| `drugs` | Public read | All authenticated users can read |
| `project_trials` | Project-scoped | Via project ownership check |
| `project_papers` | Project-scoped | Via project ownership check |
| `project_drugs` | Project-scoped | Via project ownership check |
| `drug_trials` | Project-scoped | Via project ownership check |
| `drug_papers` | Project-scoped | Via project ownership check |
| `drug_press_releases` | Project-scoped | Via project ownership check |
| `drug_ir_decks` | Project-scoped | Via project ownership check |
| `watched_feeds` | Direct ownership | `user_id = auth.uid()` |
| `trial_updates` | Feed-scoped | Via watched_feeds ownership |
| `pdf_extraction_jobs` | Direct ownership | `user_id = auth.uid()` |
| `pdf_extraction_results` | Direct ownership | `user_id = auth.uid()` |
| `search_sessions` | Direct ownership | `userID = auth.uid()` |
| `press_releases` | Public read | All authenticated users can read |
| `ir_decks` | Public read | All authenticated users can read |

---

## Performance Optimizations

### RLS Policy Optimization

All RLS policies use `(select auth.uid())` instead of `auth.uid()` directly. This caches the user ID once per query instead of re-evaluating it for every row.

**Slow (re-evaluates per row):**
```sql
USING (auth.uid() = user_id)
```

**Fast (evaluates once):**
```sql
USING ((select auth.uid()) = user_id)
```

This optimization is applied in `20251214_optimize_rls_policies.sql`.

### Foreign Key Indexes

Junction tables have indexes on their foreign key columns to optimize JOIN operations:

```sql
CREATE INDEX idx_project_trials_trial_id ON project_trials(trial_id);
CREATE INDEX idx_project_papers_paper_id ON project_papers(paper_id);
CREATE INDEX idx_project_drugs_drug_id ON project_drugs(drug_id);
```

These indexes are created in `20251214_add_foreign_key_indexes.sql`.

### Avoiding Duplicate Policies

Each table should have only one policy per role and action combination. Multiple permissive policies for the same role/action cause all policies to be evaluated, reducing performance.

---

## Creating New Migrations

### Step 1: Create the Migration File

Create a new file with the naming convention:

```bash
touch supabase/migrations/YYYYMMDD_description.sql
```

### Step 2: Write Idempotent SQL

Migrations should be idempotent (safe to run multiple times):

```sql
-- Use IF NOT EXISTS for CREATE statements
CREATE TABLE IF NOT EXISTS public.new_table (...);

-- Use IF EXISTS for DROP statements
DROP POLICY IF EXISTS "old_policy" ON public.table_name;

-- Use OR REPLACE for functions
CREATE OR REPLACE FUNCTION public.my_function() ...
```

### Step 3: Include RLS Policies

For any new table exposed to the API:

```sql
-- Enable RLS
ALTER TABLE public.new_table ENABLE ROW LEVEL SECURITY;

-- Add policies using optimized pattern
CREATE POLICY "Users can view their own records"
ON public.new_table FOR SELECT
USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert their own records"
ON public.new_table FOR INSERT
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update their own records"
ON public.new_table FOR UPDATE
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete their own records"
ON public.new_table FOR DELETE
USING ((select auth.uid()) = user_id);
```

### Step 4: Add Indexes for Foreign Keys

If the table has foreign keys, add indexes:

```sql
CREATE INDEX IF NOT EXISTS idx_new_table_fk_column 
ON public.new_table(fk_column);
```

### Step 5: Include Rollback Comments

Add commented rollback SQL at the end of the migration:

```sql
-- ============================================================================
-- ROLLBACK SECTION (Run this to undo the migration if needed)
-- ============================================================================
/*
DROP TABLE IF EXISTS public.new_table;
*/
```

---

## Applying Migrations

### Via Supabase MCP (Recommended)

Migrations can be applied directly via the Supabase MCP tools:

```typescript
// Using apply_migration tool
apply_migration({
  project_id: "your-project-id",
  name: "migration_name",
  query: "SQL content here"
})
```

### Via Supabase Dashboard

1. Go to Supabase Dashboard
2. Navigate to SQL Editor
3. Paste the migration SQL
4. Click Run

### Via Supabase CLI

```bash
supabase db push
```

---

## Troubleshooting

### Checking RLS Status

Query to see which tables have RLS enabled:

```sql
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;
```

### Viewing Existing Policies

Query to see all policies on a table:

```sql
SELECT tablename, policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'your_table';
```

### Running the Database Advisor

Use the Supabase MCP tools to check for security and performance issues:

```typescript
// Check security issues
get_advisors({ project_id: "your-project-id", type: "security" })

// Check performance issues
get_advisors({ project_id: "your-project-id", type: "performance" })
```

### Common Issues

#### Policy Prevents Access

If a query returns no rows unexpectedly:

1. Check that the user is authenticated
2. Verify the user owns the project being accessed
3. Check the RLS policy conditions match your query

#### Slow Queries

If queries are slow:

1. Check for missing indexes on JOIN columns
2. Verify RLS policies use `(select auth.uid())` not `auth.uid()`
3. Look for multiple permissive policies on the same role/action

#### Migration Fails

If a migration fails:

1. Check for syntax errors in the SQL
2. Verify referenced tables and columns exist
3. Check for duplicate policy names (use DROP POLICY IF EXISTS first)

---

## References

- [Supabase RLS Documentation](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Performance Guide](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select)
- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Project Database Schema Documentation](../../documentation/technical-documentation/03-database.md)

