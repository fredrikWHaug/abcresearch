/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
/**
 * Drug Association Service
 * Comprehensive service for managing drug-entity relationships and drug groups
 * 
 * This service handles:
 * - Junction table relationships (drug-trial, drug-paper, drug-press release, drug-IR deck)
 * - Press release and IR deck entity management
 * - Complete drug group save/load operations
 */

import { supabase } from '@/lib/supabase'
import type { DrugGroup } from './drugGroupingService'
import type { ClinicalTrial } from '@/types/trials'
import type { PubMedArticle } from '@/types/papers'
import type { PressRelease } from '@/types/press-releases'
import type { IRDeck } from '@/types/ir-decks'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface NormalizedPressRelease {
  id: number
  title: string
  summary?: string
  company?: string
  release_date?: string
  url?: string
  content?: string
  created_at: string
  updated_at: string
}

export interface NormalizedIRDeck {
  id: number
  title: string
  company?: string
  description?: string
  url?: string
  deck_date?: string
  content?: string
  created_at: string
  updated_at: string
}

// ============================================================================
// JUNCTION TABLE OPERATIONS (Drug-Entity Links)
// ============================================================================

/**
 * Link a drug to a trial within a project
 */
export async function linkDrugToTrial(
  drugId: number,
  trialId: number,
  projectId: number
): Promise<void> {
  console.log('[DrugAssociationService] Linking drug to trial:', { drugId, trialId, projectId })

  const { error } = await supabase
    .from('drug_trials')
    .upsert(
      {
        drug_id: drugId,
        trial_id: trialId,
        project_id: projectId,
      },
      { onConflict: 'drug_id,trial_id,project_id' }
    )

  if (error) {
    console.error('[DrugAssociationService] Error linking drug to trial:', error)
    throw error
  }

  console.log('[DrugAssociationService] Drug-trial link created successfully')
}

/**
 * Link a drug to a paper within a project
 */
export async function linkDrugToPaper(
  drugId: number,
  paperId: number,
  projectId: number
): Promise<void> {
  console.log('[DrugAssociationService] Linking drug to paper:', { drugId, paperId, projectId })

  const { error } = await supabase
    .from('drug_papers')
    .upsert(
      {
        drug_id: drugId,
        paper_id: paperId,
        project_id: projectId,
      },
      { onConflict: 'drug_id,paper_id,project_id' }
    )

  if (error) {
    console.error('[DrugAssociationService] Error linking drug to paper:', error)
    throw error
  }

  console.log('[DrugAssociationService] Drug-paper link created successfully')
}

/**
 * Link a drug to a press release within a project
 */
export async function linkDrugToPressRelease(
  drugId: number,
  pressReleaseId: number,
  projectId: number
): Promise<void> {
  console.log('[DrugAssociationService] Linking drug to press release:', { drugId, pressReleaseId, projectId })

  const { error } = await supabase
    .from('drug_press_releases')
    .upsert(
      {
        drug_id: drugId,
        press_release_id: pressReleaseId,
        project_id: projectId,
      },
      { onConflict: 'drug_id,press_release_id,project_id' }
    )

  if (error) {
    console.error('[DrugAssociationService] Error linking drug to press release:', error)
    throw error
  }

  console.log('[DrugAssociationService] Drug-press release link created successfully')
}

/**
 * Link a drug to an IR deck within a project
 */
export async function linkDrugToIRDeck(
  drugId: number,
  irDeckId: number,
  projectId: number
): Promise<void> {
  console.log('[DrugAssociationService] Linking drug to IR deck:', { drugId, irDeckId, projectId })

  const { error } = await supabase
    .from('drug_ir_decks')
    .upsert(
      {
        drug_id: drugId,
        ir_deck_id: irDeckId,
        project_id: projectId,
      },
      { onConflict: 'drug_id,ir_deck_id,project_id' }
    )

  if (error) {
    console.error('[DrugAssociationService] Error linking drug to IR deck:', error)
    throw error
  }

  console.log('[DrugAssociationService] Drug-IR deck link created successfully')
}

/**
 * Batch link multiple entities to a drug
 * This is more efficient than calling individual link functions
 */
