import { describe, it, expect } from 'vitest'
import { PipelineLLMService } from '@/services/pipelineLLMService'
import type { DrugGroup } from '@/services/drugGroupingService'

describe('PipelineLLMService', () => {
  describe('getTopDrugs', () => {
    it('should return top drugs sorted by combined papers and trials count', () => {
      // Arrange
      const drugGroups: DrugGroup[] = [
        {
          drugName: 'Aspirin',
          normalizedName: 'aspirin',
          papers: [{} as any, {} as any], // 2 papers
          trials: [{} as any], // 1 trial
          pressReleases: [],
          irDecks: [],
          totalResults: 3,
        },
        {
          drugName: 'Semaglutide',
          normalizedName: 'semaglutide',
          papers: [{} as any, {} as any, {} as any], // 3 papers
          trials: [{} as any, {} as any], // 2 trials
          pressReleases: [],
          irDecks: [],
          totalResults: 5,
        },
        {
          drugName: 'Metformin',
          normalizedName: 'metformin',
          papers: [{} as any], // 1 paper
          trials: [], // 0 trials
          pressReleases: [],
          irDecks: [],
          totalResults: 1,
        },
      ]

      // Act
      const result = PipelineLLMService.getTopDrugs(drugGroups, 2)

      // Assert
      expect(result).toHaveLength(2)
      expect(result[0].drugName).toBe('Semaglutide') // 5 total (3+2)
      expect(result[1].drugName).toBe('Aspirin') // 3 total (2+1)
    })

    it('should handle limit greater than available drugs', () => {
      // Arrange
      const drugGroups: DrugGroup[] = [
        {
          drugName: 'Aspirin',
          normalizedName: 'aspirin',
          papers: [],
          trials: [{} as any],
          pressReleases: [],
          irDecks: [],
          totalResults: 1,
        },
      ]

      // Act
      const result = PipelineLLMService.getTopDrugs(drugGroups, 10)

      // Assert
      expect(result).toHaveLength(1)
      expect(result[0].drugName).toBe('Aspirin')
    })
  })

  describe('willBeProcessed', () => {
    it('should return true if drug is in top N', () => {
      // Arrange
      const drugGroups: DrugGroup[] = [
        {
          drugName: 'TopDrug',
          normalizedName: 'topdrug',
          papers: [{} as any, {} as any, {} as any],
          trials: [{} as any, {} as any],
          pressReleases: [],
          irDecks: [],
          totalResults: 5,
        },
        {
          drugName: 'LowDrug',
          normalizedName: 'lowdrug',
          papers: [{} as any],
          trials: [],
          pressReleases: [],
          irDecks: [],
          totalResults: 1,
        },
      ]

      // Act
      const result = PipelineLLMService.willBeProcessed(drugGroups[0], drugGroups, 1)

      // Assert
      expect(result).toBe(true)
    })

    it('should return false if drug is not in top N', () => {
      // Arrange
      const drugGroups: DrugGroup[] = [
        {
          drugName: 'TopDrug',
          normalizedName: 'topdrug',
          papers: [{} as any, {} as any, {} as any],
          trials: [{} as any, {} as any],
          pressReleases: [],
          irDecks: [],
          totalResults: 5,
        },
        {
          drugName: 'LowDrug',
          normalizedName: 'lowdrug',
          papers: [{} as any],
          trials: [],
          pressReleases: [],
          irDecks: [],
          totalResults: 1,
        },
      ]

      // Act
      const result = PipelineLLMService.willBeProcessed(drugGroups[1], drugGroups, 1)

      // Assert
      expect(result).toBe(false)
    })
  })

  describe('getProcessingStats', () => {
    it('should calculate correct statistics for drug processing', () => {
      // Arrange
      const drugGroups: DrugGroup[] = [
        {
          drugName: 'Drug A',
          normalizedName: 'drug a',
          papers: [{} as any, {} as any, {} as any],
          trials: [{} as any, {} as any],
          pressReleases: [],
          irDecks: [],
          totalResults: 5,
        },
        {
          drugName: 'Drug B',
          normalizedName: 'drug b',
          papers: [{} as any, {} as any],
          trials: [{} as any],
          pressReleases: [],
          irDecks: [],
          totalResults: 3,
        },
        {
          drugName: 'Drug C',
          normalizedName: 'drug c',
          papers: [{} as any],
          trials: [],
          pressReleases: [],
          irDecks: [],
          totalResults: 1,
        },
      ]

      // Act
      const stats = PipelineLLMService.getProcessingStats(drugGroups, 2)

      // Assert
      expect(stats.total).toBe(3)
      expect(stats.willProcess).toBe(2)
      expect(stats.willSkip).toBe(1)
      expect(stats.topDrugs).toHaveLength(2)
      expect(stats.topDrugs[0]).toEqual({
        name: 'Drug A',
        paperCount: 3,
        trialCount: 2,
        totalCount: 5,
      })
      expect(stats.topDrugs[1]).toEqual({
        name: 'Drug B',
        paperCount: 2,
        trialCount: 1,
        totalCount: 3,
      })
    })

    it('should handle when limit exceeds available drugs', () => {
      // Arrange
      const drugGroups: DrugGroup[] = [
        {
          drugName: 'Only Drug',
          normalizedName: 'only drug',
          papers: [{} as any],
          trials: [],
          pressReleases: [],
          irDecks: [],
          totalResults: 1,
        },
      ]

      // Act
      const stats = PipelineLLMService.getProcessingStats(drugGroups, 10)

      // Assert
      expect(stats.total).toBe(1)
      expect(stats.willProcess).toBe(1)
      expect(stats.willSkip).toBe(0)
    })
  })
})
