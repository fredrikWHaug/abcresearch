LATEST UPDATE: 10/17/25, 11:45AM

# ABCresearch - Database Documentation

## Database Architecture Overview

ABCresearch uses **Supabase** as its backend database and authentication platform. Supabase is built on top of PostgreSQL, providing a modern, scalable, and developer-friendly database solution with built-in authentication, real-time subscriptions, and RESTful APIs.

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

## Database Schema

### Entity Relationship Diagram

```
┌─────────────────┐           ┌─────────────────┐
│   auth.users    │◄──────────│  market_maps    │
│  (Supabase      │   1:N     │                 │
│   Managed)      │           │                 │
└─────────────────┘           └─────────────────┘
     (PK) id                       user_id (FK)
     email                         name
     encrypted_password            query
     created_at                    trials_data (JSONB)
     updated_at                    slide_data (JSONB)
                                  chat_history (JSONB)
                                  papers_data (JSONB)
                                  created_at
                                  updated_at
```

## Tables

### 1. `market_maps` Table

**Purpose**: Stores saved research projects (market maps) with complete session data

#### Schema Definition

```sql
CREATE TABLE market_maps (
  -- Primary Key
  id BIGSERIAL PRIMARY KEY,
  
  -- Foreign Key to auth.users
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Basic Information
  name TEXT NOT NULL,
  query TEXT NOT NULL,
  
  -- Large JSON Data
  trials_data JSONB NOT NULL,
  slide_data JSONB NOT NULL,
  chat_history JSONB DEFAULT NULL,
  papers_data JSONB DEFAULT NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Comments
COMMENT ON TABLE market_maps IS 'Stores saved research projects with clinical trials, papers, and analysis data';
COMMENT ON COLUMN market_maps.trials_data IS 'Array of clinical trial objects from ClinicalTrials.gov';
COMMENT ON COLUMN market_maps.slide_data IS 'AI-generated market analysis and insights';
COMMENT ON COLUMN market_maps.chat_history IS 'Conversational history between user and AI';
COMMENT ON COLUMN market_maps.papers_data IS 'Array of research papers from PubMed';
```

#### Column Details

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | BIGSERIAL | PRIMARY KEY | Auto-incrementing unique identifier |
| `user_id` | UUID | NOT NULL, FK | References auth.users(id), owner of the project |
| `name` | TEXT | NOT NULL | User-defined project name |
| `query` | TEXT | NOT NULL | Original search query that generated results |
| `trials_data` | JSONB | NOT NULL | Complete array of ClinicalTrial objects |
| `slide_data` | JSONB | NOT NULL | Generated market analysis slide data |
| `chat_history` | JSONB | NULL | Array of chat messages (user and system) |
| `papers_data` | JSONB | NULL | Array of PubMedArticle objects |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Record creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last update timestamp |

#### JSONB Data Structures

**trials_data** structure:
```typescript
{
  trials: ClinicalTrial[] = [
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
}
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

**chat_history** structure:
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

**papers_data** structure:
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

#### Indexes

```sql
-- Index on user_id for fast lookups by user
CREATE INDEX idx_market_maps_user_id ON market_maps(user_id);

-- Index on created_at for sorting by date (descending)
CREATE INDEX idx_market_maps_created_at ON market_maps(created_at DESC);

-- Composite index for user + date queries
CREATE INDEX idx_market_maps_user_date ON market_maps(user_id, created_at DESC);

-- GIN index on JSONB columns for fast JSON queries (optional)
CREATE INDEX idx_market_maps_trials_data_gin ON market_maps USING GIN (trials_data);
CREATE INDEX idx_market_maps_papers_data_gin ON market_maps USING GIN (papers_data);
```

**Index Usage**:
- `idx_market_maps_user_id`: Fast user-specific queries
- `idx_market_maps_created_at`: Sorting by date
- `idx_market_maps_user_date`: Combined user + date filtering
- GIN indexes: Fast JSONB field searches (if needed)

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

## Row Level Security (RLS)

### Security Model

Supabase uses PostgreSQL's Row Level Security to ensure users can only access their own data.

### RLS Policies

#### Policy: Users can only access their own market maps

```sql
-- Enable RLS on the table
ALTER TABLE market_maps ENABLE ROW LEVEL SECURITY;

-- Policy for all operations (SELECT, INSERT, UPDATE, DELETE)
CREATE POLICY "Users can only access their own market maps"
  ON market_maps
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
-- SELECT: Users can view their own maps
CREATE POLICY "Users can view their own market maps"
  ON market_maps
  FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT: Users can create maps for themselves
