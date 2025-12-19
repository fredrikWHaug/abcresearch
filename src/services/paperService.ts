/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from '@/lib/supabase'
import { handleSupabaseQuery } from './utils/supabaseHelpers'
import type { PubMedArticle } from '@/types/papers'

export interface NormalizedPaper {
  id: number
  pmid: string
  title: string
  abstract?: string
  journal?: string
  publication_date?: string
  authors?: string[]
  doi?: string
  nct_number?: string
  relevance_score?: number
  created_at: string
  updated_at: string
}

export interface ProjectPaper extends NormalizedPaper {
  added_at: string
}

export async function upsertPaper(paper: PubMedArticle): Promise<number> {
  const data = await handleSupabaseQuery<{ id: number }>(
    supabase
      .from('papers')
      .upsert(
        {
          pmid: paper.pmid,
          title: paper.title,
          abstract: paper.abstract,
          journal: paper.journal,
          publication_date: paper.publicationDate,
          authors: paper.authors,
          doi: paper.doi,
          nct_number: paper.nctNumber,
          relevance_score: paper.relevanceScore,
        },
        { onConflict: 'pmid' }
      )
      .select('id')
      .single()
  )
  return data.id
}

export async function linkPaperToProject(projectId: number, paperId: number): Promise<void> {
  await handleSupabaseQuery(
    supabase.from('project_papers').upsert(
      { project_id: projectId, paper_id: paperId },
      { onConflict: 'project_id,paper_id' }
    )
  )
}

export async function getProjectPapers(projectId: number): Promise<PubMedArticle[]> {
  const data = await handleSupabaseQuery<any[]>(
    supabase
      .from('project_papers')
      .select('added_at, papers (*)')
      .eq('project_id', projectId)
      .order('added_at', { ascending: false })
  )

  return data?.map((row: any) => ({
    pmid: row.papers.pmid,
    title: row.papers.title,
    abstract: row.papers.abstract,
    journal: row.papers.journal,
    publicationDate: row.papers.publication_date,
    authors: row.papers.authors,
    doi: row.papers.doi,
    nctNumber: row.papers.nct_number,
    relevanceScore: row.papers.relevance_score,
    fullTextLinks: {
      doi: row.papers.doi ? `https://doi.org/${row.papers.doi}` : undefined,
      pubmed: `https://pubmed.ncbi.nlm.nih.gov/${row.papers.pmid}/`
    }
  })) ?? []
}

export async function getPaperByPmid(pmid: string): Promise<NormalizedPaper | null> {
  const { data, error } = await supabase.from('papers').select('*').eq('pmid', pmid).single()
  if (error && error.code !== 'PGRST116') throw error
  return data
}

export async function unlinkPaperFromProject(projectId: number, paperId: number): Promise<void> {
  await handleSupabaseQuery(
    supabase.from('project_papers').delete().eq('project_id', projectId).eq('paper_id', paperId)
  )
}

/**
 * BULK VERSION: Upsert multiple papers in a single database call.
 * Returns a Map of pmid -> database id for linking to drugs/projects.
 * Much more efficient than calling upsertPaper() in a loop.
 */
export async function bulkUpsertPapers(papers: PubMedArticle[]): Promise<Map<string, number>> {
  if (papers.length === 0) return new Map()
  
  // Deduplicate by pmid before upserting
  const uniquePapers = Array.from(
    new Map(papers.map(p => [p.pmid, p])).values()
  )
  
  const paperRecords = uniquePapers.map(paper => ({
    pmid: paper.pmid,
    title: paper.title,
    abstract: paper.abstract,
    journal: paper.journal,
    publication_date: paper.publicationDate,
    authors: paper.authors,
    doi: paper.doi,
    nct_number: paper.nctNumber,
    relevance_score: paper.relevanceScore,
  }))
  
  const data = await handleSupabaseQuery<{ id: number; pmid: string }[]>(
    supabase
      .from('papers')
      .upsert(paperRecords, { onConflict: 'pmid' })
      .select('id, pmid')
  )
  
  const result = new Map<string, number>()
  for (const row of data) {
    result.set(row.pmid, row.id)
  }
  
  return result
}

/**
 * BULK VERSION: Link multiple papers to a project in a single database call.
 */
export async function bulkLinkPapersToProject(projectId: number, paperIds: number[]): Promise<void> {
  if (paperIds.length === 0) return
  
  const links = paperIds.map(paperId => ({
    project_id: projectId,
    paper_id: paperId,
  }))
  
  await handleSupabaseQuery(
    supabase.from('project_papers').upsert(links, { onConflict: 'project_id,paper_id' })
  )
}