export async function batchLinkDrugEntities(
  drugId: number,
  projectId: number,
  entities: {
    trialIds?: number[]
    paperIds?: number[]
    pressReleaseIds?: number[]
    irDeckIds?: number[]
  }
): Promise<void> {
  console.log('[DrugAssociationService] Batch linking entities to drug:', { drugId, projectId, entities })

  // Link trials
  if (entities.trialIds && entities.trialIds.length > 0) {
    const trialLinks = entities.trialIds.map((trialId) => ({
      drug_id: drugId,
      trial_id: trialId,
      project_id: projectId,
    }))
    const { error } = await supabase
      .from('drug_trials')
      .upsert(trialLinks, { onConflict: 'drug_id,trial_id,project_id' })
    
    if (error) {
      console.error('[DrugAssociationService] Error linking trials:', error)
      throw error
    }
  }

  // Link papers
  if (entities.paperIds && entities.paperIds.length > 0) {
    const paperLinks = entities.paperIds.map((paperId) => ({
      drug_id: drugId,
      paper_id: paperId,
      project_id: projectId,
    }))
    const { error } = await supabase
      .from('drug_papers')
      .upsert(paperLinks, { onConflict: 'drug_id,paper_id,project_id' })
    
    if (error) {
      console.error('[DrugAssociationService] Error linking papers:', error)
      throw error
    }
  }

  // Link press releases
  if (entities.pressReleaseIds && entities.pressReleaseIds.length > 0) {
    const prLinks = entities.pressReleaseIds.map((pressReleaseId) => ({
      drug_id: drugId,
      press_release_id: pressReleaseId,
      project_id: projectId,
    }))
    const { error } = await supabase
      .from('drug_press_releases')
      .upsert(prLinks, { onConflict: 'drug_id,press_release_id,project_id' })
    
    if (error) {
      console.error('[DrugAssociationService] Error linking press releases:', error)
      throw error
    }
  }

  // Link IR decks
  if (entities.irDeckIds && entities.irDeckIds.length > 0) {
    const irLinks = entities.irDeckIds.map((irDeckId) => ({
      drug_id: drugId,
      ir_deck_id: irDeckId,
      project_id: projectId,
    }))
    const { error } = await supabase
      .from('drug_ir_decks')
      .upsert(irLinks, { onConflict: 'drug_id,ir_deck_id,project_id' })
    
    if (error) {
      console.error('[DrugAssociationService] Error linking IR decks:', error)
      throw error
    }
  }

  console.log('[DrugAssociationService] Batch link completed successfully')
}

// ============================================================================
// RETRIEVE ASSOCIATIONS
// ============================================================================

/**
 * Get all trial IDs associated with a drug in a project
 */
export async function getDrugTrialIds(
  drugId: number,
  projectId: number
): Promise<number[]> {
  const { data, error } = await supabase
    .from('drug_trials')
    .select('trial_id')
    .eq('drug_id', drugId)
    .eq('project_id', projectId)

  if (error) {
    console.error('[DrugAssociationService] Error fetching drug trial IDs:', error)
    throw error
  }

  return data.map((row) => row.trial_id)
}

/**
 * Get all paper IDs associated with a drug in a project
 */
export async function getDrugPaperIds(
  drugId: number,
  projectId: number
): Promise<number[]> {
  const { data, error } = await supabase
    .from('drug_papers')
    .select('paper_id')
    .eq('drug_id', drugId)
    .eq('project_id', projectId)

  if (error) {
    console.error('[DrugAssociationService] Error fetching drug paper IDs:', error)
    throw error
  }

  return data.map((row) => row.paper_id)
}

/**
 * Get all press release IDs associated with a drug in a project
 */
export async function getDrugPressReleaseIds(
  drugId: number,
  projectId: number
): Promise<number[]> {
  const { data, error } = await supabase
    .from('drug_press_releases')
    .select('press_release_id')
    .eq('drug_id', drugId)
    .eq('project_id', projectId)

  if (error) {
    console.error('[DrugAssociationService] Error fetching drug press release IDs:', error)
    throw error
  }

  return data.map((row) => row.press_release_id)
}

/**
 * Get all IR deck IDs associated with a drug in a project
 */
export async function getDrugIRDeckIds(
  drugId: number,
  projectId: number
): Promise<number[]> {
  const { data, error } = await supabase
    .from('drug_ir_decks')
    .select('ir_deck_id')
    .eq('drug_id', drugId)
    .eq('project_id', projectId)

  if (error) {
    console.error('[DrugAssociationService] Error fetching drug IR deck IDs:', error)
    throw error
  }

  return data.map((row) => row.ir_deck_id)
}

/**
 * Get all entity IDs associated with a drug in a project
 * Returns all associations in one call
 */
