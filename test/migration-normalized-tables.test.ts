/**
 * Integration test for JSONB to normalized tables migration
 * 
 * **IMPORTANT**: This test requires an authenticated Supabase session.
 * 
 * Setup:
 * 1. Set environment variables in .env:
 *    VITE_SUPABASE_URL=your_supabase_url
 *    VITE_SUPABASE_ANON_KEY=your_anon_key
 * 2. Run app and sign in: npm run dev
 * 3. Run test in same terminal session
 * 
 * Alternative: Use service role key to bypass RLS (for CI/CD)
 * 
 * Tests:
 * 1. Migration script execution
 * 2. Data integrity (no data loss)
 * 3. Deduplication (same NCT ID/PMID -> single row)
 * 4. Junction table relationships
 * 5. Dual-write functionality
 * 
 * Run: npm test test/migration-normalized-tables.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { supabase } from '../src/lib/supabase'
import { migrateToNormalizedTables } from '../src/scripts/migrateToNormalizedTables'
import { upsertTrial, linkTrialToProject, getProjectTrials } from '../src/services/trialService'
import { upsertPaper, linkPaperToProject, getProjectPapers } from '../src/services/paperService'
import type { ClinicalTrial } from '../src/types/trials'
import type { PubMedArticle } from '../src/types/papers'

describe('Migration to Normalized Tables', () => {
  let testProjectId: number
  let testMarketMapId: number
  let testUserId: string
  
  const mockTrial: ClinicalTrial = {
    nctId: 'NCT99999999',
    briefTitle: 'Test Trial for Migration',
    officialTitle: 'Official Test Trial Title',
    overallStatus: 'Recruiting',
    phase: ['Phase 2'],
    conditions: ['Test Condition'],
    interventions: ['Test Drug'],
    sponsors: { lead: 'Test Sponsor' },
    enrollment: 100,
    startDate: '2024-01-01',
    completionDate: '2025-12-31',
    locations: [{ facility: 'Test Hospital', city: 'Boston', state: 'MA', country: 'USA' }],
    studyType: 'Interventional'
  }
  
  const mockPaper: PubMedArticle = {
    pmid: '99999999',
    title: 'Test Paper for Migration',
    abstract: 'This is a test paper abstract',
    journal: 'Test Journal',
    publicationDate: '2024-01-15',
    authors: ['Test Author'],
    doi: '10.1234/test.2024.001',
    nctNumber: 'NCT99999999',
    relevanceScore: 95,
    fullTextLinks: []
  }

  beforeAll(async () => {
    console.log('\n=== Setting up test environment ===')
    
    // Get current authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      console.warn('\n⚠️  SKIPPING TEST: No authenticated user found')
      console.warn('To run this test:')
      console.warn('1. Start dev server: npm run dev')
      console.warn('2. Sign in to the app')
      console.warn('3. Run test in same session')
      console.warn('OR use Supabase service role key in .env.test\n')
      return
    }
    
    testUserId = user.id
    console.log(`Authenticated as user: ${testUserId}`)
    
    // Create a test project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        name: 'Migration Test Project',
        description: 'Test project for migration',
        user_id: testUserId
      })
      .select()
      .single()
    
    if (projectError) throw new Error(`Failed to create test project: ${projectError.message}`)
    testProjectId = project.id
    console.log(`Created test project: ${testProjectId}`)
    
    // Create a test market_map with JSONB data
    const { data: marketMap, error: mapError } = await supabase
      .from('market_maps')
      .insert({
        name: 'Migration Test Map',
        query: 'test',
        project_id: testProjectId,
        trials_data: [mockTrial],
        papers_data: [mockPaper],
        slide_data: null
      })
      .select()
      .single()
    
    if (mapError) throw new Error(`Failed to create test market map: ${mapError.message}`)
    testMarketMapId = marketMap.id
    console.log(`Created test market map: ${testMarketMapId}`)
  })

  afterAll(async () => {
    console.log('\n=== Cleaning up test data ===')
    
    // Clean up in correct order (respect foreign keys)
    if (testMarketMapId) {
      await supabase.from('market_maps').delete().eq('id', testMarketMapId)
      console.log(`Deleted test market map: ${testMarketMapId}`)
    }
    
    if (testProjectId) {
      // Delete junction table entries first
      await supabase.from('project_trials').delete().eq('project_id', testProjectId)
      await supabase.from('project_papers').delete().eq('project_id', testProjectId)
      
      // Delete test project (cascades to related data)
      await supabase.from('projects').delete().eq('id', testProjectId)
      console.log(`Deleted test project: ${testProjectId}`)
    }
    
    // Clean up test trial and paper from normalized tables
    await supabase.from('trials').delete().eq('nct_id', mockTrial.nctId)
    await supabase.from('papers').delete().eq('pmid', mockPaper.pmid)
    console.log('Cleaned up test trials and papers')
  })

  it('should migrate JSONB data to normalized tables', async () => {
    if (!testUserId) {
      console.log('⏭️  Skipping - no auth')
      return
    }
    
    console.log('\n--- Test: Migration Execution ---')
    
    const result = await migrateToNormalizedTables()
    
    expect(result.success).toBe(true)
    expect(result.migrated).toBeGreaterThan(0)
    console.log(`✅ Migrated ${result.trials} trials and ${result.papers} papers`)
  })

  it('should create trial records in normalized table', async () => {
    console.log('\n--- Test: Trial Records ---')
    
    const { data: trials, error } = await supabase
      .from('trials')
      .select('*')
      .eq('nct_id', mockTrial.nctId)
    
    expect(error).toBeNull()
    expect(trials).toBeDefined()
    expect(trials?.length).toBe(1)
    
    const trial = trials![0]
    expect(trial.brief_title).toBe(mockTrial.briefTitle)
    expect(trial.overall_status).toBe(mockTrial.overallStatus)
    console.log(`✅ Trial ${mockTrial.nctId} found in normalized table`)
  })

  it('should create paper records in normalized table', async () => {
    console.log('\n--- Test: Paper Records ---')
    
    const { data: papers, error } = await supabase
      .from('papers')
      .select('*')
      .eq('pmid', mockPaper.pmid)
    
    expect(error).toBeNull()
    expect(papers).toBeDefined()
    expect(papers?.length).toBe(1)
    
    const paper = papers![0]
    expect(paper.title).toBe(mockPaper.title)
    expect(paper.journal).toBe(mockPaper.journal)
    console.log(`✅ Paper ${mockPaper.pmid} found in normalized table`)
  })

  it('should create project-trial junction entries', async () => {
    console.log('\n--- Test: Project-Trial Junction ---')
    
    const { data: links, error } = await supabase
      .from('project_trials')
      .select('*')
      .eq('project_id', testProjectId)
    
    expect(error).toBeNull()
    expect(links).toBeDefined()
    expect(links!.length).toBeGreaterThan(0)
    console.log(`✅ Found ${links!.length} project-trial links`)
  })

  it('should create project-paper junction entries', async () => {
    console.log('\n--- Test: Project-Paper Junction ---')
    
    const { data: links, error } = await supabase
      .from('project_papers')
      .select('*')
      .eq('project_id', testProjectId)
    
    expect(error).toBeNull()
    expect(links).toBeDefined()
    expect(links!.length).toBeGreaterThan(0)
    console.log(`✅ Found ${links!.length} project-paper links`)
  })

  it('should handle duplicate entries (idempotency)', async () => {
    console.log('\n--- Test: Idempotency ---')
    
    // Run migration again
    const result = await migrateToNormalizedTables()
    
    expect(result.success).toBe(true)
    
    // Should still have only 1 trial with this NCT ID
    const { data: trials } = await supabase
      .from('trials')
      .select('*')
      .eq('nct_id', mockTrial.nctId)
    
    expect(trials?.length).toBe(1)
    console.log(`✅ No duplicate trials created - still only 1 record`)
  })

  it('should retrieve trials via service layer', async () => {
    console.log('\n--- Test: Service Layer (Trials) ---')
    
    const trials = await getProjectTrials(testProjectId)
    
    expect(trials).toBeDefined()
    expect(Array.isArray(trials)).toBe(true)
    expect(trials.length).toBeGreaterThan(0)
    
    const testTrial = trials.find(t => t.nctId === mockTrial.nctId)
    expect(testTrial).toBeDefined()
    expect(testTrial?.briefTitle).toBe(mockTrial.briefTitle)
    console.log(`✅ Service layer retrieved ${trials.length} trials`)
  })

  it('should retrieve papers via service layer', async () => {
    console.log('\n--- Test: Service Layer (Papers) ---')
    
    const papers = await getProjectPapers(testProjectId)
    
    expect(papers).toBeDefined()
    expect(Array.isArray(papers)).toBe(true)
    expect(papers.length).toBeGreaterThan(0)
    
    const testPaper = papers.find(p => p.pmid === mockPaper.pmid)
    expect(testPaper).toBeDefined()
    expect(testPaper?.title).toBe(mockPaper.title)
    console.log(`✅ Service layer retrieved ${papers.length} papers`)
  })

  it('should support dual-write (upsert new trial)', async () => {
    console.log('\n--- Test: Dual-Write (New Trial) ---')
    
    const newTrial: ClinicalTrial = {
      ...mockTrial,
      nctId: 'NCT88888888',
      briefTitle: 'Another Test Trial'
    }
    
    const trialId = await upsertTrial(newTrial)
    expect(trialId).toBeDefined()
    
    await linkTrialToProject(testProjectId, trialId)
    
    const { data: trial } = await supabase
      .from('trials')
      .select('*')
      .eq('nct_id', newTrial.nctId)
      .single()
    
    expect(trial).toBeDefined()
    expect(trial.brief_title).toBe(newTrial.briefTitle)
    console.log(`✅ Dual-write created trial ${newTrial.nctId}`)
    
    // Cleanup
    await supabase.from('trials').delete().eq('nct_id', newTrial.nctId)
  })

  it('should support dual-write (upsert new paper)', async () => {
    console.log('\n--- Test: Dual-Write (New Paper) ---')
    
    const newPaper: PubMedArticle = {
      ...mockPaper,
      pmid: '88888888',
      title: 'Another Test Paper'
    }
    
    const paperId = await upsertPaper(newPaper)
    expect(paperId).toBeDefined()
    
    await linkPaperToProject(testProjectId, paperId)
    
    const { data: paper } = await supabase
      .from('papers')
      .select('*')
      .eq('pmid', newPaper.pmid)
      .single()
    
    expect(paper).toBeDefined()
    expect(paper.title).toBe(newPaper.title)
    console.log(`✅ Dual-write created paper ${newPaper.pmid}`)
    
    // Cleanup
    await supabase.from('papers').delete().eq('pmid', newPaper.pmid)
  })
})

