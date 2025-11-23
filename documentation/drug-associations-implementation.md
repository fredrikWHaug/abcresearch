# Drug-Entity Associations Implementation

**Date**: November 23, 2025  
**Purpose**: Replace text-based matching with proper database relationships for drug groups

## Problem Statement

Previously, when loading an existing project, the system would:
1. Load drugs from `project_drugs` table
2. Load trials and papers separately
3. **Re-derive associations** using text matching (searching for drug names in trial/paper text)

This approach had several issues:
- ❌ Inconsistent results (text matching could fail)
- ❌ No support for press releases or IR decks
- ❌ Performance overhead (scanning all text every time)
- ❌ Lost associations if drug names varied

## Solution: Junction Tables

We implemented proper many-to-many relationships using junction tables:

### New Database Tables

```sql
-- Links drugs to trials within a project
drug_trials (drug_id, trial_id, project_id, added_at)

-- Links drugs to papers within a project  
drug_papers (drug_id, paper_id, project_id, added_at)

-- Links drugs to press releases within a project
drug_press_releases (drug_id, press_release_id, project_id, added_at)

-- Links drugs to IR decks within a project
drug_ir_decks (drug_id, ir_deck_id, project_id, added_at)
```

### New Entity Tables

```sql
-- Stores press release data
press_releases (id, title, summary, company, release_date, url, content, ...)

-- Stores IR deck data
ir_decks (id, title, company, description, url, deck_date, content, ...)
```

## Architecture

### Data Flow - Saving (After Search)

```
User performs search
    ↓
Drug groups created with trials/papers/press releases/IR decks
    ↓
Dashboard.tsx calls saveDrugGroups()
    ↓
drugGroupService.ts processes each drug group:
    1. Upsert drug → get drug_id
    2. Link drug to project
    3. Upsert each trial → get trial_ids
    4. Upsert each paper → get paper_ids
    5. Upsert each press release → get press_release_ids
    6. Upsert each IR deck → get ir_deck_ids
    7. Batch create associations in junction tables
```

### Data Flow - Loading (Project Switch)

```
User switches to project
    ↓
Dashboard.tsx calls loadDrugGroups()
    ↓
drugGroupService.ts:
    1. Get all drugs for project from project_drugs
    2. For each drug:
        a. Get associated entity IDs from junction tables
        b. Fetch actual entities (trials, papers, etc.)
        c. Reconstruct DrugGroup object
    3. Sort by totalResults
    4. Return complete drug groups
```

## New Service: `drugAssociationService.ts`

All drug association functionality is consolidated into a single comprehensive service file:

### Junction Table Operations

```typescript
// Link individual entities to drugs
linkDrugToTrial(drugId, trialId, projectId)
linkDrugToPaper(drugId, paperId, projectId)
linkDrugToPressRelease(drugId, pressReleaseId, projectId)
linkDrugToIRDeck(drugId, irDeckId, projectId)

// Batch operations (more efficient)
batchLinkDrugEntities(drugId, projectId, {
  trialIds, paperIds, pressReleaseIds, irDeckIds
})

// Retrieve associations
getDrugAssociations(drugId, projectId) 
// Returns: { trialIds, paperIds, pressReleaseIds, irDeckIds }
```

### Press Release Operations

```typescript
upsertPressRelease(pressRelease): Promise<number>
getPressReleasesByIds(ids): Promise<PressRelease[]>
```

### IR Deck Operations

```typescript
upsertIRDeck(irDeck): Promise<number>
getIRDecksByIds(ids): Promise<IRDeck[]>
```

### High-Level Drug Group Operations

```typescript
// Save drug groups with all their associations
saveDrugGroups(projectId, drugGroups): Promise<void>

// Load drug groups with all their associations
loadDrugGroups(projectId): Promise<DrugGroup[]>
```

## Dashboard Changes

### Saving Drug Groups (After Search)

