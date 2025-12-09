import { describe, it, expect } from 'vitest'
import { TrialRankingService } from '@/services/trialRankingService'
import type { ClinicalTrial } from '@/types/trials'

describe('TrialRankingService', () => {
  describe('rankTrials', () => {
    it('should rank trials by relevance score', () => {
      // Arrange
      const trials: ClinicalTrial[] = [
        {
          nctId: 'NCT00000001',
          briefTitle: 'Study of cancer treatment',
          overallStatus: 'Completed',
          phase: ['Phase 1'],
        },
        {
          nctId: 'NCT00000002',
          briefTitle: 'Study of diabetes with GLP-1',
          overallStatus: 'Recruiting',
          phase: ['Phase 3'],
          startDate: '2024-01-01',
        },
      ]

      // Act
      const result = TrialRankingService.rankTrials(trials, 'diabetes GLP-1')

      // Assert
      expect(result).toHaveLength(2)
      expect(result[0].nctId).toBe('NCT00000002') // Higher rank
      expect(result[1].nctId).toBe('NCT00000001') // Lower rank
      expect(result[0].rankScore).toBeGreaterThan(result[1].rankScore)
    })

    it('should prioritize recruiting trials over completed', () => {
      // Arrange
      const trials: ClinicalTrial[] = [
        {
          nctId: 'NCT00000001',
          briefTitle: 'Diabetes study',
          overallStatus: 'Completed',
          phase: ['Phase 2'],
        },
        {
          nctId: 'NCT00000002',
          briefTitle: 'Diabetes study',
          overallStatus: 'Recruiting',
          phase: ['Phase 2'],
        },
      ]

      // Act
      const result = TrialRankingService.rankTrials(trials, 'diabetes')

      // Assert
      expect(result[0].nctId).toBe('NCT00000002') // Recruiting first
      expect(result[0].rankReasons).toContain('Actively recruiting')
    })

    it('should prioritize higher phase trials', () => {
      // Arrange
      const trials: ClinicalTrial[] = [
        {
          nctId: 'NCT00000001',
          briefTitle: 'Cancer treatment study',
          overallStatus: 'Recruiting',
          phase: ['Phase 1'],
        },
        {
          nctId: 'NCT00000002',
          briefTitle: 'Cancer treatment study',
          overallStatus: 'Recruiting',
          phase: ['Phase 3'],
        },
      ]

      // Act
      const result = TrialRankingService.rankTrials(trials, 'cancer')

      // Assert
      expect(result[0].nctId).toBe('NCT00000002') // Phase 3 first
      expect(result[0].rankReasons).toContain('Advanced phase')
    })

    it('should prioritize recent trials', () => {
      // Arrange
      const recentDate = new Date()
      recentDate.setMonth(recentDate.getMonth() - 2) // 2 months ago

      const oldDate = new Date()
      oldDate.setFullYear(oldDate.getFullYear() - 3) // 3 years ago

      const trials: ClinicalTrial[] = [
        {
          nctId: 'NCT00000001',
          briefTitle: 'Diabetes study',
          overallStatus: 'Recruiting',
          phase: ['Phase 2'],
          startDate: oldDate.toISOString(),
        },
        {
          nctId: 'NCT00000002',
          briefTitle: 'Diabetes study',
          overallStatus: 'Recruiting',
          phase: ['Phase 2'],
          startDate: recentDate.toISOString(),
        },
      ]

      // Act
      const result = TrialRankingService.rankTrials(trials, 'diabetes')

      // Assert
      expect(result[0].nctId).toBe('NCT00000002') // Recent trial first
      expect(result[0].rankReasons).toContain('Recent trial')
    })

    it('should handle trials with missing data', () => {
      // Arrange
      const trials: ClinicalTrial[] = [
        {
          nctId: 'NCT00000001',
          briefTitle: 'Incomplete trial data',
          overallStatus: 'Unknown',
          // No phase, no startDate
        },
      ]

      // Act
      const result = TrialRankingService.rankTrials(trials, 'trial')

      // Assert
      expect(result).toHaveLength(1)
      expect(result[0].rankScore).toBeGreaterThanOrEqual(0)
      expect(result[0].rankReasons).toBeDefined()
    })

    it('should include title match in rank reasons', () => {
      // Arrange
      const trials: ClinicalTrial[] = [
        {
          nctId: 'NCT00000001',
          briefTitle: 'Study of semaglutide in type 2 diabetes patients',
          overallStatus: 'Recruiting',
          phase: ['Phase 3'],
        },
      ]

      // Act
      const result = TrialRankingService.rankTrials(trials, 'semaglutide diabetes')

      // Assert
      expect(result[0].rankReasons).toContain('Title match')
    })

    it('should sort trials in descending order by score', () => {
      // Arrange
      const trials: ClinicalTrial[] = [
        {
          nctId: 'NCT00000001',
          briefTitle: 'Low relevance study',
          overallStatus: 'Terminated',
          phase: ['Phase 1'],
        },
        {
          nctId: 'NCT00000002',
          briefTitle: 'Medium relevance',
          overallStatus: 'Completed',
          phase: ['Phase 2'],
        },
        {
          nctId: 'NCT00000003',
          briefTitle: 'High relevance study here',
          overallStatus: 'Recruiting',
          phase: ['Phase 3'],
          startDate: '2024-01-01',
        },
      ]

      // Act
      const result = TrialRankingService.rankTrials(trials, 'study relevance')

      // Assert
      expect(result[0].rankScore).toBeGreaterThanOrEqual(result[1].rankScore)
      expect(result[1].rankScore).toBeGreaterThanOrEqual(result[2].rankScore)
    })
  })
})
