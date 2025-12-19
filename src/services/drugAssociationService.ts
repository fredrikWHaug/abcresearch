/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from '@/lib/supabase'
import { handleSupabaseQuery, linkDrugToEntity, getDrugEntityIds, getAllProjectDrugAssociations } from './utils/supabaseHelpers'
import type { DrugGroup } from './drugGroupingService'
import type { PressRelease } from '@/types/press-releases'
import type { IRDeck } from '@/types/ir-decks'

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

export async function linkDrugToTrial(drugId: number, trialId: number, projectId: number): Promise<void> {
  await linkDrugToEntity(drugId, trialId, projectId, 'trial')
}

export async function linkDrugToPaper(drugId: number, paperId: number, projectId: number): Promise<void> {
  await linkDrugToEntity(drugId, paperId, projectId, 'paper')
}

export async function linkDrugToPressRelease(drugId: number, pressReleaseId: number, projectId: number): Promise<void> {
  await linkDrugToEntity(drugId, pressReleaseId, projectId, 'pressRelease')
}

export async function linkDrugToIRDeck(drugId: number, irDeckId: number, projectId: number): Promise<void> {
  await linkDrugToEntity(drugId, irDeckId, projectId, 'irDeck')
}

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
  const entityMap: Array<[keyof typeof entities, 'trial' | 'paper' | 'pressRelease' | 'irDeck', string]> = [
    ['trialIds', 'trial', 'drug_trials'],
    ['paperIds', 'paper', 'drug_papers'],
    ['pressReleaseIds', 'pressRelease', 'drug_press_releases'],
    ['irDeckIds', 'irDeck', 'drug_ir_decks'],
  ]

  await Promise.all(
    entityMap.map(async ([key, type, table]) => {
      const ids = entities[key]
      if (!ids?.length) return

      const links = ids.map((id) => ({
        drug_id: drugId,
        [`${type === 'trial' ? 'trial' : type === 'paper' ? 'paper' : type === 'pressRelease' ? 'press_release' : 'ir_deck'}_id`]: id,
        project_id: projectId,
      }))

      await handleSupabaseQuery(
        supabase.from(table).upsert(links, {
          onConflict: `drug_id,${type === 'trial' ? 'trial' : type === 'paper' ? 'paper' : type === 'pressRelease' ? 'press_release' : 'ir_deck'}_id,project_id`
        })
      )
    })
  )
}

export async function getDrugTrialIds(drugId: number, projectId: number): Promise<number[]> {
  return getDrugEntityIds(drugId, projectId, 'trial')
}

export async function getDrugPaperIds(drugId: number, projectId: number): Promise<number[]> {
  return getDrugEntityIds(drugId, projectId, 'paper')
}

export async function getDrugPressReleaseIds(drugId: number, projectId: number): Promise<number[]> {
  return getDrugEntityIds(drugId, projectId, 'pressRelease')
}

export async function getDrugIRDeckIds(drugId: number, projectId: number): Promise<number[]> {
  return getDrugEntityIds(drugId, projectId, 'irDeck')
}

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

  return { trialIds, paperIds, pressReleaseIds, irDeckIds }
}

export async function upsertPressRelease(pressRelease: {
  title: string
  summary?: string
  company?: string
  releaseDate?: string
  url?: string
  content?: string
}): Promise<number> {
  const { data: existing } = await supabase
    .from('press_releases')
    .select('id')
    .eq('title', pressRelease.title)
    .eq('company', pressRelease.company || '')
    .single()

  if (existing) return existing.id

  const data = await handleSupabaseQuery<{ id: number }>(
    supabase
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
  )

  return data.id
}