export async function getDrugAssociations(
  drugId: number,
  projectId: number
): Promise<{
  trialIds: number[]
  paperIds: number[]
  pressReleaseIds: number[]
  irDeckIds: number[]
}> {
  const [trialIds, paperIds, pressReleaseIds, irDeckIds] = await Promise.all([
    getDrugTrialIds(drugId, projectId),
    getDrugPaperIds(drugId, projectId),
    getDrugPressReleaseIds(drugId, projectId),
    getDrugIRDeckIds(drugId, projectId),
  ])

  return {
    trialIds,
    paperIds,
    pressReleaseIds,
    irDeckIds,
  }
}

// ============================================================================
// PRESS RELEASE OPERATIONS
// ============================================================================

/**
 * Upsert a press release to the normalized press_releases table
 * Returns the press release ID
 */
export async function upsertPressRelease(pressRelease: {
  title: string
  summary?: string
  company?: string
  releaseDate?: string
  url?: string
  content?: string
}): Promise<number> {
  console.log('[DrugAssociationService] Upserting press release:', pressRelease.title)

  // Try to find existing press release by title and company
  const { data: existing } = await supabase
    .from('press_releases')
    .select('id')
    .eq('title', pressRelease.title)
    .eq('company', pressRelease.company || '')
    .single()

  if (existing) {
    console.log('[DrugAssociationService] Press release already exists with ID:', existing.id)
    return existing.id
  }

  // Insert new press release
  const { data, error } = await supabase
    .from('press_releases')
    .insert({
      title: pressRelease.title,
      summary: pressRelease.summary,
      company: pressRelease.company,
      release_date: pressRelease.releaseDate,
      url: pressRelease.url,
      content: pressRelease.content,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[DrugAssociationService] Error upserting press release:', error)
    throw error
  }

  console.log('[DrugAssociationService] Press release upserted with ID:', data.id)
  return data.id
}

/**
 * Get press releases by IDs
 */
export async function getPressReleasesByIds(ids: number[]): Promise<PressRelease[]> {
  if (ids.length === 0) return []

  const { data, error } = await supabase
    .from('press_releases')
    .select('*')
    .in('id', ids)

  if (error) {
    console.error('[DrugAssociationService] Error fetching press releases:', error)
    throw error
  }

  // Map to PressRelease interface
  return data.map((row) => ({
    id: row.id.toString(),
    title: row.title,
    summary: row.summary || '',
    company: row.company || '',
    releaseDate: row.release_date || '',
    url: row.url || '',
    source: 'database',
    relevanceScore: 0,
  }))
}

// ============================================================================
// IR DECK OPERATIONS
// ============================================================================

/**
 * Upsert an IR deck to the normalized ir_decks table
 * Returns the IR deck ID
 */
export async function upsertIRDeck(irDeck: {
  title: string
  company?: string
  description?: string
  url?: string
  deckDate?: string
  content?: string
}): Promise<number> {
  console.log('[DrugAssociationService] Upserting IR deck:', irDeck.title)

  // Try to find existing IR deck by title and company
  const { data: existing } = await supabase
    .from('ir_decks')
    .select('id')
    .eq('title', irDeck.title)
    .eq('company', irDeck.company || '')
    .single()

  if (existing) {
    console.log('[DrugAssociationService] IR deck already exists with ID:', existing.id)
    return existing.id
  }

  // Insert new IR deck
  const { data, error } = await supabase
    .from('ir_decks')
    .insert({
      title: irDeck.title,
      company: irDeck.company,
      description: irDeck.description,
      url: irDeck.url,
      deck_date: irDeck.deckDate,
      content: irDeck.content,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[DrugAssociationService] Error upserting IR deck:', error)
    throw error
  }

  console.log('[DrugAssociationService] IR deck upserted with ID:', data.id)
  return data.id
}

/**
 * Get IR decks by IDs
 */
export async function getIRDecksByIds(ids: number[]): Promise<IRDeck[]> {
  if (ids.length === 0) return []

  const { data, error } = await supabase
    .from('ir_decks')
    .select('*')
    .in('id', ids)

  if (error) {
    console.error('[DrugAssociationService] Error fetching IR decks:', error)
    throw error
  }

  // Map to IRDeck interface
  return data.map((row) => ({
    id: row.id.toString(),
    title: row.title,
    company: row.company || '',
    description: row.description || '',
    url: row.url || '',
    filingType: 'IR Deck',
    filingDate: row.deck_date || '',
    relevanceScore: 0,
  }))
}

// ============================================================================
// DRUG GROUP OPERATIONS (High-Level Save/Load)
// ============================================================================

/**
 * Save drug groups to the database with their entity associations
 * This creates the drug records, links them to the project, and creates all associations
 */
export async function saveDrugGroups(
  projectId: number,
  drugGroups: DrugGroup[]
): Promise<void> {
  console.log('[DrugAssociationService] Saving', drugGroups.length, 'drug groups for project', projectId)

  // Import services dynamically
  const { upsertDrug, linkDrugToProject } = await import('./drugService')
  const { upsertTrial } = await import('./trialService')
  const { upsertPaper } = await import('./paperService')

  // Create maps for quick lookup of entity IDs
  const trialIdMap = new Map<string, number>() // nctId -> database ID
  const paperIdMap = new Map<string, number>() // pmid -> database ID
  const pressReleaseIdMap = new Map<string, number>() // title+company -> database ID
  const irDeckIdMap = new Map<string, number>() // title+company -> database ID

  // Process each drug group
  for (const drugGroup of drugGroups) {
    try {
      console.log('[DrugAssociationService] Processing drug:', drugGroup.drugName)

      // 1. Upsert the drug
      const drugId = await upsertDrug({
        name: drugGroup.drugName,
        normalized_name: drugGroup.normalizedName,
      })

      // 2. Link drug to project
      await linkDrugToProject(projectId, drugId)

      // 3. Upsert and collect trial IDs
      const trialIds: number[] = []
      for (const trial of drugGroup.trials) {
        const key = trial.nctId
        
        // Check if we already upserted this trial
        if (!trialIdMap.has(key)) {
          const trialId = await upsertTrial(trial)
          trialIdMap.set(key, trialId)
        }
        
        trialIds.push(trialIdMap.get(key)!)
      }

      // 4. Upsert and collect paper IDs
      const paperIds: number[] = []
      for (const paper of drugGroup.papers) {
        const key = paper.pmid
        
        // Check if we already upserted this paper
        if (!paperIdMap.has(key)) {
          const paperId = await upsertPaper(paper)
          paperIdMap.set(key, paperId)
        }
        
        paperIds.push(paperIdMap.get(key)!)
      }

      // 5. Upsert and collect press release IDs
      const pressReleaseIds: number[] = []
      for (const pr of drugGroup.pressReleases) {
        const key = `${pr.title}-${pr.company}`
        
        // Check if we already upserted this press release
        if (!pressReleaseIdMap.has(key)) {
          const prId = await upsertPressRelease({
            title: pr.title,
            summary: pr.summary,
            company: pr.company,
            releaseDate: pr.releaseDate,
            url: pr.url,
          })
          pressReleaseIdMap.set(key, prId)
        }
        
        pressReleaseIds.push(pressReleaseIdMap.get(key)!)
      }

      // 6. Upsert and collect IR deck IDs
      const irDeckIds: number[] = []
      for (const irDeck of drugGroup.irDecks) {
        const key = `${irDeck.title}-${irDeck.company}`
        
        // Check if we already upserted this IR deck
        if (!irDeckIdMap.has(key)) {
          const irDeckId = await upsertIRDeck({
            title: irDeck.title,
            company: irDeck.company,
            description: irDeck.description,
            url: irDeck.url,
            deckDate: irDeck.filingDate,
          })
          irDeckIdMap.set(key, irDeckId)
        }
        
        irDeckIds.push(irDeckIdMap.get(key)!)
      }

      // 7. Batch link all entities to the drug
      await batchLinkDrugEntities(drugId, projectId, {
        trialIds,
        paperIds,
        pressReleaseIds,
        irDeckIds,
      })

      console.log('[DrugAssociationService] Saved drug:', drugGroup.drugName, {
        trials: trialIds.length,
        papers: paperIds.length,
        pressReleases: pressReleaseIds.length,
        irDecks: irDeckIds.length,
      })
    } catch (error) {
      console.error('[DrugAssociationService] Error saving drug group:', drugGroup.drugName, error)
      // Continue with other drugs even if one fails
    }
  }

  console.log('[DrugAssociationService] Finished saving all drug groups')
}

/**
 * Load drug groups from the database with their entity associations
 * This reconstructs the DrugGroup objects from the database relationships
 */
export async function loadDrugGroups(
  projectId: number
): Promise<DrugGroup[]> {
  const startTime = performance.now()
  console.log('[DrugAssociationService] Loading drug groups for project', projectId)

  // Import services dynamically
  const { getProjectDrugs } = await import('./drugService')

  // 1. Get all drugs for this project
  const projectDrugs = await getProjectDrugs(projectId)
  console.log('[DrugAssociationService] Found', projectDrugs.length, 'drugs')

  if (projectDrugs.length === 0) {
    return []
  }

  // 2. Process all drugs in parallel
  console.log('[DrugAssociationService] Processing', projectDrugs.length, 'drugs in parallel...')
  
  const drugGroupPromises = projectDrugs.map(async (drug) => {
    try {
      // Get all entity IDs associated with this drug
      const associations = await getDrugAssociations(drug.id, projectId)

      // Fetch all entities in parallel
      const [trialsData, papersData, pressReleases, irDecks] = await Promise.all([
        // Fetch trials
        supabase
          .from('trials')
          .select('*')
          .in('id', associations.trialIds.length > 0 ? associations.trialIds : [-1])
          .then(({ data, error }) => {
            if (error) throw error
            return data || []
          }),
        
        // Fetch papers
        supabase
          .from('papers')
          .select('*')
          .in('id', associations.paperIds.length > 0 ? associations.paperIds : [-1])
          .then(({ data, error }) => {
            if (error) throw error
            return data || []
          }),
        
        // Fetch press releases
        getPressReleasesByIds(associations.pressReleaseIds),
        
        // Fetch IR decks
        getIRDecksByIds(associations.irDeckIds),
      ])

      // Map trials
      const trials = trialsData.map((row: any) => ({
        nctId: row.nct_id,
        briefTitle: row.brief_title,
        officialTitle: row.official_title,
        overallStatus: row.overall_status,
        phase: row.phase,
        conditions: row.conditions,
        interventions: row.interventions,
        sponsors: { lead: row.sponsors_lead },
        enrollment: row.enrollment,
        startDate: row.start_date,
        completionDate: row.completion_date,
        locations: row.locations,
        studyType: row.study_type,
      }))

      // Map papers
      const papers = papersData.map((row: any) => ({
        pmid: row.pmid,
        title: row.title,
        abstract: row.abstract,
        journal: row.journal,
        publicationDate: row.publication_date,
        authors: row.authors,
        doi: row.doi,
        nctNumber: row.nct_number,
        relevanceScore: row.relevance_score,
        fullTextLinks: {
          doi: row.doi ? `https://doi.org/${row.doi}` : undefined,
          pubmed: `https://pubmed.ncbi.nlm.nih.gov/${row.pmid}/`,
        },
      }))

      // Build the DrugGroup
      const totalResults = trials.length + papers.length + pressReleases.length + irDecks.length
      
      const drugGroup: DrugGroup = {
        drugName: drug.name,
        normalizedName: drug.normalized_name,
        papers,
        trials,
        pressReleases,
        irDecks,
        totalResults,
      }

      return drugGroup
    } catch (error) {
      console.error('[DrugAssociationService] Error loading drug group:', drug.name, error)
      // Return null for failed drugs, we'll filter them out
      return null
    }
  })

  // Wait for all drugs to be processed
  const drugGroupResults = await Promise.all(drugGroupPromises)
  
  // Filter out failed drugs (null values)
  const drugGroups = drugGroupResults.filter((dg): dg is DrugGroup => dg !== null)
  
  // Log summary
  const totalTrials = drugGroups.reduce((sum, dg) => sum + dg.trials.length, 0)
  const totalPapers = drugGroups.reduce((sum, dg) => sum + dg.papers.length, 0)
  const totalPressReleases = drugGroups.reduce((sum, dg) => sum + dg.pressReleases.length, 0)
  const totalIRDecks = drugGroups.reduce((sum, dg) => sum + dg.irDecks.length, 0)
  const drugsWithResults = drugGroups.filter(dg => dg.totalResults > 0).length
  
  console.log('[DrugAssociationService] Summary:', {
    totalDrugs: drugGroups.length,
    drugsWithResults,
    drugsWithoutResults: drugGroups.length - drugsWithResults,
    totalTrials,
    totalPapers,
    totalPressReleases,
    totalIRDecks,
  })

  // Sort by total results
  drugGroups.sort((a, b) => b.totalResults - a.totalResults)

  const endTime = performance.now()
  const duration = ((endTime - startTime) / 1000).toFixed(2)
  console.log(`[DrugAssociationService] ✅ Loaded ${drugGroups.length} drug groups in ${duration}s`)
  
  return drugGroups
}
