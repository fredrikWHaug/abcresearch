/**
 * Integration Tests: Database CRUD Operations
 *
 * These tests verify the complete database workflow for trials and papers:
 * - Upserting trials to normalized table
 * - Linking trials to projects
 * - Retrieving project trials
 * - Unlinking trials from projects
 * - Upserting papers to normalized table
 * - Linking papers to projects
 * - Retrieving project papers
 * - Unlinking papers from projects
 * - Conflict resolution (upsert behavior)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  upsertTrial,
  linkTrialToProject,
  getProjectTrials,
  getTrialByNctId,
  unlinkTrialFromProject,
  type NormalizedTrial,
} from '@/services/trialService'
import {
  upsertPaper,
  linkPaperToProject,
  getProjectPapers,
  getPaperByPmid,
  unlinkPaperFromProject,
  type NormalizedPaper,
} from '@/services/paperService'
import { supabase } from '@/lib/supabase'
import type { ClinicalTrial } from '@/types/trials'
import type { PubMedArticle } from '@/types/papers'

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

describe('Database CRUD - Trials', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should upsert a trial to normalized table', async () => {
    // Given: A clinical trial
    const trial: ClinicalTrial = {
      nctId: 'NCT12345678',
      briefTitle: 'Study of Semaglutide',
      officialTitle: 'A Phase 3 Study of Semaglutide in Type 2 Diabetes',
      overallStatus: 'RECRUITING',
      phase: ['Phase 3'],
      conditions: ['Type 2 Diabetes'],
      interventions: ['Drug: Semaglutide'],
      sponsors: {
        lead: 'Novo Nordisk',
      },
      enrollment: 1000,
      startDate: '2024-01-01',
      completionDate: '2026-12-31',
      studyType: 'Interventional',
    }

    const mockFrom = {
      upsert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 123 }, error: null }),
    }

    vi.mocked(supabase.from).mockReturnValue(mockFrom as any)

    // When: Upserting trial
    const trialId = await upsertTrial(trial)

    // Then: Should return trial ID
    expect(trialId).toBe(123)
    expect(supabase.from).toHaveBeenCalledWith('trials')
    expect(mockFrom.upsert).toHaveBeenCalledWith(
      {
        nct_id: 'NCT12345678',
        brief_title: 'Study of Semaglutide',
        official_title: 'A Phase 3 Study of Semaglutide in Type 2 Diabetes',
        overall_status: 'RECRUITING',
        phase: ['Phase 3'],
        conditions: ['Type 2 Diabetes'],
        interventions: ['Drug: Semaglutide'],
        sponsors_lead: 'Novo Nordisk',
        enrollment: 1000,
        start_date: '2024-01-01',
        completion_date: '2026-12-31',
        locations: undefined,
        study_type: 'Interventional',
      },
      { onConflict: 'nct_id' }
    )
  })

  it('should link trial to project', async () => {
    // Given: Project and trial IDs
    const projectId = 10
    const trialId = 123

    const mockFrom = {
      upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
    }

    vi.mocked(supabase.from).mockReturnValue(mockFrom as any)

    // When: Linking trial to project
    await linkTrialToProject(projectId, trialId)

    // Then: Should create association
    expect(supabase.from).toHaveBeenCalledWith('project_trials')
    expect(mockFrom.upsert).toHaveBeenCalledWith(
      { project_id: 10, trial_id: 123 },
      { onConflict: 'project_id,trial_id' }
    )
  })

  it('should get all trials for a project', async () => {
    // Given: Project with trials
    const mockProjectTrials = [
      {
        added_at: '2024-01-01T00:00:00Z',
        trials: {
          nct_id: 'NCT111',
          brief_title: 'Trial 1',
          overall_status: 'RECRUITING',
          phase: ['Phase 2'],
          sponsors_lead: 'Company A',
        },
      },
      {
        added_at: '2024-01-02T00:00:00Z',
        trials: {
          nct_id: 'NCT222',
          brief_title: 'Trial 2',
          overall_status: 'COMPLETED',
          phase: ['Phase 3'],
          sponsors_lead: 'Company B',
        },
      },
    ]

    const mockFrom = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockProjectTrials, error: null }),
    }

    vi.mocked(supabase.from).mockReturnValue(mockFrom as any)

    // When: Getting project trials
    const result = await getProjectTrials(10)

    // Then: Should return trials
    expect(result).toHaveLength(2)
    expect(result[0].nctId).toBe('NCT111')
    expect(result[1].nctId).toBe('NCT222')
    expect(mockFrom.eq).toHaveBeenCalledWith('project_id', 10)
  })

  it('should get trial by NCT ID', async () => {
    // Given: Trial exists in database
    const mockTrial: NormalizedTrial = {
      id: 456,
      nct_id: 'NCT99999',
      brief_title: 'Test Trial',
      official_title: 'Official Title',
      overall_status: 'ACTIVE_NOT_RECRUITING',
      phase: ['Phase 1'],
      conditions: ['Test Condition'],
      interventions: ['Drug: TestDrug'],
      sponsors_lead: 'Test Sponsor',
      enrollment: 50,
      start_date: '2024-01-01',
      completion_date: '2025-12-31',
      locations: null,
      study_type: 'Interventional',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    }

    const mockFrom = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockTrial, error: null }),
    }

    vi.mocked(supabase.from).mockReturnValue(mockFrom as any)

    // When: Getting trial by NCT ID
    const result = await getTrialByNctId('NCT99999')

    // Then: Should return trial
    expect(result).toEqual(mockTrial)
    expect(mockFrom.eq).toHaveBeenCalledWith('nct_id', 'NCT99999')
  })

  it('should return null when trial not found', async () => {
    // Given: Trial does not exist
    const mockFrom = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' },
      }),
    }

    vi.mocked(supabase.from).mockReturnValue(mockFrom as any)

    // When: Getting non-existent trial
    const result = await getTrialByNctId('NCT00000')

    // Then: Should return null
    expect(result).toBeNull()
  })

  it('should unlink trial from project', async () => {
    // Given: Linked trial
    const mockFrom = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    }

    // Chain eq() calls
    mockFrom.eq.mockImplementation(() => ({
      ...mockFrom,
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    }))

    vi.mocked(supabase.from).mockReturnValue(mockFrom as any)

    // When: Unlinking trial
    await unlinkTrialFromProject(10, 123)

    // Then: Should delete association
    expect(supabase.from).toHaveBeenCalledWith('project_trials')
    expect(mockFrom.delete).toHaveBeenCalled()
  })
})

describe('Database CRUD - Papers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should upsert a paper to normalized table', async () => {
    // Given: A PubMed article
    const paper: PubMedArticle = {
      pmid: 'PM12345678',
      title: 'Efficacy of Semaglutide in Type 2 Diabetes',
      abstract: 'This study investigates...',
      journal: 'N Engl J Med',
      publicationDate: '2023-06-15',
      authors: ['Smith J', 'Doe J', 'Johnson A'],
      doi: '10.1056/NEJMoa123456',
      nctNumber: 'NCT12345678',
      relevanceScore: 0.95,
      fullTextLinks: {
        pubmed: 'https://pubmed.ncbi.nlm.nih.gov/12345678/',
      },
    }

    const mockFrom = {
      upsert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 789 }, error: null }),
    }

    vi.mocked(supabase.from).mockReturnValue(mockFrom as any)

    // When: Upserting paper
    const paperId = await upsertPaper(paper)

    // Then: Should return paper ID
    expect(paperId).toBe(789)
    expect(supabase.from).toHaveBeenCalledWith('papers')
    expect(mockFrom.upsert).toHaveBeenCalledWith(
      {
        pmid: 'PM12345678',
        title: 'Efficacy of Semaglutide in Type 2 Diabetes',
        abstract: 'This study investigates...',
        journal: 'N Engl J Med',
        publication_date: '2023-06-15',
        authors: ['Smith J', 'Doe J', 'Johnson A'],
        doi: '10.1056/NEJMoa123456',
        nct_number: 'NCT12345678',
        relevance_score: 0.95,
      },
      { onConflict: 'pmid' }
    )
  })

  it('should link paper to project', async () => {
    // Given: Project and paper IDs
    const projectId = 20
    const paperId = 789

    const mockFrom = {
      upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
    }

    vi.mocked(supabase.from).mockReturnValue(mockFrom as any)

    // When: Linking paper to project
    await linkPaperToProject(projectId, paperId)

    // Then: Should create association
    expect(supabase.from).toHaveBeenCalledWith('project_papers')
    expect(mockFrom.upsert).toHaveBeenCalledWith(
      { project_id: 20, paper_id: 789 },
      { onConflict: 'project_id,paper_id' }
    )
  })

  it('should get all papers for a project', async () => {
    // Given: Project with papers
    const mockProjectPapers = [
      {
        added_at: '2024-01-01T00:00:00Z',
        papers: {
          pmid: 'PM111',
          title: 'Paper 1',
          abstract: 'Abstract 1',
          journal: 'Journal A',
          publication_date: '2023-01-01',
          authors: ['Author A'],
          doi: '10.1234/test1',
        },
      },
      {
        added_at: '2024-01-02T00:00:00Z',
        papers: {
          pmid: 'PM222',
          title: 'Paper 2',
          abstract: 'Abstract 2',
          journal: 'Journal B',
          publication_date: '2023-02-01',
          authors: ['Author B'],
          doi: '10.1234/test2',
        },
      },
    ]

    const mockFrom = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockProjectPapers, error: null }),
    }

    vi.mocked(supabase.from).mockReturnValue(mockFrom as any)

    // When: Getting project papers
    const result = await getProjectPapers(20)

    // Then: Should return papers with full text links
    expect(result).toHaveLength(2)
    expect(result[0].pmid).toBe('PM111')
    expect(result[0].fullTextLinks).toBeDefined()
    expect(result[0].fullTextLinks?.pubmed).toBe('https://pubmed.ncbi.nlm.nih.gov/PM111/')
    expect(result[1].pmid).toBe('PM222')
    expect(mockFrom.eq).toHaveBeenCalledWith('project_id', 20)
  })

  it('should get paper by PMID', async () => {
    // Given: Paper exists in database
    const mockPaper: NormalizedPaper = {
      id: 999,
      pmid: 'PM88888',
      title: 'Test Paper',
      abstract: 'Test abstract',
      journal: 'Test Journal',
      publication_date: '2023-01-01',
      authors: ['Test Author'],
      doi: '10.1234/test',
      nct_number: 'NCT123',
      relevance_score: 0.8,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    }

    const mockFrom = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockPaper, error: null }),
    }

    vi.mocked(supabase.from).mockReturnValue(mockFrom as any)

    // When: Getting paper by PMID
    const result = await getPaperByPmid('PM88888')

    // Then: Should return paper
    expect(result).toEqual(mockPaper)
    expect(mockFrom.eq).toHaveBeenCalledWith('pmid', 'PM88888')
  })

  it('should return null when paper not found', async () => {
    // Given: Paper does not exist
    const mockFrom = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' },
      }),
    }

    vi.mocked(supabase.from).mockReturnValue(mockFrom as any)

    // When: Getting non-existent paper
    const result = await getPaperByPmid('PM00000')

    // Then: Should return null
    expect(result).toBeNull()
  })

  it('should unlink paper from project', async () => {
    // Given: Linked paper
    const mockFrom = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    }

    // Chain eq() calls
    mockFrom.eq.mockImplementation(() => ({
      ...mockFrom,
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    }))

    vi.mocked(supabase.from).mockReturnValue(mockFrom as any)

    // When: Unlinking paper
    await unlinkPaperFromProject(20, 789)

    // Then: Should delete association
    expect(supabase.from).toHaveBeenCalledWith('project_papers')
    expect(mockFrom.delete).toHaveBeenCalled()
  })
})

describe('Database CRUD - Upsert Behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should handle duplicate trial upsert (conflict on nct_id)', async () => {
    // Given: Trial being upserted twice
    const trial: ClinicalTrial = {
      nctId: 'NCT12345',
      briefTitle: 'Original Title',
      overallStatus: 'RECRUITING',
    }

    const mockFrom = {
      upsert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 100 }, error: null }),
    }

    vi.mocked(supabase.from).mockReturnValue(mockFrom as any)

    // When: Upserting same trial twice
    const firstId = await upsertTrial(trial)
    const secondId = await upsertTrial(trial)

    // Then: Should return same ID both times (upsert behavior)
    expect(firstId).toBe(100)
    expect(secondId).toBe(100)
    expect(mockFrom.upsert).toHaveBeenCalledTimes(2)
    expect(mockFrom.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ nct_id: 'NCT12345' }),
      { onConflict: 'nct_id' }
    )
  })

  it('should handle duplicate paper upsert (conflict on pmid)', async () => {
    // Given: Paper being upserted twice
    const paper: PubMedArticle = {
      pmid: 'PM12345',
      title: 'Original Paper',
      abstract: 'Test abstract',
      authors: ['Author A'],
      publicationDate: '2023-01-01',
      journal: 'Test Journal',
      doi: '10.1234/test',
      relevanceScore: 0.85,
      fullTextLinks: {
        pubmed: 'https://pubmed.ncbi.nlm.nih.gov/12345/',
      },
    }

    const mockFrom = {
      upsert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 200 }, error: null }),
    }

    vi.mocked(supabase.from).mockReturnValue(mockFrom as any)

    // When: Upserting same paper twice
    const firstId = await upsertPaper(paper)
    const secondId = await upsertPaper(paper)

    // Then: Should return same ID both times (upsert behavior)
    expect(firstId).toBe(200)
    expect(secondId).toBe(200)
    expect(mockFrom.upsert).toHaveBeenCalledTimes(2)
    expect(mockFrom.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ pmid: 'PM12345' }),
      { onConflict: 'pmid' }
    )
  })
})
