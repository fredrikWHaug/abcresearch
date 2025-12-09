import { describe, it, expect } from 'vitest'
import { PipelineService } from '@/services/pipelineService'
import type { ClinicalTrial } from '@/types/trials'

describe('PipelineService', () => {
  describe('trialsToPipeline', () => {
    it('should convert a simple Phase 2 trial to a pipeline candidate', () => {
      // Arrange
      const trials: ClinicalTrial[] = [
        {
          nctId: 'NCT12345678',
          briefTitle: 'Study of Drug X in Diabetes',
          overallStatus: 'Recruiting',
          phase: ['Phase 2'],
          conditions: ['Type 2 Diabetes'],
          interventions: ['Drug: Semaglutide'],
          sponsors: {
            lead: 'Novo Nordisk',
          },
          startDate: '2024-01-15',
        },
      ]

      // Act
      const result = PipelineService.trialsToPipeline(trials)

      // Assert
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        scientificName: 'Semaglutide',
        sponsorCompany: 'Novo Nordisk',
        stage: 'Phase II',
        indications: ['Type 2 Diabetes'],
        lastTrialStartDate: '2024-01-15',
      })
    })

    it('should handle trials with no phase data', () => {
      // Arrange
      const trials: ClinicalTrial[] = [
        {
          nctId: 'NCT99999999',
          briefTitle: 'Early Research Study',
          overallStatus: 'Not yet recruiting',
          interventions: ['Drug: ExperimentalDrug'],
          sponsors: {
            lead: 'Research Institute',
          },
        },
      ]

      // Act
      const result = PipelineService.trialsToPipeline(trials)

      // Assert
      expect(result).toHaveLength(1)
      expect(result[0].stage).toBe('Discovery')
    })

    it('should merge multiple trials for the same drug', () => {
      // Arrange
      const trials: ClinicalTrial[] = [
        {
          nctId: 'NCT00000001',
          briefTitle: 'Phase 1 Trial',
          overallStatus: 'Completed',
          phase: ['Phase 1'],
          interventions: ['Drug: Aspirin'],
          sponsors: { lead: 'Company A' },
        },
        {
          nctId: 'NCT00000002',
          briefTitle: 'Phase 3 Trial',
          overallStatus: 'Recruiting',
          phase: ['Phase 3'],
          interventions: ['Drug: Aspirin'],
          sponsors: { lead: 'Company A' },
        },
      ]

      // Act
      const result = PipelineService.trialsToPipeline(trials)

      // Assert
      expect(result).toHaveLength(1)
      expect(result[0].scientificName).toBe('Aspirin')
      expect(result[0].stage).toBe('Phase III') // Should take the highest phase
    })

    it('should identify marketed drugs', () => {
      // Arrange
      const trials: ClinicalTrial[] = [
        {
          nctId: 'NCT11111111',
          briefTitle: 'Post-Marketing Study',
          overallStatus: 'Approved',
          phase: ['Phase 4'],
          interventions: ['Drug: Humira'],
          sponsors: { lead: 'AbbVie' },
        },
      ]

      // Act
      const result = PipelineService.trialsToPipeline(trials)

      // Assert
      expect(result).toHaveLength(1)
      expect(result[0].stage).toBe('Marketed')
    })
  })
})
