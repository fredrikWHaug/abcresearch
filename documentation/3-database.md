LATEST UPDATE: 11/08/25

# ABCresearch - Database Documentation

**IMPLEMENTATION STATUS (Nov 8, 2025)**: 
- ✅ **Phase 1 Complete**: Project creation and storage implemented
- ✅ **Phase 2 Complete**: Normalized schema with dual-write strategy
  - Created `trials`, `papers`, `drugs` tables with proper columns
  - Created junction tables: `project_trials`, `project_papers`, `project_drugs`
  - Implemented background dual-write to both JSONB and normalized tables
  - UI reads from normalized tables with automatic fallback to JSONB
  - Migration utility created for backfilling old data
- ✅ `projects` table is now connected to the UI
- ✅ Users can create projects that persist in the database
- ✅ Market maps linked to projects via `project_id` foreign key
- ✅ Chat history persists per project (database + in-memory cache)
  - Auto-saves to database every 2 seconds (debounced)
  - Immediate save on project switch
  - Loads from database on project mount/refresh
  - Persists across browser sessions
- 📋 **Next**: Run migration script to backfill existing JSONB data
- 📋 **Planned**: Deprecate JSONB columns after migration and testing period (migration file created)

## Migration from JSONB to Normalized Schema

### Running the Migration

To backfill existing JSONB data into the new normalized tables:

1. **Open browser console** on the running app (localhost:5173 or production)
2. **Run migration command**:
   ```javascript
   await window.runMigration()
   ```
3. **Monitor progress** in the console - you'll see:
   - Number of market maps processed
   - Trials and papers migrated
   - Any errors encountered

### What the Migration Does

- Reads all `market_maps` with JSONB data (`trials_data`, `papers_data`)
- Upserts each trial/paper into normalized `trials`/`papers` tables
- Links entities to projects via junction tables (`project_trials`, `project_papers`)
- Handles duplicates automatically (same NCT ID or PMID → single row)
- Logs progress and errors for troubleshooting

### Safety Features

- **Non-destructive**: JSONB data remains untouched as fallback
- **Idempotent**: Can run multiple times safely (upserts, not inserts)
- **Error handling**: Individual failures don't stop entire migration
- **Automatic fallback**: UI uses JSONB if normalized tables are empty

### After Migration

- New data writes to both JSONB and normalized tables (dual-write)
- UI reads from normalized tables with JSONB fallback
- Plan to deprecate JSONB columns after testing period (2-4 weeks)
- Eventually drop JSONB columns to complete migration

## Database Architecture Overview

ABCresearch uses **Supabase** as its backend database and authentication platform. Supabase is built on top of PostgreSQL, providing a modern, scalable, and developer-friendly database solution with built-in authentication, real-time subscriptions, and RESTful APIs.

### Design Philosophy

The database follows a **project-centric architecture** where a project is the central entity that contains all related research data. This approach:
- Aligns with user mental model (users work on "projects")
- Supports multiple views (Market Map, Asset Pipeline, Papers, Trials)
- Enables flexible data organization and future feature expansion
- Maintains data consistency across different UI views

### Key Components

