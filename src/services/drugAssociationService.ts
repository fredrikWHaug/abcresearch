/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from '@/lib/supabase'
import { handleSupabaseQuery, linkDrugToEntity, getDrugEntityIds } from './utils/supabaseHelpers'
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

      // Issue 3 Fix: Deduplicate entity IDs to prevent "cannot affect row a second time" error
      const uniqueIds = [...new Set(ids)]

      const links = uniqueIds.map((id) => ({
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
  // Issue 2 Fix: Use truncated title for lookup to avoid 406 errors with long URLs
  const titlePrefix = pressRelease.title.substring(0, 150);

  const { data: candidates } = await supabase
    .from('press_releases')
    .select('id, title')
    .ilike('title', `${titlePrefix}%`)
    .eq('company', pressRelease.company || '')

  // Filter in-memory for exact match
  const existing = candidates?.find(c => c.title === pressRelease.title);

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
  // Issue 2 Fix: Use truncated title for lookup to avoid 406 errors with long URLs
  const titlePrefix = irDeck.title.substring(0, 150);

  const { data: candidates } = await supabase
    .from('ir_decks')
    .select('id, title')
    .ilike('title', `${titlePrefix}%`)
    .eq('company', irDeck.company || '')

  // Filter in-memory for exact match
  const existing = candidates?.find(c => c.title === irDeck.title);

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

export async function saveDrugGroups(projectId: number, drugGroups: DrugGroup[]): Promise<void> {
  const { upsertDrug, linkDrugToProject } = await import('./drugService')
  const { upsertTrial } = await import('./trialService')
  const { upsertPaper } = await import('./paperService')

  const trialIdMap = new Map<string, number>()
  const paperIdMap = new Map<string, number>()
  const pressReleaseIdMap = new Map<string, number>()
  const irDeckIdMap = new Map<string, number>()

  // Issue 5 Fix: Track failed drugs for better error reporting
  const failedDrugs: Array<{ drugName: string; error: string }> = []

  for (const drugGroup of drugGroups) {
    try {
      const drugId = await upsertDrug({
        name: drugGroup.drugName,
        normalized_name: drugGroup.normalizedName,
      })

      await linkDrugToProject(projectId, drugId)

      // Issue 4 Fix: Use Sets to prevent duplicate IDs from being added
      const trialIds = new Set<number>()
      for (const trial of drugGroup.trials) {
        if (!trialIdMap.has(trial.nctId)) {
          trialIdMap.set(trial.nctId, await upsertTrial(trial))
        }
        trialIds.add(trialIdMap.get(trial.nctId)!)
      }

      const paperIds = new Set<number>()
      for (const paper of drugGroup.papers) {
        if (!paperIdMap.has(paper.pmid)) {
          paperIdMap.set(paper.pmid, await upsertPaper(paper))
        }
        paperIds.add(paperIdMap.get(paper.pmid)!)
      }

      const pressReleaseIds = new Set<number>()
      for (const pr of drugGroup.pressReleases) {
        const key = `${pr.title}-${pr.company}`
        if (!pressReleaseIdMap.has(key)) {
          pressReleaseIdMap.set(key, await upsertPressRelease({
            title: pr.title,
            summary: pr.summary,
            company: pr.company,
            releaseDate: pr.releaseDate,
            url: pr.url,
          }))
        }
        pressReleaseIds.add(pressReleaseIdMap.get(key)!)
      }

      const irDeckIds = new Set<number>()
      for (const irDeck of drugGroup.irDecks) {
        const key = `${irDeck.title}-${irDeck.company}`
        if (!irDeckIdMap.has(key)) {
          irDeckIdMap.set(key, await upsertIRDeck({
            title: irDeck.title,
            company: irDeck.company,
            description: irDeck.description,
            url: irDeck.url,
            deckDate: irDeck.filingDate,
          }))
        }
        irDeckIds.add(irDeckIdMap.get(key)!)
      }

      await batchLinkDrugEntities(drugId, projectId, { 
        trialIds: Array.from(trialIds), 
        paperIds: Array.from(paperIds), 
        pressReleaseIds: Array.from(pressReleaseIds), 
        irDeckIds: Array.from(irDeckIds) 
      })
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      console.error('[DrugAssociationService] Error saving drug group:', drugGroup.drugName, error)
      failedDrugs.push({ drugName: drugGroup.drugName, error: errorMsg })
    }
  }

  // Issue 5 Fix: Log summary of results
  if (failedDrugs.length > 0) {
    console.warn(`[DrugAssociationService] ${failedDrugs.length} drug group(s) failed to save:`, failedDrugs)
  }
  console.log(`[DrugAssociationService] Successfully saved ${drugGroups.length - failedDrugs.length}/${drugGroups.length} drug groups`)
}

export async function loadDrugGroups(projectId: number): Promise<DrugGroup[]> {
  const { getProjectDrugs } = await import('./drugService')
  const projectDrugs = await getProjectDrugs(projectId)

  if (projectDrugs.length === 0) return []

  const drugGroupPromises = projectDrugs.map(async (drug) => {
    try {
      const associations = await getDrugAssociations(drug.id, projectId)

      const [trialsData, papersData, pressReleases, irDecks] = await Promise.all([
        handleSupabaseQuery<any[]>(
          supabase.from('trials').select('*').in('id', associations.trialIds.length > 0 ? associations.trialIds : [-1])
        ),
        handleSupabaseQuery<any[]>(
          supabase.from('papers').select('*').in('id', associations.paperIds.length > 0 ? associations.paperIds : [-1])
        ),
        getPressReleasesByIds(associations.pressReleaseIds),
        getIRDecksByIds(associations.irDeckIds),
      ])

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

      const totalResults = trials.length + papers.length + pressReleases.length + irDecks.length

      return {
        drugName: drug.name,
        normalizedName: drug.normalized_name,
        papers,
        trials,
        pressReleases,
        irDecks,
        totalResults,
      }
    } catch (error) {
      console.error('[DrugAssociationService] Error loading drug group:', drug.name, error)
      return null
    }
  })

  const drugGroupResults = await Promise.all(drugGroupPromises)
  const drugGroups = drugGroupResults.filter(dg => dg !== null) as DrugGroup[]
  return drugGroups.sort((a, b) => b.totalResults - a.totalResults)
}