CREATE POLICY "Users can create their own market maps"
  ON market_maps
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: Users can update their own maps
CREATE POLICY "Users can update their own market maps"
  ON market_maps
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: Users can delete their own maps
CREATE POLICY "Users can delete their own market maps"
  ON market_maps
  FOR DELETE
  USING (auth.uid() = user_id);
```

### Testing RLS Policies

```sql
-- Switch to authenticated user context
SET request.jwt.claims.sub = 'user-uuid-here';

-- Test query (should only return user's maps)
SELECT * FROM market_maps;

-- Switch to different user
SET request.jwt.claims.sub = 'different-user-uuid';

-- Test query (should return different user's maps)
SELECT * FROM market_maps;

-- Switch to anonymous (no authentication)
RESET request.jwt.claims.sub;

-- Test query (should return empty - no access)
SELECT * FROM market_maps;
```

## Database Operations

### CRUD Operations via Supabase Client

#### Create (INSERT)

```typescript
import { supabase } from '@/lib/supabase'

const { data, error } = await supabase
  .from('market_maps')
  .insert({
    user_id: user.id,  // Automatically set by RLS policy
    name: 'My Market Map',
    query: 'GLP-1 agonists for diabetes',
    trials_data: trialsArray,
    slide_data: slideObject,
    chat_history: chatArray,
    papers_data: papersArray
  })
  .select()
  .single()

if (error) {
  console.error('Insert error:', error)
  throw error
}

console.log('Created:', data)
```

#### Read (SELECT)

**Get all user's maps**:
```typescript
const { data, error } = await supabase
  .from('market_maps')
  .select('*')
  .order('created_at', { ascending: false })

// Returns only authenticated user's maps (thanks to RLS)
```

**Get specific map**:
```typescript
const { data, error } = await supabase
  .from('market_maps')
  .select('*')
  .eq('id', mapId)
  .single()
```

**Get with filtering**:
```typescript
const { data, error } = await supabase
  .from('market_maps')
  .select('*')
  .ilike('name', '%diabetes%')  // Case-insensitive search
  .order('created_at', { ascending: false })
```

#### Update (UPDATE)

```typescript
const { data, error } = await supabase
  .from('market_maps')
  .update({
    name: 'Updated Name',
    trials_data: updatedTrials,
    updated_at: new Date().toISOString()
  })
  .eq('id', mapId)
  .select()
  .single()
```

#### Delete (DELETE)

```typescript
const { error } = await supabase
  .from('market_maps')
  .delete()
  .eq('id', mapId)

if (error) {
  console.error('Delete error:', error)
  throw error
}
```

### Advanced Queries

#### JSONB Queries

**Search within JSONB data**:
```typescript
// Find maps with specific trial NCT ID
const { data, error } = await supabase
  .from('market_maps')
  .select('*')
  .contains('trials_data', [{ nctId: 'NCT12345678' }])
```

**Extract JSONB field**:
```typescript
// Get only specific fields from JSONB
const { data, error } = await supabase
  .from('market_maps')
  .select('name, query, trials_data->0->nctId')  // First trial's NCT ID
```

#### Pagination

```typescript
const pageSize = 10
const page = 0

const { data, error, count } = await supabase
  .from('market_maps')
  .select('*', { count: 'exact' })
  .order('created_at', { ascending: false })
  .range(page * pageSize, (page + 1) * pageSize - 1)

console.log(`Total: ${count}, Page: ${page + 1}`)
```

#### Date Range Queries

```typescript
// Get maps created in last 30 days
const thirtyDaysAgo = new Date()
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

const { data, error } = await supabase
  .from('market_maps')
  .select('*')
  .gte('created_at', thirtyDaysAgo.toISOString())
  .order('created_at', { ascending: false })
```

## Data Migrations

### Initial Schema Setup

**File**: `migrations/001_initial_schema.sql` (example)

```sql
-- Create market_maps table
CREATE TABLE market_maps (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  query TEXT NOT NULL,
  trials_data JSONB NOT NULL,
  slide_data JSONB NOT NULL,
  chat_history JSONB,
  papers_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_market_maps_user_id ON market_maps(user_id);
CREATE INDEX idx_market_maps_created_at ON market_maps(created_at DESC);

-- Enable RLS
ALTER TABLE market_maps ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
CREATE POLICY "Users can only access their own market maps"
  ON market_maps
  FOR ALL
  USING (auth.uid() = user_id);

-- Add comments
COMMENT ON TABLE market_maps IS 'Stores saved research projects with clinical trials, papers, and analysis data';
```

### Running Migrations

Using Supabase CLI:

```bash
# Initialize Supabase locally (if not done)
supabase init

# Create new migration
supabase migration new add_market_maps_table

# Apply migrations
supabase db push

# Or apply to remote database
supabase db push --linked
```

### Example Migration: Add New Column

```sql
-- migrations/002_add_metadata_column.sql

-- Add new column
ALTER TABLE market_maps 
ADD COLUMN metadata JSONB DEFAULT '{}';

-- Add comment
COMMENT ON COLUMN market_maps.metadata IS 'Additional metadata for the market map';

-- Create index if needed
CREATE INDEX idx_market_maps_metadata_gin ON market_maps USING GIN (metadata);
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
CREATE TRIGGER update_market_maps_updated_at
  BEFORE UPDATE ON market_maps
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### Database Function Example: Get User Statistics

```sql
-- Create function to get user's market map statistics
CREATE OR REPLACE FUNCTION get_user_market_map_stats(user_uuid UUID)
RETURNS TABLE (
  total_maps INTEGER,
  total_trials INTEGER,
  total_papers INTEGER,
  most_recent_map_date TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER AS total_maps,
    SUM(jsonb_array_length(trials_data))::INTEGER AS total_trials,
    SUM(COALESCE(jsonb_array_length(papers_data), 0))::INTEGER AS total_papers,
    MAX(created_at) AS most_recent_map_date
  FROM market_maps
  WHERE user_id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Usage
SELECT * FROM get_user_market_map_stats('user-uuid-here');
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
SELECT * FROM market_maps
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
supabase db dump --table market_maps > market_maps_backup.sql

# Import backup
psql $DATABASE_URL < backup.sql
```

**Using pg_dump directly**:
```bash
# Full database backup
pg_dump $DATABASE_URL > full_backup.sql

# Table-specific backup
pg_dump -t market_maps $DATABASE_URL > market_maps.sql

# Restore
psql $DATABASE_URL < full_backup.sql
```

### Data Export for Users

**Export user's data (GDPR compliance)**:
```typescript
async function exportUserData(userId: string) {
  const { data, error } = await supabase
    .from('market_maps')
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

✅ **Always enable RLS on tables with user data**
```sql
ALTER TABLE market_maps ENABLE ROW LEVEL SECURITY;
```

### 2. Service Role Key Protection

❌ **Never expose service role key client-side**
```typescript
// WRONG - Service role key exposed
const supabase = createClient(url, SERVICE_ROLE_KEY)  // DON'T DO THIS
```

✅ **Use anon key client-side, service role server-side only**
```typescript
// Correct - Anon key for client
const supabase = createClient(url, ANON_KEY)
```

### 3. Input Validation

```typescript
// Validate data before insert
function validateMarketMap(data: any) {
  if (!data.name || data.name.length > 255) {
    throw new Error('Invalid name')
  }
  if (!data.query || data.query.length > 1000) {
    throw new Error('Invalid query')
  }
  if (!Array.isArray(data.trials_data)) {
    throw new Error('trials_data must be an array')
  }
  // ... more validation
}
```

### 4. SQL Injection Prevention

✅ **Supabase client uses parameterized queries**
```typescript
// Safe - parameterized query
const { data } = await supabase
  .from('market_maps')
  .select('*')
  .eq('name', userInput)  // Automatically escaped
```

❌ **Avoid raw SQL with user input**
```typescript
// DANGEROUS - Don't do this
supabase.rpc('raw_sql', { query: `SELECT * FROM market_maps WHERE name = '${userInput}'` })
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
  .from('market_maps')
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
    .from('market_maps')
    .insert(newMap)
  
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

2. **Shared Maps Table** (for collaboration)
```sql
CREATE TABLE shared_maps (
  id BIGSERIAL PRIMARY KEY,
  map_id BIGINT REFERENCES market_maps(id) ON DELETE CASCADE,
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
  query TEXT NOT NULL,
  results_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

4. **Notifications Table**
```sql
CREATE TABLE notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Potential Features

- **Real-time Subscriptions**: Live updates when maps are modified
- **Full-Text Search**: PostgreSQL FTS for searching within saved maps
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
  .from('market_maps')
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
describe('MarketMapService', () => {
  it('should create a market map', async () => {
    const mockData = {
      name: 'Test Map',
      query: 'test query',
      trials_data: [],
      slide_data: {},
      chat_history: [],
      papers_data: []
    }
    
    const result = await MarketMapService.saveMarketMap(mockData)
    
    expect(result).toBeDefined()
    expect(result.name).toBe('Test Map')
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
// Get all user's maps
supabase.from('market_maps').select('*')

// Get specific map
supabase.from('market_maps').select('*').eq('id', mapId).single()

// Create map
supabase.from('market_maps').insert(data).select().single()

// Update map
supabase.from('market_maps').update(data).eq('id', mapId)

// Delete map
supabase.from('market_maps').delete().eq('id', mapId)
```

---

This database documentation provides a comprehensive guide to the database architecture, schema, operations, and best practices for ABCresearch.