**Location**: `Dashboard.tsx` line ~845

```typescript
// After drug groups are created from search results
if (currentProjectId && filteredDrugGroups.length > 0) {
  import('@/services/drugAssociationService').then(({ saveDrugGroups }) => {
    saveDrugGroups(currentProjectId, filteredDrugGroups).catch(error => {
      console.error('[Dashboard] Failed to save drug groups:', error);
    });
  });
}
```

### Loading Drug Groups (Project Switch)

**Location**: `Dashboard.tsx` line ~373

```typescript
// Load drug groups with associations from database
Promise.all([
  import('@/services/trialService').then(({ getProjectTrials }) => 
    getProjectTrials(currentProjectId)),
  import('@/services/paperService').then(({ getProjectPapers }) => 
    getProjectPapers(currentProjectId)),
  import('@/services/drugAssociationService').then(({ loadDrugGroups }) => 
    loadDrugGroups(currentProjectId))  // ← NEW: Load complete drug groups
]).then(([projectTrials, projectPapers, drugGroups]) => {
  setTrials(projectTrials)
  setPapers(projectPapers)
  setDrugGroups(drugGroups)  // ← Already includes all associations
  
  // Extract press releases and IR decks from drug groups
  const allPressReleases = drugGroups.flatMap(dg => dg.pressReleases)
  const allIRDecks = drugGroups.flatMap(dg => dg.irDecks)
  
  setPressReleases(allPressReleases)
  setIRDecks(allIRDecks)
})
```

## Benefits

### ✅ Reliability
- No more text matching failures
- Exact associations are preserved
- Works with drug name variations

### ✅ Performance
- No text scanning on every load
- Efficient indexed queries
- Batch operations for speed

### ✅ Completeness
- Press releases and IR decks now supported
- All entity types treated equally
- No data loss

### ✅ Maintainability
- Clear separation of concerns
- Standard relational database patterns
- Easy to extend (add new entity types)

### ✅ Data Integrity
- Foreign key constraints
- Cascade deletes
- Row-level security (RLS) policies

## Migration Path

### For Existing Data

Existing projects that were created before this implementation will:
1. Still have drugs in `project_drugs` table
2. NOT have associations in junction tables
3. **Fallback behavior**: If no associations found, drug groups will show with 0 results

### Backfilling (Optional)

To backfill existing projects with associations:

```typescript
// Run this for each existing project
import { saveDrugGroups } from '@/services/drugGroupService'

// Re-perform text matching one last time to create associations
const drugGroups = /* recreate drug groups from existing data */
await saveDrugGroups(projectId, drugGroups, trials, papers, pressReleases, irDecks)
```

### Going Forward

All new searches will automatically:
1. Create drug records
2. Create entity records (trials, papers, etc.)
3. Create associations in junction tables
4. Load correctly on project switch

## Database Schema

### Entity Relationship Diagram

```
projects
    ↓ 1:N
project_drugs ←→ drugs
    ↓ N:M           ↓
drug_trials ←→ trials
drug_papers ←→ papers
drug_press_releases ←→ press_releases
drug_ir_decks ←→ ir_decks
```

### Junction Table Structure

All junction tables follow the same pattern:

```sql
CREATE TABLE drug_[entity_type] (
  drug_id INTEGER NOT NULL REFERENCES drugs(id) ON DELETE CASCADE,
  [entity]_id INTEGER NOT NULL REFERENCES [entity_table](id) ON DELETE CASCADE,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (drug_id, [entity]_id, project_id)
);
```

**Key Features:**
- Composite primary key prevents duplicates
- `project_id` scopes associations to specific projects
- CASCADE deletes maintain referential integrity
- Indexed for efficient queries

## Security

### Row Level Security (RLS)

All tables have RLS policies:

```sql
-- Users can only view/insert/delete associations for their own projects
CREATE POLICY "Users can view drug_trials for their projects"
  ON drug_trials FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );
```