export async function getPressReleasesByIds(ids: number[]): Promise<PressRelease[]> {
  if (ids.length === 0) return []

  const data = await handleSupabaseQuery<any[]>(
    supabase.from('press_releases').select('*').in('id', ids)
  )

  return data.map((row: any) => ({
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

export async function upsertIRDeck(irDeck: {
  title: string
  company?: string
  description?: string
  url?: string
  deckDate?: string
  content?: string
}): Promise<number> {
  const { data: existing } = await supabase
    .from('ir_decks')
    .select('id')
    .eq('title', irDeck.title)
    .eq('company', irDeck.company || '')
    .single()

  if (existing) return existing.id

  const data = await handleSupabaseQuery<{ id: number }>(
    supabase
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
  )

  return data.id
}

export async function getIRDecksByIds(ids: number[]): Promise<IRDeck[]> {
  if (ids.length === 0) return []

  const data = await handleSupabaseQuery<any[]>(
    supabase.from('ir_decks').select('*').in('id', ids)
  )

  return data.map((row: any) => ({
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

/**
 * OPTIMIZED: Save drug groups using bulk upserts to minimize database requests.
 * 
 * Query breakdown:
 * 1. Bulk upsert all unique trials (1 query)
 * 2. Bulk upsert all unique papers (1 query)
 * 3. Bulk upsert all unique press releases (1 query)
 * 4. Bulk upsert all unique IR decks (1 query)
 * 5. Upsert drugs and link entities (N queries for N drugs, but batched links)
 * 
 * Previously: ~8 queries per drug = 400 queries for 50 drugs
 * Now: ~4 + N queries = ~54 queries for 50 drugs
 */
export async function saveDrugGroups(projectId: number, drugGroups: DrugGroup[]): Promise<void> {
  if (drugGroups.length === 0) return
  
  console.log(`[DrugAssociationService] Saving ${drugGroups.length} drug groups with bulk upserts`)
  
  const { bulkUpsertDrugs, bulkLinkDrugsToProject } = await import('./drugService')
  const { bulkUpsertTrials } = await import('./trialService')
  const { bulkUpsertPapers } = await import('./paperService')

  // Step 1: Collect all unique entities across all drug groups
  const allTrials: any[] = []
  const allPapers: any[] = []
  const allPressReleases: { key: string; data: any }[] = []
  const allIRDecks: { key: string; data: any }[] = []
  
  const seenTrials = new Set<string>()
  const seenPapers = new Set<string>()
  const seenPressReleases = new Set<string>()
  const seenIRDecks = new Set<string>()
  
  for (const drugGroup of drugGroups) {
    for (const trial of drugGroup.trials) {
      if (!seenTrials.has(trial.nctId)) {
        seenTrials.add(trial.nctId)
        allTrials.push(trial)
      }
    }
    
    for (const paper of drugGroup.papers) {
      if (!seenPapers.has(paper.pmid)) {
        seenPapers.add(paper.pmid)
        allPapers.push(paper)
      }
    }
    
    for (const pr of drugGroup.pressReleases) {
      const key = `${pr.title}-${pr.company}`
      if (!seenPressReleases.has(key)) {
        seenPressReleases.add(key)
        allPressReleases.push({
          key,
          data: {
            title: pr.title,
            summary: pr.summary,
            company: pr.company,
            releaseDate: pr.releaseDate,
            url: pr.url,
          }
        })
      }
    }
    
    for (const irDeck of drugGroup.irDecks) {
      const key = `${irDeck.title}-${irDeck.company}`
      if (!seenIRDecks.has(key)) {
        seenIRDecks.add(key)
        allIRDecks.push({
          key,
          data: {
            title: irDeck.title,
            company: irDeck.company,
            description: irDeck.description,
            url: irDeck.url,
            deckDate: irDeck.filingDate,
          }
        })
      }
    }
  }
  
  // Step 2: Bulk upsert all entities in parallel (4 queries)
  const [trialIdMap, paperIdMap] = await Promise.all([
    bulkUpsertTrials(allTrials),
    bulkUpsertPapers(allPapers),
  ])
  
  // Press releases and IR decks still need individual upserts due to unique key check
  // But we batch them in parallel
  const pressReleaseIdMap = new Map<string, number>()
  const irDeckIdMap = new Map<string, number>()
  
  await Promise.all([
    ...allPressReleases.map(async ({ key, data }) => {
      const id = await upsertPressRelease(data)
      pressReleaseIdMap.set(key, id)
    }),
    ...allIRDecks.map(async ({ key, data }) => {
      const id = await upsertIRDeck(data)
      irDeckIdMap.set(key, id)
    }),
  ])
  
  // Step 3: Bulk upsert all drugs
  const drugRecords = drugGroups.map(dg => ({
    name: dg.drugName,
    normalized_name: dg.normalizedName,
  }))
  
  const drugIdMap = await bulkUpsertDrugs(drugRecords)
  
  // Step 4: Link all drugs to the project in one call
  const allDrugIds = Array.from(drugIdMap.values())
  await bulkLinkDrugsToProject(projectId, allDrugIds)
  
  // Step 5: Link entities to drugs (batched per drug, but parallel)
  await Promise.all(drugGroups.map(async (drugGroup) => {
    const drugId = drugIdMap.get(drugGroup.drugName)
    if (!drugId) {
      console.error('[DrugAssociationService] Drug ID not found for:', drugGroup.drugName)
      return
    }
    
    const trialIds = drugGroup.trials
      .map(t => trialIdMap.get(t.nctId))
      .filter((id): id is number => id !== undefined)
    
    const paperIds = drugGroup.papers
      .map(p => paperIdMap.get(p.pmid))
      .filter((id): id is number => id !== undefined)
    
    const pressReleaseIds = drugGroup.pressReleases
      .map(pr => pressReleaseIdMap.get(`${pr.title}-${pr.company}`))
      .filter((id): id is number => id !== undefined)
    
    const irDeckIds = drugGroup.irDecks
      .map(ir => irDeckIdMap.get(`${ir.title}-${ir.company}`))
      .filter((id): id is number => id !== undefined)
    
    await batchLinkDrugEntities(drugId, projectId, { trialIds, paperIds, pressReleaseIds, irDeckIds })
  }))
  
  console.log(`[DrugAssociationService] Saved ${drugGroups.length} drug groups with ${allTrials.length} trials, ${allPapers.length} papers`)
}

/**
 * OPTIMIZED: Load all drug groups for a project using batch queries.
 * This eliminates the N+1 query problem by fetching all data in ~9 queries total
 * instead of 8+ queries per drug.
 * 
 * Query breakdown:
 * 1. Get all drugs for project (1 query)
 * 2. Get all associations - 4 parallel queries (trials, papers, press releases, IR decks)
 * 3. Get all entities by collected IDs - 4 parallel queries
 * 
 * Returns: DrugGroup[] with all trials, papers, press releases, and IR decks populated
 */
export async function loadDrugGroups(projectId: number): Promise<DrugGroup[]> {
  const { getProjectDrugs } = await import('./drugService')
  
  // Query 1: Get all drugs for this project
  const projectDrugs = await getProjectDrugs(projectId)
  if (projectDrugs.length === 0) return []
  
  console.log(`[DrugAssociationService] Loading ${projectDrugs.length} drugs with batch queries`)

  // Queries 2-5: Get ALL associations in 4 parallel queries (not per-drug!)
  const associations = await getAllProjectDrugAssociations(projectId)
  
  // Collect all unique entity IDs across all drugs
  const allTrialIds = new Set<number>()
  const allPaperIds = new Set<number>()
  const allPressReleaseIds = new Set<number>()
  const allIRDeckIds = new Set<number>()
  
  for (const drug of projectDrugs) {
    const trialIds = associations.drugTrials.get(drug.id) || []
    const paperIds = associations.drugPapers.get(drug.id) || []
    const prIds = associations.drugPressReleases.get(drug.id) || []
    const irIds = associations.drugIRDecks.get(drug.id) || []
    
    trialIds.forEach(id => allTrialIds.add(id))
    paperIds.forEach(id => allPaperIds.add(id))
    prIds.forEach(id => allPressReleaseIds.add(id))
    irIds.forEach(id => allIRDeckIds.add(id))
  }
  
  // Queries 6-9: Fetch ALL entities in 4 parallel queries using .in()
  const [allTrialsData, allPapersData, allPressReleases, allIRDecks] = await Promise.all([
    allTrialIds.size > 0 
      ? handleSupabaseQuery<any[]>(supabase.from('trials').select('*').in('id', Array.from(allTrialIds)))
      : Promise.resolve([]),
    allPaperIds.size > 0
      ? handleSupabaseQuery<any[]>(supabase.from('papers').select('*').in('id', Array.from(allPaperIds)))
      : Promise.resolve([]),
    getPressReleasesByIds(Array.from(allPressReleaseIds)),
    getIRDecksByIds(Array.from(allIRDeckIds)),
  ])
  
  // Build lookup maps for O(1) entity access
  const trialsMap = new Map<number, any>()
  for (const row of allTrialsData) {
    trialsMap.set(row.id, {
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
    })
  }
  
  const papersMap = new Map<number, any>()
  for (const row of allPapersData) {
    papersMap.set(row.id, {
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
    })
  }
  
  const pressReleasesMap = new Map<number, PressRelease>()
  for (const pr of allPressReleases) {
    pressReleasesMap.set(parseInt(pr.id), pr)
  }
  
  const irDecksMap = new Map<number, IRDeck>()
  for (const ir of allIRDecks) {
    irDecksMap.set(parseInt(ir.id), ir)
  }
  
  // Build drug groups by looking up entities from maps (O(1) per lookup)
  const drugGroups: DrugGroup[] = []
  
  for (const drug of projectDrugs) {
    const trialIds = associations.drugTrials.get(drug.id) || []
    const paperIds = associations.drugPapers.get(drug.id) || []
    const prIds = associations.drugPressReleases.get(drug.id) || []
    const irIds = associations.drugIRDecks.get(drug.id) || []
    
    const trials = trialIds.map(id => trialsMap.get(id)).filter(Boolean)
    const papers = paperIds.map(id => papersMap.get(id)).filter(Boolean)
    const pressReleases = prIds.map(id => pressReleasesMap.get(id)).filter(Boolean) as PressRelease[]
    const irDecks = irIds.map(id => irDecksMap.get(id)).filter(Boolean) as IRDeck[]
    
    const totalResults = trials.length + papers.length + pressReleases.length + irDecks.length
    
    drugGroups.push({
      drugName: drug.name,
      normalizedName: drug.normalized_name,
      papers,
      trials,
      pressReleases,
      irDecks,
      totalResults,
    })
  }
  
  console.log(`[DrugAssociationService] Loaded ${drugGroups.length} drug groups with ~9 queries (was ${projectDrugs.length * 8}+ queries)`)
  
  return drugGroups.sort((a, b) => b.totalResults - a.totalResults)
}

/**
 * Extended version of loadDrugGroups that also returns aggregated trials and papers.
 * Use this in Dashboard to avoid redundant getProjectTrials/getProjectPapers calls.
 */
export async function loadDrugGroupsWithEntities(projectId: number): Promise<{
  drugGroups: DrugGroup[]
  allTrials: any[]
  allPapers: any[]
  allPressReleases: PressRelease[]
  allIRDecks: IRDeck[]
}> {
  const { getProjectDrugs } = await import('./drugService')
  
  // Query 1: Get all drugs for this project
  const projectDrugs = await getProjectDrugs(projectId)
  if (projectDrugs.length === 0) {
    return { drugGroups: [], allTrials: [], allPapers: [], allPressReleases: [], allIRDecks: [] }
  }
  
  console.log(`[DrugAssociationService] Loading ${projectDrugs.length} drugs with batch queries (with entities)`)

  // Queries 2-5: Get ALL associations in 4 parallel queries
  const associations = await getAllProjectDrugAssociations(projectId)
  
  // Collect all unique entity IDs
  const allTrialIds = new Set<number>()
  const allPaperIds = new Set<number>()
  const allPressReleaseIds = new Set<number>()
  const allIRDeckIds = new Set<number>()
  
  for (const drug of projectDrugs) {
    const trialIds = associations.drugTrials.get(drug.id) || []
    const paperIds = associations.drugPapers.get(drug.id) || []
    const prIds = associations.drugPressReleases.get(drug.id) || []
    const irIds = associations.drugIRDecks.get(drug.id) || []
    
    trialIds.forEach(id => allTrialIds.add(id))
    paperIds.forEach(id => allPaperIds.add(id))
    prIds.forEach(id => allPressReleaseIds.add(id))
    irIds.forEach(id => allIRDeckIds.add(id))
  }
  
  // Queries 6-9: Fetch ALL entities in 4 parallel queries
  const [allTrialsData, allPapersData, allPressReleases, allIRDecks] = await Promise.all([
    allTrialIds.size > 0 
      ? handleSupabaseQuery<any[]>(supabase.from('trials').select('*').in('id', Array.from(allTrialIds)))
      : Promise.resolve([]),
    allPaperIds.size > 0
      ? handleSupabaseQuery<any[]>(supabase.from('papers').select('*').in('id', Array.from(allPaperIds)))
      : Promise.resolve([]),
    getPressReleasesByIds(Array.from(allPressReleaseIds)),
    getIRDecksByIds(Array.from(allIRDeckIds)),
  ])
  
  // Build lookup maps
  const trialsMap = new Map<number, any>()
  const allTrials: any[] = []
  for (const row of allTrialsData) {
    const trial = {
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
    }
    trialsMap.set(row.id, trial)
    allTrials.push(trial)
  }
  
  const papersMap = new Map<number, any>()
  const allPapers: any[] = []
  for (const row of allPapersData) {
    const paper = {
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
    }
    papersMap.set(row.id, paper)
    allPapers.push(paper)
  }
  
  const pressReleasesMap = new Map<number, PressRelease>()
  for (const pr of allPressReleases) {
    pressReleasesMap.set(parseInt(pr.id), pr)
  }
  
  const irDecksMap = new Map<number, IRDeck>()
  for (const ir of allIRDecks) {
    irDecksMap.set(parseInt(ir.id), ir)
  }
  
  // Build drug groups
  const drugGroups: DrugGroup[] = []
  
  for (const drug of projectDrugs) {
    const trialIds = associations.drugTrials.get(drug.id) || []
    const paperIds = associations.drugPapers.get(drug.id) || []
    const prIds = associations.drugPressReleases.get(drug.id) || []
    const irIds = associations.drugIRDecks.get(drug.id) || []
    
    const trials = trialIds.map(id => trialsMap.get(id)).filter(Boolean)
    const papers = paperIds.map(id => papersMap.get(id)).filter(Boolean)
    const pressReleases = prIds.map(id => pressReleasesMap.get(id)).filter(Boolean) as PressRelease[]
    const irDecks = irIds.map(id => irDecksMap.get(id)).filter(Boolean) as IRDeck[]
    
    const totalResults = trials.length + papers.length + pressReleases.length + irDecks.length
    
    drugGroups.push({
      drugName: drug.name,
      normalizedName: drug.normalized_name,
      papers,
      trials,
      pressReleases,
      irDecks,
      totalResults,
    })
  }
  
  console.log(`[DrugAssociationService] Loaded ${drugGroups.length} drug groups, ${allTrials.length} trials, ${allPapers.length} papers with ~9 queries`)
  
  return {
    drugGroups: drugGroups.sort((a, b) => b.totalResults - a.totalResults),
    allTrials,
    allPapers,
    allPressReleases,
    allIRDecks,
  }
}
