/**
 * Integration Tests: Search & Drug Discovery Flow
 *
 * These tests verify the complete drug discovery workflow:
 * - Gathering search results (trials, papers, press releases, IR decks)
 * - Query enhancement with AI
 * - Multi-source parallel searching
 * - Result deduplication and ranking
 * - Drug grouping and filtering
 * - Error handling and fallback behavior
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GatherSearchResultsService } from '@/services/gatherSearchResults'
import { DrugGroupingService } from '@/services/drugGroupingService'
import type { ClinicalTrial } from '@/types/trials'
import type { PubMedArticle } from '@/types/papers'
import type { PressRelease } from '@/types/press-releases'
import type { IRDeck } from '@/types/ir-decks'
import type { DrugGroup } from '@/services/drugGroupingService'

// Mock fetch globally
global.fetch = vi.fn()

describe('Search & Drug Discovery - Gather Results', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should successfully gather trials and papers for a query', async () => {
    // Given: Successful API responses for search enhancement and searches
    const mockStrategies = [
      { query: 'semaglutide diabetes', description: 'GLP-1 for T2D', priority: 'high' as const, searchType: 'targeted' as const },
      { query: 'tirzepatide obesity', description: 'Dual GIP/GLP-1', priority: 'high' as const, searchType: 'targeted' as const },
    ]

    const mockTrials: ClinicalTrial[] = [
      {
        nctId: 'NCT12345',
        officialTitle: 'Study of Semaglutide in Type 2 Diabetes',
        briefTitle: 'Semaglutide T2D Study',
        overallStatus: 'COMPLETED',
        phase: ['Phase 3'],
        studyType: 'Interventional',
        interventions: ['Drug: Semaglutide'],
        conditions: ['Type 2 Diabetes'],
        sponsors: {
          lead: 'Novo Nordisk',
        },
        startDate: '2020-01-01',
        completionDate: '2023-12-31',
        enrollment: 1000,
      },
    ]

    const mockPapers: PubMedArticle[] = [
      {
        pmid: 'PM123456',
        title: 'Efficacy of Semaglutide in Type 2 Diabetes',
        abstract: 'This study investigates semaglutide',
        authors: ['Smith J', 'Doe J'],
        publicationDate: '2023-06-15',
        journal: 'N Engl J Med',
        doi: '10.1056/NEJMoa123456',
      },
    ]

    vi.mocked(global.fetch).mockImplementation(async (url: string | URL | Request) => {
      const urlString = url.toString()

      // Mock enhance-search endpoint
      if (urlString.includes('/api/enhance-search')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            strategies: mockStrategies,
            totalStrategies: 2,
          }),
        } as Response
      }

      // Mock trials search
      if (urlString.includes('/api/search?type=trials')) {
        return {
          ok: true,
          json: async () => ({
            trials: mockTrials,
            totalCount: 1,
          }),
        } as Response
      }

      // Mock papers search
      if (urlString.includes('/api/search?type=papers')) {
        return {
          ok: true,
          json: async () => ({
            papers: mockPapers,
          }),
        } as Response
      }

      // Mock press releases search
      if (urlString.includes('/api/search?type=press-releases')) {
        return {
          ok: true,
          json: async () => ({
            pressReleases: [],
          }),
        } as Response
      }

      // Mock IR decks search
      if (urlString.includes('/api/search?type=ir-decks')) {
        return {
          ok: true,
          json: async () => ({
            irDecks: [],
          }),
        } as Response
      }

      return { ok: false } as Response
    })

    // When: Searching for diabetes drugs
    const result = await GatherSearchResultsService.gatherSearchResults('diabetes drugs')

    // Then: Should return trials and papers
    expect(result.trials.length).toBeGreaterThan(0)
    expect(result.papers.length).toBeGreaterThan(0)
    expect(result.totalCount).toBeGreaterThan(0)
    expect(result.searchStrategies.length).toBeGreaterThan(0)
  })

  it('should handle query enhancement with progress callback', async () => {
    // Given: Mock API responses
    const mockStrategies = [
      { query: 'diabetes medications', description: 'T2D treatments', priority: 'high' as const, searchType: 'broad' as const },
    ]

    const progressMessages: string[] = []
    const onProgress = (message: string) => {
      progressMessages.push(message)
    }

    vi.mocked(global.fetch).mockImplementation(async (url: string | URL | Request) => {
      const urlString = url.toString()

      if (urlString.includes('/api/enhance-search')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            strategies: mockStrategies,
            totalStrategies: 1,
          }),
        } as Response
      }

      if (urlString.includes('/api/search')) {
        return {
          ok: true,
          json: async () => ({
            trials: [],
            papers: [],
            pressReleases: [],
            irDecks: [],
            totalCount: 0,
          }),
        } as Response
      }

      return { ok: false } as Response
    })

    // When: Searching with progress callback
    await GatherSearchResultsService.gatherSearchResults('diabetes', onProgress)

    // Then: Should report progress
    expect(progressMessages.length).toBeGreaterThan(0)
    expect(progressMessages.some(msg => msg.includes('Enhancing'))).toBe(true)
  })

  it('should deduplicate trials with same NCT ID', async () => {
    // Given: Multiple strategies returning the same trial
    const duplicateTrial: ClinicalTrial = {
      nctId: 'NCT99999',
      officialTitle: 'Duplicate Trial',
      briefTitle: 'Duplicate',
      overallStatus: 'RECRUITING',
      phase: ['Phase 2'],
      studyType: 'Interventional',
      interventions: ['Drug: TestDrug'],
      conditions: ['Diabetes'],
      sponsors: {
        lead: 'Test Pharma',
      },
      startDate: '2024-01-01',
      enrollment: 100,
    }

    const mockStrategies = [
      { query: 'test query 1', description: 'Test 1', priority: 'high' as const, searchType: 'targeted' as const },
      { query: 'test query 2', description: 'Test 2', priority: 'high' as const, searchType: 'broad' as const },
    ]

    vi.mocked(global.fetch).mockImplementation(async (url: string | URL | Request) => {
      const urlString = url.toString()

      if (urlString.includes('/api/enhance-search')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            strategies: mockStrategies,
            totalStrategies: 2,
          }),
        } as Response
      }

      if (urlString.includes('/api/search?type=trials')) {
        // Both strategies return the same trial
        return {
          ok: true,
          json: async () => ({
            trials: [duplicateTrial],
            totalCount: 1,
          }),
        } as Response
      }

      if (urlString.includes('/api/search')) {
        return {
          ok: true,
          json: async () => ({ papers: [], pressReleases: [], irDecks: [] }),
        } as Response
      }

      return { ok: false } as Response
    })

    // When: Searching with duplicate results
    const result = await GatherSearchResultsService.gatherSearchResults('test query')

    // Then: Should deduplicate by NCT ID
    expect(result.trials.length).toBe(1)
    expect(result.trials[0].nctId).toBe('NCT99999')
  })

  it('should continue search even if papers fail', async () => {
    // Given: Trials succeed but papers fail
    const mockStrategies = [
      { query: 'test query', description: 'Test', priority: 'high' as const, searchType: 'targeted' as const },
    ]

    const mockTrials: ClinicalTrial[] = [
      {
        nctId: 'NCT11111',
        officialTitle: 'Test Trial',
        briefTitle: 'Test',
        overallStatus: 'ACTIVE_NOT_RECRUITING',
        phase: ['Phase 1'],
        studyType: 'Interventional',
        interventions: [],
        conditions: [],
        sponsors: {
          lead: 'Test',
        },
        startDate: '2024-01-01',
        enrollment: 50,
      },
    ]

    vi.mocked(global.fetch).mockImplementation(async (url: string | URL | Request) => {
      const urlString = url.toString()

      if (urlString.includes('/api/enhance-search')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            strategies: mockStrategies,
            totalStrategies: 1,
          }),
        } as Response
      }

      if (urlString.includes('/api/search?type=trials')) {
        return {
          ok: true,
          json: async () => ({
            trials: mockTrials,
            totalCount: 1,
          }),
        } as Response
      }

      if (urlString.includes('/api/search?type=papers')) {
        // Papers endpoint fails
        return {
          ok: false,
          statusText: 'Internal Server Error',
        } as Response
      }

      if (urlString.includes('/api/search')) {
        return {
          ok: true,
          json: async () => ({ pressReleases: [], irDecks: [] }),
        } as Response
      }

      return { ok: false } as Response
    })

    // When: Searching with papers endpoint failing
    const result = await GatherSearchResultsService.gatherSearchResults('test')

    // Then: Should still return trials (papers should be empty array)
    expect(result.trials.length).toBe(1)
    expect(result.papers.length).toBe(0)
  })

  it('should throw error when query enhancement fails', async () => {
    // Given: Enhancement endpoint fails
    vi.mocked(global.fetch).mockImplementation(async (url: string | URL | Request) => {
      const urlString = url.toString()

      if (urlString.includes('/api/enhance-search')) {
        return {
          ok: false,
          statusText: 'Bad Request',
          json: async () => ({ error: 'Invalid query' }),
        } as Response
      }

      return { ok: false } as Response
    })

    // When/Then: Should throw error
    await expect(
      GatherSearchResultsService.gatherSearchResults('invalid query')
    ).rejects.toThrow()
  })
})

describe('Search & Drug Discovery - Drug Grouping', () => {
  it('should filter drug groups by query', () => {
    // Given: Multiple drug groups
    const mockDrugGroups: DrugGroup[] = [
      {
        drugName: 'Semaglutide',
        normalizedName: 'semaglutide',
        papers: [
          {
            pmid: 'PM1',
            title: 'Semaglutide efficacy in diabetes',
            abstract: 'Study shows positive results',
            authors: ['Smith J'],
            publicationDate: '2023-01-01',
            journal: 'Test Journal',
            doi: '10.1234/test',
          },
        ],
        trials: [],
        pressReleases: [],
        irDecks: [],
        totalResults: 1,
      },
      {
        drugName: 'Tirzepatide',
        normalizedName: 'tirzepatide',
        papers: [],
        trials: [
          {
            nctId: 'NCT123',
            officialTitle: 'Tirzepatide for obesity',
            briefTitle: 'TZP Obesity Study',
            overallStatus: 'RECRUITING',
            phase: ['Phase 3'],
            studyType: 'Interventional',
            interventions: [],
            conditions: [],
            sponsors: {
              lead: 'Test',
            },
            startDate: '2024-01-01',
            enrollment: 200,
          },
        ],
        pressReleases: [],
        irDecks: [],
        totalResults: 1,
      },
      {
        drugName: 'Metformin',
        normalizedName: 'metformin',
        papers: [],
        trials: [],
        pressReleases: [],
        irDecks: [],
        totalResults: 0,
      },
    ]

    // When: Filtering by "sema"
    const result = DrugGroupingService.filterDrugGroups(mockDrugGroups, 'sema')

    // Then: Should return only Semaglutide
    expect(result.length).toBe(1)
    expect(result[0].drugName).toBe('Semaglutide')
  })

  it('should filter by paper content', () => {
    // Given: Drug groups with papers
    const mockDrugGroups: DrugGroup[] = [
      {
        drugName: 'Drug A',
        normalizedName: 'drug a',
        papers: [
          {
            pmid: 'PM1',
            title: 'Study of cardiovascular effects',
            abstract: 'Heart disease treatment',
            authors: ['Doe J'],
            publicationDate: '2023-01-01',
            journal: 'Cardio Journal',
            doi: '10.1234/cardio',
          },
        ],
        trials: [],
        pressReleases: [],
        irDecks: [],
        totalResults: 1,
      },
      {
        drugName: 'Drug B',
        normalizedName: 'drug b',
        papers: [
          {
            pmid: 'PM2',
            title: 'Diabetes management study',
            abstract: 'Glucose control',
            authors: ['Smith J'],
            publicationDate: '2023-01-01',
            journal: 'Diabetes Journal',
            doi: '10.1234/diabetes',
          },
        ],
        trials: [],
        pressReleases: [],
        irDecks: [],
        totalResults: 1,
      },
    ]

    // When: Filtering by "cardiovascular"
    const result = DrugGroupingService.filterDrugGroups(mockDrugGroups, 'cardiovascular')

    // Then: Should return Drug A
    expect(result.length).toBe(1)
    expect(result[0].drugName).toBe('Drug A')
  })

  it('should filter by trial title', () => {
    // Given: Drug groups with trials
    const mockDrugGroups: DrugGroup[] = [
      {
        drugName: 'Drug X',
        normalizedName: 'drug x',
        papers: [],
        trials: [
          {
            nctId: 'NCT111',
            officialTitle: 'Official Title',
            briefTitle: 'Obesity treatment trial',
            overallStatus: 'ACTIVE_NOT_RECRUITING',
            phase: ['Phase 2'],
            studyType: 'Interventional',
            interventions: [],
            conditions: [],
            sponsors: {
              lead: 'Test',
            },
            startDate: '2024-01-01',
            enrollment: 100,
          },
        ],
        pressReleases: [],
        irDecks: [],
        totalResults: 1,
      },
      {
        drugName: 'Drug Y',
        normalizedName: 'drug y',
        papers: [],
        trials: [
          {
            nctId: 'NCT222',
            officialTitle: 'Official Title',
            briefTitle: 'Hypertension study',
            overallStatus: 'RECRUITING',
            phase: ['Phase 3'],
            studyType: 'Interventional',
            interventions: [],
            conditions: [],
            sponsors: {
              lead: 'Test',
            },
            startDate: '2024-01-01',
            enrollment: 150,
          },
        ],
        pressReleases: [],
        irDecks: [],
        totalResults: 1,
      },
    ]

    // When: Filtering by "obesity"
    const result = DrugGroupingService.filterDrugGroups(mockDrugGroups, 'obesity')

    // Then: Should return Drug X
    expect(result.length).toBe(1)
    expect(result[0].drugName).toBe('Drug X')
  })

  it('should return all groups when query is empty', () => {
    // Given: Multiple drug groups
    const mockDrugGroups: DrugGroup[] = [
      {
        drugName: 'Drug 1',
        normalizedName: 'drug 1',
        papers: [],
        trials: [],
        pressReleases: [],
        irDecks: [],
        totalResults: 0,
      },
      {
        drugName: 'Drug 2',
        normalizedName: 'drug 2',
        papers: [],
        trials: [],
        pressReleases: [],
        irDecks: [],
        totalResults: 0,
      },
    ]

    // When: Filtering with empty query
    const result = DrugGroupingService.filterDrugGroups(mockDrugGroups, '')

    // Then: Should return all groups
    expect(result.length).toBe(2)
  })

  it('should be case insensitive', () => {
    // Given: Drug groups
    const mockDrugGroups: DrugGroup[] = [
      {
        drugName: 'Semaglutide',
        normalizedName: 'semaglutide',
        papers: [],
        trials: [],
        pressReleases: [],
        irDecks: [],
        totalResults: 0,
      },
    ]

    // When: Filtering with different cases
    const resultLower = DrugGroupingService.filterDrugGroups(mockDrugGroups, 'semaglutide')
    const resultUpper = DrugGroupingService.filterDrugGroups(mockDrugGroups, 'SEMAGLUTIDE')
    const resultMixed = DrugGroupingService.filterDrugGroups(mockDrugGroups, 'SeMaGlUtIdE')

    // Then: All should return the drug
    expect(resultLower.length).toBe(1)
    expect(resultUpper.length).toBe(1)
    expect(resultMixed.length).toBe(1)
  })
})