- **Database**: PostgreSQL 15+ (managed by Supabase)
- **Authentication**: Supabase Auth (JWT-based)
- **Client Library**: `@supabase/supabase-js` (v2.57.4)
- **ORM**: Supabase JavaScript Client (no traditional ORM)
- **Storage**: Not currently used (potential future use)
- **Edge Functions**: Deno-based serverless functions

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
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**Security Notes**:
- `VITE_SUPABASE_ANON_KEY` is safe to expose client-side (it's a public key)
- Row Level Security (RLS) policies protect data access
- Service role key (if needed) should NEVER be exposed client-side

## Database Schema Architecture

### Hybrid Architecture: JSONB + Normalized Tables

ABCresearch uses a **hybrid dual-write architecture** during the transition from JSONB blobs to normalized relational tables:

**Current State (Nov 2025)**:
- ✅ **Write Path**: Data is written to BOTH legacy JSONB columns AND new normalized tables
- ✅ **Read Path**: UI reads from normalized tables, falls back to JSONB if needed
- 🎯 **Goal**: Complete migration to normalized schema, then deprecate JSONB columns

**Benefits of Normalization**:
- **Deduplication**: Same trial/paper stored once, referenced by multiple projects
- **Performance**: 10-100x faster queries with proper indexes
- **Integrity**: Foreign key constraints prevent orphaned data
- **Flexibility**: Easy to add columns without restructuring JSONB
- **Cross-Project Analysis**: Query "all GLP-1 trials" across all user projects

### Entity Relationship Diagram

```
┌─────────────────┐
│   auth.users    │
│  (Supabase)     │
└────────┬────────┘
         │ 1:N
         ▼
┌─────────────────┐           ┌──────────────────┐
│    projects     │◄──────────│   market_maps    │
│                 │   1:N     │  (Legacy/Hybrid) │
└────────┬────────┘           └──────────────────┘
         │ 1:N                     trials_data (JSONB) ⚠️ Deprecated
         │                         papers_data (JSONB) ⚠️ Deprecated
         │
    ┌────┴────┬─────────────┬──────────────┐
    │         │             │              │
    ▼         ▼             ▼              ▼
┌────────┐ ┌──────────┐ ┌────────────┐ ┌──────────┐
│project_│ │project_  │ │project_    │ │trials    │
│trials  │ │papers    │ │drugs       │ │          │
└───┬────┘ └────┬─────┘ └─────┬──────┘ │nct_id    │
    │           │             │        │brief_title│
    │ N:M       │ N:M         │ N:M    │phase      │
    │           │             │        │...        │
    ▼           ▼             ▼        └──────────┘
┌────────┐ ┌──────────┐ ┌────────────┐
│trials  │ │papers    │ │drugs       │
│        │ │          │ │            │
│nct_id  │ │pmid      │ │name        │
│title   │ │title     │ │type        │
│phase   │ │abstract  │ │mechanism   │
│...     │ │...       │ │...         │
└────────┘ └──────────┘ └────────────┘
```

## Tables

### 1. `projects` Table

**Purpose**: Core table storing research projects with all associated data (trials, papers, drugs, analysis)

**Current Implementation Status**:
- ✅ **Phase 1 (Nov 8, 2025)**: Basic project CRUD operations
  - Table exists in database with `id`, `user_id`, `name`, `description`, `created_at`, `updated_at`
  - Project creation UI connected and working
  - Service layer implemented (`src/services/projectService.ts`)
  - RLS policies configured for user isolation
- 🚧 **Phase 2 (Planned)**: Add JSONB fields for trials, papers, drugs, slide data, chat history
- 📋 **Phase 3 (Planned)**: Migrate data from `market_maps` table

#### Schema Definition

```sql
CREATE TABLE projects (
  -- Primary Key
  id BIGSERIAL PRIMARY KEY,
  
  -- Foreign Key to auth.users
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Basic Information
  name TEXT NOT NULL,
  description TEXT,
  search_query TEXT NOT NULL,
  
  -- Research Data (JSONB for flexibility)
  trials_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  papers_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  drugs_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Analysis & Interaction Data
  slide_data JSONB DEFAULT NULL,
  chat_history JSONB DEFAULT '[]'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Comments
COMMENT ON TABLE projects IS 'Core table for research projects containing trials, papers, drugs, and analysis';
COMMENT ON COLUMN projects.name IS 'User-defined project name';
COMMENT ON COLUMN projects.description IS 'Optional project description';
COMMENT ON COLUMN projects.search_query IS 'Original discovery search query';
COMMENT ON COLUMN projects.trials_data IS 'Array of clinical trial objects from ClinicalTrials.gov';
COMMENT ON COLUMN projects.papers_data IS 'Array of research papers from PubMed';
COMMENT ON COLUMN projects.drugs_data IS 'Array of extracted and normalized drug compounds';
COMMENT ON COLUMN projects.slide_data IS 'AI-generated market analysis and insights';
COMMENT ON COLUMN projects.chat_history IS 'Conversational history between user and AI';
```

#### Column Details

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | BIGSERIAL | PRIMARY KEY | Auto-incrementing unique identifier |
| `user_id` | UUID | NOT NULL, FK | References auth.users(id), owner of the project |
| `name` | TEXT | NOT NULL | User-defined project name |
| `description` | TEXT | NULL | Optional project description |
| `search_query` | TEXT | NOT NULL | Original discovery search query |
| `trials_data` | JSONB | NOT NULL, DEFAULT [] | Array of ClinicalTrial objects |
| `papers_data` | JSONB | NOT NULL, DEFAULT [] | Array of PubMedArticle objects |
| `drugs_data` | JSONB | NOT NULL, DEFAULT [] | Array of extracted drug compounds |
| `slide_data` | JSONB | NULL | AI-generated market analysis data |
| `chat_history` | JSONB | DEFAULT [] | Array of chat messages (user and system) |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Project creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last update timestamp |

#### JSONB Data Structures

**trials_data** structure (array of trial objects):
```typescript
[
  {
    nctId: string,
    briefTitle: string,
    officialTitle?: string,
    overallStatus: string,
    phase?: string[],
    conditions?: string[],
    interventions?: string[],
    sponsors?: {
      lead?: string,
      collaborators?: string[]
    },
    startDate?: string,
    completionDate?: string,
    enrollment?: number,
    studyType?: string,
    locations?: Array<{
      facility: string,
      city: string,
      country: string
    }>,
    rankScore?: number,
    rankReasons?: string[]
  },
  ...
]
```

**papers_data** structure (array of paper objects):
```typescript
[
  {
    pmid: string,
    title: string,
    abstract: string,
    journal: string,
    publicationDate: string,
    doi?: string,
    authors: string[],
    nctNumber?: string,
    relevanceScore: number,
    fullTextLinks: {
      pubmed: string,
      doi?: string
    }
  },
  ...
]
```

**drugs_data** structure (array of drug group objects):
```typescript
[
  {
    normalizedName: string,
    variants: string[],
    trials: Array<{
      nctId: string,
      briefTitle: string,
      phase?: string[],
      status: string
    }>,
    papers: Array<{
      pmid: string,
      title: string
    }>
  },
  ...
]
```

**slide_data** structure:
```typescript
{
  title: string,
  insights: string[],
  keyFindings: Array<{
    title: string,
    description: string
  }>,
  competitiveLandscape: string,
  recommendations: string[]
}
```

**chat_history** structure (array of message objects):
```typescript
[
  {
    type: 'user' | 'system',
    message: string,
    searchSuggestions?: Array<{
      id: string,
      label: string,
      query: string,
      description?: string
    }>
  },
  ...
]
```

#### Indexes

```sql
-- Index on user_id for fast lookups by user
CREATE INDEX idx_projects_user_id ON projects(user_id);

-- Index on created_at for sorting by date (descending)
CREATE INDEX idx_projects_created_at ON projects(created_at DESC);

-- Composite index for user + date queries
CREATE INDEX idx_projects_user_date ON projects(user_id, created_at DESC);

-- GIN indexes on JSONB columns for fast JSON queries (optional, add as needed)
CREATE INDEX idx_projects_trials_data_gin ON projects USING GIN (trials_data);
CREATE INDEX idx_projects_papers_data_gin ON projects USING GIN (papers_data);
CREATE INDEX idx_projects_drugs_data_gin ON projects USING GIN (drugs_data);
```

**Index Usage**:
- `idx_projects_user_id`: Fast user-specific queries
- `idx_projects_created_at`: Sorting by date
- `idx_projects_user_date`: Combined user + date filtering
- GIN indexes: Fast JSONB field searches (add only if needed for query performance)

### 2. `auth.users` Table

**Purpose**: Managed by Supabase Auth for user authentication

#### Schema (Supabase Managed)

```sql
CREATE TABLE auth.users (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Authentication
  email TEXT UNIQUE NOT NULL,
  encrypted_password TEXT NOT NULL,
  email_confirmed_at TIMESTAMPTZ,
  
  -- Metadata
  raw_app_meta_data JSONB,
  raw_user_meta_data JSONB,
  
  -- Tracking
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_sign_in_at TIMESTAMPTZ,
  
  -- Recovery
  confirmation_token TEXT,
  recovery_token TEXT,
  email_change_token_new TEXT,
  
  -- Additional Supabase fields...
);
```

**Key Points**:
- Fully managed by Supabase
- Cannot be directly modified (use Supabase Auth APIs)
- Provides user identity for RLS policies
- Supports email/password authentication
- Extensible with metadata fields

### 3. Normalized Tables (Nov 2025)

#### `trials` Table

**Purpose**: Store clinical trial data with proper columns (replaces `market_maps.trials_data` JSONB)

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

CREATE INDEX idx_trials_nct_id ON trials(nct_id);
CREATE INDEX idx_trials_phase ON trials USING GIN(phase);
CREATE INDEX idx_trials_conditions ON trials USING GIN(conditions);

COMMENT ON TABLE trials IS 'Clinical trial data from ClinicalTrials.gov';
```

#### `papers` Table

**Purpose**: Store research paper data with proper columns (replaces `market_maps.papers_data` JSONB)

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

CREATE INDEX idx_papers_pmid ON papers(pmid);
CREATE INDEX idx_papers_publication_date ON papers(publication_date);

COMMENT ON TABLE papers IS 'Research papers from PubMed';
```

#### `drugs` Table

**Purpose**: Store drug data with proper columns (replaces `market_maps.drugs_data` JSONB)

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

CREATE INDEX idx_drugs_normalized_name ON drugs(normalized_name);

COMMENT ON TABLE drugs IS 'Pharmaceutical drug data';
```

#### Junction Tables (Many-to-Many Relationships)

**Purpose**: Link projects to trials, papers, and drugs

```sql
-- Project ↔ Trials
CREATE TABLE project_trials (
  project_id BIGINT REFERENCES projects(id) ON DELETE CASCADE,
  trial_id BIGINT REFERENCES trials(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (project_id, trial_id)
);

CREATE INDEX idx_project_trials_project_id ON project_trials(project_id);

-- Project ↔ Papers
CREATE TABLE project_papers (
  project_id BIGINT REFERENCES projects(id) ON DELETE CASCADE,
  paper_id BIGINT REFERENCES papers(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (project_id, paper_id)
);

CREATE INDEX idx_project_papers_project_id ON project_papers(project_id);

-- Project ↔ Drugs
CREATE TABLE project_drugs (
  project_id BIGINT REFERENCES projects(id) ON DELETE CASCADE,
  drug_id BIGINT REFERENCES drugs(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (project_id, drug_id)
);

CREATE INDEX idx_project_drugs_project_id ON project_drugs(project_id);
```

**Benefits of Junction Tables**:
- Deduplication: Trial NCT123 stored once, referenced by multiple projects
- Referential Integrity: Foreign keys prevent orphaned records
- Efficient Queries: Indexed joins for fast lookups
- Scalability: No JSONB array size limits

**Example Queries**:

```typescript
// Get all trials for a project (with proper typing)
const { data: projectTrials } = await supabase
  .from('project_trials')
  .select(`
    added_at,
    trials (*)
  `)
  .eq('project_id', projectId)

// Cross-project analysis: Find all projects with a specific drug
const { data } = await supabase
  .from('project_drugs')
  .select(`
    projects (name, created_at),
    drugs (name, mechanism)
  `)
  .eq('drugs.normalized_name', 'Semaglutide')
```

### 4. Service Layer

**Implementation Files**:
- `src/services/trialService.ts` - CRUD operations for trials
- `src/services/paperService.ts` - CRUD operations for papers
- `src/services/drugService.ts` - CRUD operations for drugs
- `src/services/projectService.ts` - CRUD operations for projects
- `src/services/marketMapService.ts` - Dual-write logic (JSONB + normalized)

**Dual-Write Strategy**:

```typescript
// Example: Saving a market map writes to BOTH schemas
export async function saveMarketMap(data, projectId) {
  // 1. Write to market_maps (JSONB) - backward compatible
  const { data: result } = await supabase
    .from('market_maps')
    .insert({
      ...data,
      trials_data: data.trials,  // JSONB
      papers_data: data.papers   // JSONB
    })
  
  // 2. Write to normalized tables (background, non-blocking)
  if (projectId) {
    backgroundDualWrite(projectId, data)  // Async, batched
  }
  
  return result
}
```

**Read Strategy** (UI reads from normalized, falls back to JSONB):

```typescript
// Load project data - reads from normalized tables first
if (project.id) {
  const [trials, papers] = await Promise.all([
    getProjectTrials(project.id),   // FROM project_trials JOIN trials
    getProjectPapers(project.id)    // FROM project_papers JOIN papers
  ])
  
  // Fallback to JSONB if normalized tables are empty
  if (trials.length === 0 && marketMap.trials_data?.length > 0) {
    trials = marketMap.trials_data  // Use JSONB
  }
}
```

## Row Level Security (RLS)

### Security Model

Supabase uses PostgreSQL's Row Level Security to ensure users can only access their own data.

### RLS Policies

#### Policy: Users can only access their own projects

```sql
-- Enable RLS on the table
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Policy for all operations (SELECT, INSERT, UPDATE, DELETE)
CREATE POLICY "Users can only access their own projects"
  ON projects
  FOR ALL
  USING (auth.uid() = user_id);
```

**How it works**:
- `auth.uid()` returns the currently authenticated user's ID
- Policy ensures `user_id` matches authenticated user
- Applies to all operations: SELECT, INSERT, UPDATE, DELETE
- Unauthenticated requests automatically fail

#### Detailed Policies (Alternative Approach)

For more granular control, you could split into separate policies:

```sql
-- SELECT: Users can view their own projects
CREATE POLICY "Users can view their own projects"
  ON projects
  FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT: Users can create projects for themselves
CREATE POLICY "Users can create their own projects"
  ON projects
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: Users can update their own projects
CREATE POLICY "Users can update their own projects"
  ON projects
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: Users can delete their own projects
CREATE POLICY "Users can delete their own projects"
  ON projects
  FOR DELETE
  USING (auth.uid() = user_id);
```

### Testing RLS Policies

```sql
-- Switch to authenticated user context
SET request.jwt.claims.sub = 'user-uuid-here';

-- Test query (should only return user's projects)
SELECT * FROM projects;

-- Switch to different user
SET request.jwt.claims.sub = 'different-user-uuid';

-- Test query (should return different user's projects)
SELECT * FROM projects;

-- Switch to anonymous (no authentication)
RESET request.jwt.claims.sub;

-- Test query (should return empty - no access)
SELECT * FROM projects;
```

## Database Operations

### CRUD Operations via Supabase Client

#### Create (INSERT)

```typescript
import { supabase } from '@/lib/supabase'

const { data, error } = await supabase
  .from('projects')
  .insert({
    user_id: user.id,  // Must match authenticated user
    name: 'GLP-1 Research Project',
    description: 'Comprehensive analysis of GLP-1 agonists for diabetes treatment',
    search_query: 'GLP-1 agonists diabetes',
    trials_data: trialsArray,
    papers_data: papersArray,
    drugs_data: drugsArray,
    slide_data: slideObject,
    chat_history: []
  })
  .select()
  .single()

if (error) {
  console.error('Insert error:', error)
  throw error
}

console.log('Created project:', data)
```

#### Read (SELECT)

**Get all user's projects**:
```typescript
const { data, error } = await supabase
  .from('projects')
  .select('*')
  .order('created_at', { ascending: false })

// Returns only authenticated user's projects (thanks to RLS)
```

**Get specific project**:
```typescript
const { data, error } = await supabase
  .from('projects')
  .select('*')
  .eq('id', projectId)
  .single()
```

**Get with filtering**:
```typescript
const { data, error } = await supabase
  .from('projects')
  .select('*')
  .ilike('name', '%diabetes%')  // Case-insensitive search
  .order('created_at', { ascending: false })
```

#### Update (UPDATE)

```typescript
const { data, error } = await supabase
  .from('projects')
  .update({
    name: 'Updated Project Name',
    trials_data: updatedTrials,
    drugs_data: updatedDrugs,
    updated_at: new Date().toISOString()
  })
  .eq('id', projectId)
  .select()
  .single()
```

#### Delete (DELETE)

```typescript
const { error } = await supabase
  .from('projects')
  .delete()
  .eq('id', projectId)

if (error) {
  console.error('Delete error:', error)
  throw error
}
```

### Advanced Queries

#### JSONB Queries

**Search within JSONB data**:
```typescript
// Find projects with specific trial NCT ID
const { data, error } = await supabase
  .from('projects')
  .select('*')
  .contains('trials_data', [{ nctId: 'NCT12345678' }])
```

**Extract JSONB field**:
```typescript
// Get only specific fields from JSONB
const { data, error } = await supabase
  .from('projects')
  .select('name, search_query, trials_data->0->nctId')  // First trial's NCT ID
```

**Find projects with specific drug**:
```typescript
// Search in drugs_data for specific drug name
const { data, error } = await supabase
  .from('projects')
  .select('*')
  .contains('drugs_data', [{ normalizedName: 'Semaglutide' }])
```

#### Pagination

```typescript
const pageSize = 10
const page = 0

const { data, error, count } = await supabase
  .from('projects')
  .select('*', { count: 'exact' })
  .order('created_at', { ascending: false })
  .range(page * pageSize, (page + 1) * pageSize - 1)

console.log(`Total: ${count}, Page: ${page + 1}`)
```

#### Date Range Queries

```typescript
// Get projects created in last 30 days
const thirtyDaysAgo = new Date()
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

const { data, error } = await supabase
  .from('projects')
  .select('*')
  .gte('created_at', thirtyDaysAgo.toISOString())
  .order('created_at', { ascending: false })
```

## Data Migrations

### Migration Strategy

When transitioning from `market_maps` to `projects`:
1. Create new `projects` table with updated schema
2. Migrate data from `market_maps` to `projects` (if any exists)
3. Update application code to use `projects` table
4. Drop `market_maps` table after verification

### Initial Schema Setup

**File**: `migrations/001_create_projects_table.sql`

```sql
-- Create projects table
CREATE TABLE projects (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  search_query TEXT NOT NULL,
  trials_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  papers_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  drugs_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  slide_data JSONB DEFAULT NULL,
  chat_history JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_created_at ON projects(created_at DESC);
CREATE INDEX idx_projects_user_date ON projects(user_id, created_at DESC);

-- Enable RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
CREATE POLICY "Users can only access their own projects"
  ON projects
  FOR ALL
  USING (auth.uid() = user_id);

-- Add table comment
COMMENT ON TABLE projects IS 'Core table for research projects containing trials, papers, drugs, and analysis';

-- Create auto-update trigger
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### Running Migrations

Using Supabase CLI:

```bash
# Initialize Supabase locally (if not done)
supabase init

# Create new migration
supabase migration new create_projects_table

# Apply migrations locally
supabase db push

# Apply to remote database
supabase db push --linked
```

### Example Migration: Migrate from market_maps to projects

```sql
-- migrations/002_migrate_to_projects.sql

-- Migrate existing data (if any)
INSERT INTO projects (
  user_id, 
  name, 
  description,
  search_query, 
  trials_data, 
  papers_data, 
  drugs_data,
  slide_data, 
  chat_history,
  created_at, 
  updated_at
)
SELECT 
  user_id,
  name,
  NULL as description,
  query as search_query,
  trials_data,
  COALESCE(papers_data, '[]'::jsonb) as papers_data,
  '[]'::jsonb as drugs_data,
  slide_data,
  COALESCE(chat_history, '[]'::jsonb) as chat_history,
  created_at,
  updated_at
FROM market_maps;

-- Drop old table after verification
-- DROP TABLE market_maps;
```

## Database Functions and Triggers

### Auto-Update Timestamp Trigger

```sql
-- Create function to update timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### Database Function Example: Get User Project Statistics

```sql
-- Create function to get user's project statistics
CREATE OR REPLACE FUNCTION get_user_project_stats(user_uuid UUID)
RETURNS TABLE (
  total_projects INTEGER,
  total_trials INTEGER,
  total_papers INTEGER,
  total_drugs INTEGER,
  most_recent_project_date TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER AS total_projects,
    SUM(jsonb_array_length(trials_data))::INTEGER AS total_trials,
    SUM(jsonb_array_length(papers_data))::INTEGER AS total_papers,
    SUM(jsonb_array_length(drugs_data))::INTEGER AS total_drugs,
    MAX(created_at) AS most_recent_project_date
  FROM projects
  WHERE user_id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Usage
SELECT * FROM get_user_project_stats('user-uuid-here');
```

## Performance Optimization

### Query Performance Tips

1. **Use Indexes**: Ensure queries use appropriate indexes
2. **Limit Results**: Always use pagination for large datasets
3. **Select Specific Fields**: Don't use `SELECT *` when only few fields needed
4. **JSONB Queries**: Use GIN indexes for JSONB field searches
5. **Connection Pooling**: Supabase handles this automatically

### JSONB Performance

**Best Practices**:
- Use GIN indexes for JSONB columns with frequent queries
- Avoid deeply nested JSON structures
- Consider splitting very large JSON into separate tables
- Use specific JSONB operators for targeted queries

**JSONB Operators**:
```sql
-- Contains
WHERE trials_data @> '[{"nctId": "NCT12345678"}]'

-- Exists
WHERE trials_data ? 'nctId'

-- Path extraction
WHERE trials_data->'0'->>'nctId' = 'NCT12345678'
```

### Query Analysis

```sql
-- Analyze query performance
EXPLAIN ANALYZE
SELECT * FROM projects
WHERE user_id = 'user-uuid'
  AND created_at > NOW() - INTERVAL '30 days'
ORDER BY created_at DESC;
```

## Backup and Recovery

### Supabase Automatic Backups

**Point-in-Time Recovery (PITR)**:
- Available on Pro plan and above
- Allows restoration to any point in time
- Configured in Supabase dashboard

### Manual Backups

**Using Supabase CLI**:
```bash
# Export database
supabase db dump > backup.sql

# Export specific table
supabase db dump --table projects > projects_backup.sql

# Import backup
psql $DATABASE_URL < backup.sql
```

**Using pg_dump directly**:
```bash
# Full database backup
pg_dump $DATABASE_URL > full_backup.sql

# Table-specific backup
pg_dump -t projects $DATABASE_URL > projects.sql

# Restore
psql $DATABASE_URL < full_backup.sql
```

### Data Export for Users

**Export user's data (GDPR compliance)**:
```typescript
async function exportUserData(userId: string) {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId)
  
  if (error) throw error
  
  // Convert to JSON and download
  const jsonData = JSON.stringify(data, null, 2)
  const blob = new Blob([jsonData], { type: 'application/json' })
  // ... download logic
}
```

## Security Best Practices

### 1. Row Level Security

**Always enable RLS on tables with user data**
```sql
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
```

### 2. Service Role Key Protection

**Never expose service role key client-side**
```typescript
// WRONG - Service role key exposed
const supabase = createClient(url, SERVICE_ROLE_KEY)  // DON'T DO THIS
```

**Use anon key client-side, service role server-side only**
```typescript
// Correct - Anon key for client
const supabase = createClient(url, ANON_KEY)
```

### 3. Input Validation

```typescript
// Validate project data before insert
function validateProject(data: any) {
  if (!data.name || data.name.length > 255) {
    throw new Error('Invalid name')
  }
  if (data.description && data.description.length > 1000) {
    throw new Error('Description too long')
  }
  if (!data.search_query || data.search_query.length > 1000) {
    throw new Error('Invalid search query')
  }
  if (!Array.isArray(data.trials_data)) {
    throw new Error('trials_data must be an array')
  }
  if (!Array.isArray(data.papers_data)) {
    throw new Error('papers_data must be an array')
  }
  if (!Array.isArray(data.drugs_data)) {
    throw new Error('drugs_data must be an array')
  }
  // ... more validation
}
```

### 4. SQL Injection Prevention

**Supabase client uses parameterized queries**
```typescript
// Safe - parameterized query
const { data } = await supabase
  .from('projects')
  .select('*')
  .eq('name', userInput)  // Automatically escaped
```

**Avoid raw SQL with user input**
```typescript
// DANGEROUS - Don't do this
supabase.rpc('raw_sql', { query: `SELECT * FROM projects WHERE name = '${userInput}'` })
```

## Monitoring and Observability

### Supabase Dashboard

**Key Metrics**:
- Active connections
- Query performance
- Database size
- Table sizes
- Index usage
- Slow queries

**Location**: Supabase Dashboard → Database → Performance

### Query Logging

```typescript
// Log all database operations
const { data, error } = await supabase
  .from('projects')
  .select('*')

console.log('Query result:', { 
  success: !error, 
  rowCount: data?.length,
  error: error?.message 
})
```

### Error Tracking

```typescript
try {
  const { data, error } = await supabase
    .from('projects')
    .insert(newProject)
  
  if (error) {
    // Log to error tracking service (Sentry, etc.)
    console.error('Database error:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint
    })
    throw error
  }
} catch (err) {
  // Handle error
}
```

## Supabase Edge Functions

### extract-pdf-tables Function

**Purpose**: Server-side PDF processing with Deno runtime

**Configuration**: `supabase/config.toml`
```toml
[functions.extract-pdf-tables]
enabled = true
verify_jwt = true
import_map = "./functions/extract-pdf-tables/deno.json"
entrypoint = "./functions/extract-pdf-tables/index.ts"
```

**Function**: `supabase/functions/extract-pdf-tables/index.ts`
- Runs in Deno runtime (not Node.js)
- Handles PDF file uploads
- Calls Vercel Node.js API for actual processing
- Returns extracted table data

**Authentication**:
- `verify_jwt = true`: Requires authenticated user
- Authorization header checked in function

## Future Database Enhancements

### Potential Schema Additions

1. **User Preferences Table**
```sql
CREATE TABLE user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  theme TEXT DEFAULT 'light',
  notification_settings JSONB,
  default_search_filters JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

2. **Shared Projects Table** (for collaboration)
```sql
CREATE TABLE shared_projects (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT REFERENCES projects(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES auth.users(id),
  shared_with_user_id UUID REFERENCES auth.users(id),
  permission TEXT CHECK (permission IN ('view', 'edit')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

3. **Search History Table**
```sql
CREATE TABLE search_history (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  search_query TEXT NOT NULL,
  results_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Normalized Schema Option

For improved query performance and data integrity, consider normalizing the JSONB data:

```sql
-- Separate table for trials
CREATE TABLE project_trials (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT REFERENCES projects(id) ON DELETE CASCADE,
  nct_id TEXT NOT NULL,
  trial_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Separate table for papers
CREATE TABLE project_papers (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT REFERENCES projects(id) ON DELETE CASCADE,
  pmid TEXT NOT NULL,
  paper_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Separate table for drugs
CREATE TABLE project_drugs (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT REFERENCES projects(id) ON DELETE CASCADE,
  normalized_name TEXT NOT NULL,
  drug_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Benefits of Normalization**:
- Better query performance for specific entities
- Easier to implement pagination and filtering
- Improved data integrity and relationships
- More efficient updates to individual trials/papers/drugs

**Trade-offs**:
- More complex queries (requires joins)
- Additional tables to maintain
- Potential for N+1 query issues

### Potential Features

- **Real-time Subscriptions**: Live updates when projects are modified
- **Full-Text Search**: PostgreSQL FTS for searching within saved projects
- **Materialized Views**: Pre-computed statistics and aggregations
- **Partitioning**: Time-based partitioning for large datasets
- **Replication**: Read replicas for improved query performance

## Troubleshooting

### Common Issues

**Issue**: "new row violates row-level security policy"
```
Solution: Ensure user is authenticated and user_id matches auth.uid()
```

**Issue**: "relation does not exist"
```
Solution: 
1. Check table name spelling
2. Verify migrations have been applied
3. Check RLS policies aren't blocking access
```

**Issue**: Slow JSONB queries
```
Solution:
1. Add GIN indexes on JSONB columns
2. Use specific JSONB operators
3. Consider normalizing data into separate tables
```

**Issue**: Connection errors
```
Solution:
1. Verify VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
2. Check network connectivity
3. Verify Supabase project is active
```

### Debug Queries

```typescript
// Enable verbose logging
const { data, error, count } = await supabase
  .from('projects')
  .select('*', { count: 'exact', head: false })
  
console.log('Debug info:', {
  data,
  error,
  count,
  status: error?.code,
  message: error?.message
})
```

## Testing

### Test Database Setup

```bash
# Start local Supabase
supabase start

# Run migrations
supabase db push

# Get local connection URL
supabase status
```

### Integration Tests

```typescript
// Example test with Supabase
describe('ProjectService', () => {
  it('should create a project', async () => {
    const mockData = {
      name: 'Test Project',
      description: 'Test description',
      search_query: 'test query',
      trials_data: [],
      papers_data: [],
      drugs_data: [],
      slide_data: null,
      chat_history: []
    }
    
    const result = await ProjectService.saveProject(mockData)
    
    expect(result).toBeDefined()
    expect(result.name).toBe('Test Project')
    expect(result.search_query).toBe('test query')
  })
})
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

# Database access
psql $DATABASE_URL               # Connect to database
```

### Common Queries

```typescript
// Get all user's projects
supabase.from('projects').select('*')

// Get specific project
supabase.from('projects').select('*').eq('id', projectId).single()

// Create project
supabase.from('projects').insert(data).select().single()

// Update project
supabase.from('projects').update(data).eq('id', projectId)

// Delete project
supabase.from('projects').delete().eq('id', projectId)
```

---

This database documentation provides a comprehensive guide to the proposed project-centric database architecture, schema, operations, and best practices for ABCresearch.

