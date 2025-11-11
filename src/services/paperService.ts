import { supabase } from '@/lib/supabase'
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

/**
 * Upsert a paper to the normalized papers table
 * Returns the paper ID
 */
export async function upsertPaper(paper: PubMedArticle): Promise<number> {
  const { data, error } = await supabase
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

  if (error) {
    console.error('[PaperService] Error upserting paper:', paper.pmid, error)
    throw error
  }

  return data.id
}

/**
 * Link a paper to a project
 */
export async function linkPaperToProject(
  projectId: number,
  paperId: number
): Promise<void> {
  const { error } = await supabase
    .from('project_papers')
    .upsert(
      {
        project_id: projectId,
        paper_id: paperId,
      },
      { onConflict: 'project_id,paper_id' }
    )

  if (error) {
    console.error('[PaperService] Error linking paper to project:', error)
    throw error
  }
}

/**
 * Get all papers for a project
 */
export async function getProjectPapers(projectId: number): Promise<PubMedArticle[]> {
  console.log('[PaperService] Fetching papers for project:', projectId)

  const { data, error } = await supabase
    .from('project_papers')
    .select(`
      added_at,
      papers (*)
    `)
    .eq('project_id', projectId)
    .order('added_at', { ascending: false })

  if (error) {
    console.error('[PaperService] Error fetching project papers:', error)
    throw error
  }

  // Map database columns to PubMedArticle interface (snake_case → camelCase)
  const papers: PubMedArticle[] = data.map((row: any) => ({
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
  }))

  console.log('[PaperService] Found', papers.length, 'papers for project')
  return papers
}

/**
 * Get a single paper by PMID
 */
export async function getPaperByPmid(pmid: string): Promise<NormalizedPaper | null> {
  const { data, error } = await supabase
    .from('papers')
    .select('*')
    .eq('pmid', pmid)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('[PaperService] Error fetching paper:', error)
    throw error
  }

  return data
}

/**
 * Delete a paper from a project
 */
export async function unlinkPaperFromProject(
  projectId: number,
  paperId: number
): Promise<void> {
  const { error } = await supabase
    .from('project_papers')
    .delete()
    .eq('project_id', projectId)
    .eq('paper_id', paperId)

  if (error) {
    console.error('[PaperService] Error unlinking paper:', error)
    throw error
  }

  console.log('[PaperService] Paper unlinked from project')
}

