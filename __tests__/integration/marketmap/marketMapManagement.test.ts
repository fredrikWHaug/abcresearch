/**
 * Integration Tests: Market Map Management
 *
 * These tests verify the complete market map CRUD flow:
 * - Saving new market maps with trials and slides data
 * - Loading user market maps (all and by project)
 * - Retrieving specific market map by ID
 * - Updating market map data
 * - Deleting market maps
 * - Chat history persistence
 * - Papers data storage
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  MarketMapService,
  type CreateMarketMapData,
  type SavedMarketMap,
} from '@/services/marketMapService'
import { supabase } from '@/lib/supabase'
import type { ClinicalTrial } from '@/types/trials'
import type { SlideData } from '@/services/slideAPI'

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  },
}))

// Mock trial and paper services for background dual-write
vi.mock('@/services/trialService', () => ({
  upsertTrial: vi.fn().mockResolvedValue('trial-id-123'),
  linkTrialToProject: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/services/paperService', () => ({
  upsertPaper: vi.fn().mockResolvedValue('paper-id-456'),
  linkPaperToProject: vi.fn().mockResolvedValue(undefined),
}))

describe('Market Map Management - Save Market Map', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should save a new market map with trials and slide data', async () => {
    // Given: Authenticated user
    const mockUser = { id: 'user-123', email: 'test@example.com' }
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any)

    const mockTrials: ClinicalTrial[] = [
      {
        nctId: 'NCT123',
        briefTitle: 'Diabetes Trial',
        overallStatus: 'RECRUITING',
        phase: ['Phase 3'],
      },
    ]

    const mockSlideData: SlideData = {
      title: 'Diabetes Drug Landscape',
      subtitle: '',
      keyMetrics: [],
      competitiveLandscape: [],
      trendAnalysis: '',
      recommendation: '',
      chartData: {
        phaseChart: [],
        statusChart: [],
        sponsorChart: [],
        yearChart: [],
      },
    }

    const marketMapData: CreateMarketMapData = {
      name: 'Diabetes Market Map',
      query: 'diabetes drugs',
      trials_data: mockTrials,
      slide_data: mockSlideData,
    }

    const mockSavedMap: SavedMarketMap = {
      id: 1,
      user_id: 'user-123',
      project_id: null,
      name: 'Diabetes Market Map',
      query: 'diabetes drugs',
      trials_data: mockTrials,
      slide_data: mockSlideData,
      chat_history: null,
      papers_data: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    }

    const mockFrom = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockSavedMap, error: null }),
    }

    vi.mocked(supabase.from).mockReturnValue(mockFrom as any)

    // When: Saving market map
    const result = await MarketMapService.saveMarketMap(marketMapData, null)

    // Then: Should return saved market map
    expect(result).toEqual(mockSavedMap)
    expect(supabase.from).toHaveBeenCalledWith('market_maps')
    expect(mockFrom.insert).toHaveBeenCalledWith({
      user_id: 'user-123',
      project_id: null,
      name: 'Diabetes Market Map',
      query: 'diabetes drugs',
      trials_data: mockTrials,
      slide_data: mockSlideData,
      chat_history: null,
      papers_data: null,
    })
  })

  it('should save market map with project association', async () => {
    // Given: Authenticated user and project ID
    const mockUser = { id: 'user-456', email: 'test@example.com' }
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any)

    const marketMapData: CreateMarketMapData = {
      name: 'Project Map',
      query: 'test query',
      trials_data: [],
      slide_data: { title: "", subtitle: "", keyMetrics: [], competitiveLandscape: [], trendAnalysis: "", recommendation: "", chartData: { phaseChart: [], statusChart: [], sponsorChart: [], yearChart: [] } },
    }

    const mockSavedMap: SavedMarketMap = {
      id: 2,
      user_id: 'user-456',
      project_id: 42,
      name: 'Project Map',
      query: 'test query',
      trials_data: [],
      slide_data: { title: "", subtitle: "", keyMetrics: [], competitiveLandscape: [], trendAnalysis: "", recommendation: "", chartData: { phaseChart: [], statusChart: [], sponsorChart: [], yearChart: [] } },
      chat_history: null,
      papers_data: null,
      created_at: '2024-01-02T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
    }

    const mockFrom = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockSavedMap, error: null }),
    }

    vi.mocked(supabase.from).mockReturnValue(mockFrom as any)

    // When: Saving with project ID
    const result = await MarketMapService.saveMarketMap(marketMapData, 42)

    // Then: Should link to project
    expect(result.project_id).toBe(42)
    expect(mockFrom.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        project_id: 42,
      })
    )
  })

  it('should save market map with chat history', async () => {
    // Given: Market map with chat history
    const mockUser = { id: 'user-789', email: 'test@example.com' }
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any)

    const chatHistory = [
      { type: 'user' as const, message: 'Show me diabetes drugs' },
      { type: 'system' as const, message: 'Here are the results...' },
    ]

    const marketMapData: CreateMarketMapData = {
      name: 'Map with Chat',
      query: 'diabetes',
      trials_data: [],
      slide_data: { title: "", subtitle: "", keyMetrics: [], competitiveLandscape: [], trendAnalysis: "", recommendation: "", chartData: { phaseChart: [], statusChart: [], sponsorChart: [], yearChart: [] } },
      chat_history: chatHistory,
    }

    const mockSavedMap: SavedMarketMap = {
      id: 3,
      user_id: 'user-789',
      project_id: null,
      name: 'Map with Chat',
      query: 'diabetes',
      trials_data: [],
      slide_data: { title: "", subtitle: "", keyMetrics: [], competitiveLandscape: [], trendAnalysis: "", recommendation: "", chartData: { phaseChart: [], statusChart: [], sponsorChart: [], yearChart: [] } },
      chat_history: chatHistory,
      papers_data: null,
      created_at: '2024-01-03T00:00:00Z',
      updated_at: '2024-01-03T00:00:00Z',
    }

    const mockFrom = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockSavedMap, error: null }),
    }

    vi.mocked(supabase.from).mockReturnValue(mockFrom as any)

    // When: Saving with chat history
    const result = await MarketMapService.saveMarketMap(marketMapData, null)

    // Then: Should persist chat history
    expect(result.chat_history).toEqual(chatHistory)
  })

  it('should throw error when user is not authenticated', async () => {
    // Given: No authenticated user
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: null },
      error: null,
    } as any)

    const marketMapData: CreateMarketMapData = {
      name: 'Test Map',
      query: 'test',
      trials_data: [],
      slide_data: { title: "", subtitle: "", keyMetrics: [], competitiveLandscape: [], trendAnalysis: "", recommendation: "", chartData: { phaseChart: [], statusChart: [], sponsorChart: [], yearChart: [] } },
    }

    // When/Then: Should throw authentication error
    await expect(
      MarketMapService.saveMarketMap(marketMapData, null)
    ).rejects.toThrow('User must be authenticated to save market maps')
  })

  it('should throw error when database operation fails', async () => {
    // Given: Authenticated user but DB error
    const mockUser = { id: 'user-999', email: 'test@example.com' }
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as any)

    const mockFrom = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' },
      }),
    }

    vi.mocked(supabase.from).mockReturnValue(mockFrom as any)

    const marketMapData: CreateMarketMapData = {
      name: 'Test Map',
      query: 'test',
      trials_data: [],
      slide_data: { title: "", subtitle: "", keyMetrics: [], competitiveLandscape: [], trendAnalysis: "", recommendation: "", chartData: { phaseChart: [], statusChart: [], sponsorChart: [], yearChart: [] } },
    }

    // When/Then: Should throw database error
    await expect(
      MarketMapService.saveMarketMap(marketMapData, null)
    ).rejects.toThrow()
  })
})

describe('Market Map Management - Get Market Maps', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fetch all market maps for user', async () => {
    // Given: User with market maps
    const mockMaps: SavedMarketMap[] = [
      {
        id: 1,
        user_id: 'user-123',
        project_id: null,
        name: 'Map A',
        query: 'query a',
        trials_data: [],
        slide_data: { title: "", subtitle: "", keyMetrics: [], competitiveLandscape: [], trendAnalysis: "", recommendation: "", chartData: { phaseChart: [], statusChart: [], sponsorChart: [], yearChart: [] } },
        chat_history: null,
        papers_data: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-03T00:00:00Z',
      },
      {
        id: 2,
        user_id: 'user-123',
        project_id: null,
        name: 'Map B',
        query: 'query b',
        trials_data: [],
        slide_data: { title: "", subtitle: "", keyMetrics: [], competitiveLandscape: [], trendAnalysis: "", recommendation: "", chartData: { phaseChart: [], statusChart: [], sponsorChart: [], yearChart: [] } },
        chat_history: null,
        papers_data: null,
        created_at: '2024-01-02T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
      },
    ]

    const mockFrom = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockMaps, error: null }),
    }

    vi.mocked(supabase.from).mockReturnValue(mockFrom as any)

    // When: Fetching all market maps
    const result = await MarketMapService.getUserMarketMaps()

    // Then: Should return all maps
    expect(result).toEqual(mockMaps)
    expect(mockFrom.select).toHaveBeenCalledWith('*')
    expect(mockFrom.order).toHaveBeenCalledWith('created_at', { ascending: false })
  })

  it('should filter market maps by project ID', async () => {
    // Given: Market maps for specific project
    const mockMaps: SavedMarketMap[] = [
      {
        id: 5,
        user_id: 'user-456',
        project_id: 10,
        name: 'Project 10 Map',
        query: 'query',
        trials_data: [],
        slide_data: { title: "", subtitle: "", keyMetrics: [], competitiveLandscape: [], trendAnalysis: "", recommendation: "", chartData: { phaseChart: [], statusChart: [], sponsorChart: [], yearChart: [] } },
        chat_history: null,
        papers_data: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
    ]

    const mockFrom = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: mockMaps, error: null }),
    }

    vi.mocked(supabase.from).mockReturnValue(mockFrom as any)

    // When: Fetching maps for project 10
    const result = await MarketMapService.getUserMarketMaps(10)

    // Then: Should filter by project_id
    expect(result).toEqual(mockMaps)
    expect(mockFrom.eq).toHaveBeenCalledWith('project_id', 10)
  })

  it('should return empty array when no market maps exist', async () => {
    // Given: No market maps
    const mockFrom = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    }

    vi.mocked(supabase.from).mockReturnValue(mockFrom as any)

    // When: Fetching market maps
    const result = await MarketMapService.getUserMarketMaps()

    // Then: Should return empty array
    expect(result).toEqual([])
  })
})

describe('Market Map Management - Get Single Market Map', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fetch a specific market map by ID', async () => {
    // Given: Market map exists
    const mockMap: SavedMarketMap = {
      id: 42,
      user_id: 'user-123',
      project_id: null,
      name: 'Specific Map',
      query: 'test query',
      trials_data: [],
      slide_data: { title: "", subtitle: "", keyMetrics: [], competitiveLandscape: [], trendAnalysis: "", recommendation: "", chartData: { phaseChart: [], statusChart: [], sponsorChart: [], yearChart: [] } },
      chat_history: null,
      papers_data: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    }

    const mockFrom = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockMap, error: null }),
    }

    vi.mocked(supabase.from).mockReturnValue(mockFrom as any)

    // When: Fetching map by ID
    const result = await MarketMapService.getMarketMap(42)

    // Then: Should return the specific map
    expect(result).toEqual(mockMap)
    expect(mockFrom.eq).toHaveBeenCalledWith('id', 42)
  })

  it('should throw error when market map does not exist', async () => {
    // Given: Market map not found
    const mockFrom = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      }),
    }

    vi.mocked(supabase.from).mockReturnValue(mockFrom as any)

    // When/Then: Should throw error
    await expect(MarketMapService.getMarketMap(999)).rejects.toThrow()
  })
})

describe('Market Map Management - Update Market Map', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should update market map name', async () => {
    // Given: Existing market map
    const updatedMap: SavedMarketMap = {
      id: 1,
      user_id: 'user-123',
      project_id: null,
      name: 'Updated Name',
      query: 'original query',
      trials_data: [],
      slide_data: { title: "", subtitle: "", keyMetrics: [], competitiveLandscape: [], trendAnalysis: "", recommendation: "", chartData: { phaseChart: [], statusChart: [], sponsorChart: [], yearChart: [] } },
      chat_history: null,
      papers_data: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-05T00:00:00Z',
    }

    const mockFrom = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: updatedMap, error: null }),
    }

    vi.mocked(supabase.from).mockReturnValue(mockFrom as any)

    // When: Updating name
    const result = await MarketMapService.updateMarketMap(1, {
      name: 'Updated Name',
    })

    // Then: Should update and return map
    expect(result.name).toBe('Updated Name')
    expect(mockFrom.update).toHaveBeenCalled()
    expect(mockFrom.eq).toHaveBeenCalledWith('id', 1)
  })

  it('should update slide data', async () => {
    // Given: Existing market map
    const newSlideData: SlideData = {
      title: 'New Title',
      subtitle: 'Updated subtitle',
      keyMetrics: [],
      competitiveLandscape: [],
      trendAnalysis: '',
      recommendation: '',
      chartData: {
        phaseChart: [],
        statusChart: [],
        sponsorChart: [],
        yearChart: [],
      },
    }

    const updatedMap: SavedMarketMap = {
      id: 2,
      user_id: 'user-123',
      project_id: null,
      name: 'Map',
      query: 'query',
      trials_data: [],
      slide_data: newSlideData,
      chat_history: null,
      papers_data: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-05T00:00:00Z',
    }

    const mockFrom = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: updatedMap, error: null }),
    }

    vi.mocked(supabase.from).mockReturnValue(mockFrom as any)

    // When: Updating slide data
    const result = await MarketMapService.updateMarketMap(2, {
      slide_data: newSlideData,
    })

    // Then: Should update slide data
    expect(result.slide_data).toEqual(newSlideData)
  })

  it('should update the updated_at timestamp', async () => {
    // Given: Market map being updated
    let capturedUpdate: any = null

    const mockFrom = {
      update: vi.fn().mockImplementation((updates) => {
        capturedUpdate = updates
        return mockFrom
      }),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 1, updated_at: '2024-01-05T00:00:00Z' },
        error: null,
      }),
    }

    vi.mocked(supabase.from).mockReturnValue(mockFrom as any)

    // When: Updating market map
    await MarketMapService.updateMarketMap(1, { name: 'New Name' })

    // Then: Should include updated_at timestamp
    expect(capturedUpdate).toHaveProperty('updated_at')
    expect(capturedUpdate.updated_at).toBeTruthy()
  })
})

describe('Market Map Management - Delete Market Map', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should delete a market map by ID', async () => {
    // Given: Existing market map
    const mockFrom = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    }

    vi.mocked(supabase.from).mockReturnValue(mockFrom as any)

    // When: Deleting market map
    await MarketMapService.deleteMarketMap(123)

    // Then: Should call delete with correct ID
    expect(supabase.from).toHaveBeenCalledWith('market_maps')
    expect(mockFrom.delete).toHaveBeenCalled()
    expect(mockFrom.eq).toHaveBeenCalledWith('id', 123)
  })

  it('should throw error when delete fails', async () => {
    // Given: Delete operation fails
    const mockFrom = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        error: { message: 'Cannot delete market map' },
      }),
    }

    vi.mocked(supabase.from).mockReturnValue(mockFrom as any)

    // When/Then: Should throw error
    await expect(MarketMapService.deleteMarketMap(456)).rejects.toThrow()
  })
})
