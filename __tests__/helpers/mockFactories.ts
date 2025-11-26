/**
 * Mock Data Factories
 * Create consistent test data with sensible defaults
 */

import type { ClinicalTrial } from '@/types/trials'
import type { PubMedArticle } from '@/types/papers'

/**
 * Create a mock clinical trial
 */
export function createMockTrial(overrides?: Partial<ClinicalTrial>): ClinicalTrial {
  const defaultTrial: ClinicalTrial = {
    nctId: `NCT${Math.floor(Math.random() * 100000000)}`,
    briefTitle: 'Test Clinical Trial',
    officialTitle: 'Official Test Clinical Trial Title',
    overallStatus: 'Recruiting',
    phase: ['Phase 2'],
    conditions: ['Test Condition'],
    interventions: ['Test Drug'],
    sponsors: { lead: 'Test Sponsor' },
    enrollment: 100,
    startDate: '2024-01-01',
    completionDate: '2025-12-31',
    locations: [{ 
      facility: 'Test Hospital', 
      city: 'Boston', 
      country: 'USA' 
    }],
    studyType: 'Interventional',
  }

  return { ...defaultTrial, ...overrides }
}

/**
 * Create a mock PubMed article
 */
export function createMockPaper(overrides?: Partial<PubMedArticle>): PubMedArticle {
  const defaultPaper: PubMedArticle = {
    pmid: `${Math.floor(Math.random() * 100000000)}`,
    title: 'Test Research Paper',
    abstract: 'This is a test paper abstract describing the research methodology and findings.',
    journal: 'Test Journal of Medicine',
    publicationDate: '2024-01-15',
    authors: ['Test Author', 'Second Author'],
    doi: `10.1234/test.2024.${Math.floor(Math.random() * 1000)}`,
    relevanceScore: 85,
        fullTextLinks: {
            pubmed: `https://pubmed.ncbi.nlm.nih.gov/${Math.floor(Math.random() * 100000000)}/`,
        },
  }

  return { ...defaultPaper, ...overrides }
}

/**
 * Create a mock project
 */
export function createMockProject(overrides?: {
  id?: number
  name?: string
  description?: string
  user_id?: string
}) {
  return {
    id: overrides?.id || Math.floor(Math.random() * 10000),
    name: overrides?.name || 'Test Project',
    description: overrides?.description || 'Test project description',
    user_id: overrides?.user_id || 'test-user-id',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

/**
 * Create a mock user
 */
export function createMockUser(overrides?: {
  id?: string
  email?: string
}) {
  return {
    id: overrides?.id || `test-user-${Date.now()}`,
    email: overrides?.email || 'test@abcresearch.test',
    created_at: new Date().toISOString(),
  }
}

/**
 * Create a mock auth session
 */
export function createMockSession(user?: ReturnType<typeof createMockUser>) {
  const mockUser = user || createMockUser()
  
  return {
    user: mockUser,
    access_token: 'mock-access-token',
    refresh_token: 'mock-refresh-token',
    expires_at: Date.now() + 3600000, // 1 hour from now
    expires_in: 3600,
  }
}

/**
 * Create multiple mock trials
 */
export function createMockTrials(count: number, overrides?: Partial<ClinicalTrial>): ClinicalTrial[] {
  return Array.from({ length: count }, (_, i) => 
    createMockTrial({ 
      ...overrides, 
      nctId: `NCT${String(i).padStart(8, '0')}` 
    })
  )
}

/**
 * Create multiple mock papers
 */
export function createMockPapers(count: number, overrides?: Partial<PubMedArticle>): PubMedArticle[] {
  return Array.from({ length: count }, (_, i) => 
    createMockPaper({ 
      ...overrides, 
      pmid: `${String(i).padStart(8, '0')}` 
    })
  )
}

