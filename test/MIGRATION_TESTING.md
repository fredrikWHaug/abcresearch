# Migration Testing Guide

## Automated Testing

**NOTE**: Automated tests require an authenticated Supabase session due to Row Level Security (RLS) policies.

### Quick Test (Manual Browser - Recommended)

The easiest way to test is using the browser console (see section below).

### Automated Test Suite (Advanced)

Requires authenticated session:

```bash
npm run test:run test/migration-normalized-tables.test.ts
```

**Setup for automated tests:**
1. Have valid Supabase credentials in `.env`
2. Must be authenticated (tests will skip if not)
3. Or use service role key for CI/CD

**What it tests:**
- Migration script execution
- Data integrity (no data loss)
- Deduplication (same NCT ID/PMID creates single row)
- Junction table relationships
- Service layer retrieval
- Dual-write functionality
- Idempotency (can run multiple times safely)

**Expected output:**
```
✅ Migrated X trials and Y papers
✅ Trial NCT99999999 found in normalized table
✅ Paper 99999999 found in normalized table
✅ Found N project-trial links
✅ Found N project-paper links
✅ No duplicate trials created - still only 1 record
✅ Service layer retrieved N trials
✅ Service layer retrieved N papers
✅ Dual-write created trial NCT88888888
✅ Dual-write created paper 88888888
```

---

## Manual Testing (Browser Console)

### 1. Start Dev Server

```bash
npm run dev
# Access at localhost:5173
```

### 2. Open Browser Console

Press `F12` or `Cmd+Option+I`

You'll see:
```
[Migration Utility] Available commands:
  - window.runMigration() - Run migration from JSONB to normalized tables
  - window.supabase - Direct Supabase client for manual queries
```

### 3. Check Existing Data

```javascript
// Check market_maps with JSONB data
const { data } = await window.supabase
  .from('market_maps')
  .select('id, project_id, trials_data, papers_data')
  .limit(5)
console.table(data)
```

### 4. Run Migration

```javascript
await window.runMigration()
```

Watch console for:
- Number of market maps processed
- Trials and papers migrated
- Any errors encountered

### 5. Verify Normalized Tables

```javascript
// Check trials table
const { data: trials } = await window.supabase
  .from('trials')
  .select('*')
  .limit(5)
console.log('Trials:', trials.length)
console.table(trials)

// Check project_trials junction
const { data: pt } = await window.supabase
  .from('project_trials')
  .select('*')
  .limit(5)
console.log('Project-trial links:', pt.length)

// Check papers table
const { data: papers } = await window.supabase
  .from('papers')
  .select('*')
  .limit(5)
console.log('Papers:', papers.length)
console.table(papers)

// Check project_papers junction
const { data: pp } = await window.supabase
  .from('project_papers')
  .select('*')
  .limit(5)
console.log('Project-paper links:', pp.length)
```

### 6. Test UI Loading

1. Click "Saved Maps" in the UI
2. Load an existing map
3. Watch console for:
   ```
   [Dashboard] Fetching from normalized tables for project: X
   [Dashboard] Loaded from normalized tables: { trials: Y, papers: Z }
   ```

### 7. Test Dual-Write on New Save

1. Perform a search (e.g., "GLP-1 trials")
2. Save the map
3. Watch console for background dual-write logs
4. Verify both JSONB and normalized tables updated:

```javascript
// Check JSONB (legacy)
const { data: map } = await window.supabase
  .from('market_maps')
  .select('trials_data, papers_data')
  .order('created_at', { ascending: false })
  .limit(1)
  .single()
console.log('JSONB trials:', map.trials_data.length)
console.log('JSONB papers:', map.papers_data.length)

// Check normalized tables (should match)
const projectId = map.project_id
const { data: normalizedTrials } = await window.supabase
  .from('project_trials')
  .select('*')
  .eq('project_id', projectId)
console.log('Normalized trials:', normalizedTrials.length)
```

---

## Expected Results

### Migration Success
- No errors in console
- `result.success === true`
- `result.migrated > 0`
- All trials/papers from JSONB appear in normalized tables

### Data Integrity
- No data loss: count matches
- Deduplication works: same NCT ID → single row
- Junction tables link correctly: project_id ↔ trial_id/paper_id

### UI Integration
- Loading maps uses normalized tables first
- Fallback to JSONB if normalized empty (race condition during background write)
- New saves write to both JSONB and normalized tables

### Performance
- Background dual-write doesn't block UI
- Batch processing (10 items at a time) prevents freezing
- Console logs show progress without spam

---

## Troubleshooting

### Issue: "Cannot read property 'runMigration' of undefined"
**Solution**: Refresh the page - migration utility loads on app start

### Issue: Migration reports 0 migrated items
**Solution**: Check if market_maps have `project_id` set - migration only processes maps with projects

### Issue: Normalized tables empty after migration
**Solution**: 
1. Check console for errors during migration
2. Verify RLS policies allow read access
3. Check if data exists in market_maps: `window.supabase.from('market_maps').select('trials_data')`

### Issue: UI still loading from JSONB
**Solution**: This is expected during background dual-write. Wait 30s for async process to complete, then reload map.

---

## Performance Metrics

Expected performance (depends on data volume):

- **Small dataset** (< 100 items): < 10 seconds
- **Medium dataset** (100-1000 items): 30-60 seconds  
- **Large dataset** (> 1000 items): 1-5 minutes

Batch processing: 10 items at a time in parallel