### Access Control

- Junction tables: Scoped to user's projects
- Entity tables (press_releases, ir_decks): Public read, authenticated write
- Prevents unauthorized access to other users' data

## Testing

### Manual Testing Checklist

1. **New Search**:
   - [ ] Perform a search with drug results
   - [ ] Verify drugs appear in split view
   - [ ] Check database: `drug_trials`, `drug_papers` tables populated
   - [ ] Switch to another project and back
   - [ ] Verify drug groups load correctly with all associations

2. **Existing Project**:
   - [ ] Load a project created before this implementation
   - [ ] Verify drugs show (may have 0 results)
   - [ ] Perform a new search in that project
   - [ ] Verify new associations are created

3. **Edge Cases**:
   - [ ] Drug with only trials (no papers)
   - [ ] Drug with only papers (no trials)
   - [ ] Drug with press releases and IR decks
   - [ ] Project with no drugs
   - [ ] Project with 50+ drugs (performance test)

## Future Enhancements

### Potential Improvements

1. **Relevance Scores**: Add `relevance_score` column to junction tables to rank associations

2. **Metadata**: Store extraction method (LLM, text search, manual) in junction tables

3. **Audit Trail**: Track when associations were created/modified

4. **Bulk Operations**: Optimize for projects with 100+ drugs

5. **Caching**: Cache drug groups in memory for faster repeated loads

6. **Analytics**: Query across all projects (e.g., "Which drugs appear in most projects?")

## Files Changed

### New Files
- `supabase/migrations/20251123_add_drug_entity_junction_tables.sql` - Database migration for junction tables
- `src/services/drugAssociationService.ts` - Consolidated service for all drug association operations
- `documentation/drug-associations-implementation.md` - This documentation

### Modified Files
- `src/components/Dashboard.tsx`
  - Added `saveDrugGroups()` call after search
  - Replaced text matching with `loadDrugGroups()` on project switch

## Deployment

### Steps

1. **Run Migration**:
   ```bash
   # Apply the migration to create new tables
   supabase db push
   ```

2. **Deploy Code**:
   ```bash
   # Deploy updated services and Dashboard
   git push origin main
   ```

3. **Verify**:
   - Check that new tables exist in Supabase dashboard
   - Perform a test search
   - Verify associations are created
   - Test project switching

### Rollback Plan

If issues arise:

1. **Code Rollback**: Revert Dashboard changes to use text matching
2. **Data Preservation**: Junction tables can remain (won't interfere)
3. **Migration Rollback**: Drop junction tables if needed (data loss!)

## Support

### Common Issues

**Issue**: Drug groups not loading after project switch  
**Solution**: Check browser console for errors. Verify junction tables exist.

**Issue**: Drugs show with 0 results  
**Solution**: This is expected for old projects. Perform a new search to create associations.

**Issue**: Performance slow with many drugs  
**Solution**: Check database indexes. Consider pagination for 100+ drugs.

### Debugging

Enable detailed logging:
```typescript
// In browser console
localStorage.setItem('DEBUG', 'drugGroupService,drugAssociationService')
```

Check database directly:
```sql
-- See all associations for a drug
SELECT * FROM drug_trials WHERE drug_id = 123 AND project_id = 456;

-- Count associations per drug
SELECT d.name, 
  COUNT(DISTINCT dt.trial_id) as trials,
  COUNT(DISTINCT dp.paper_id) as papers
FROM drugs d
LEFT JOIN drug_trials dt ON d.id = dt.drug_id
LEFT JOIN drug_papers dp ON d.id = dp.drug_id
WHERE dt.project_id = 456 OR dp.project_id = 456
GROUP BY d.name;
```

## Conclusion

This implementation replaces unreliable text matching with proper database relationships, ensuring drug groups and their associations are preserved accurately across project switches. The solution is scalable, maintainable, and follows database best practices.

