import { describe, it, expect } from 'vitest'
import { DrugGroupingService } from '@/services/drugGroupingService'
import type { DrugGroup } from '@/services/drugGroupingService'
import type { PubMedArticle } from '@/types/papers'
import type { ClinicalTrial } from '@/types/trials'

describe('DrugGroupingService', () => {
  describe('filterDrugGroups', () => {
    it('should return all groups when query is empty', () => {
      // Arrange
      const groups: DrugGroup[] = [
        {
          drugName: 'Semaglutide',
          normalizedName: 'semaglutide',
          papers: [],
          trials: [],
          pressReleases: [],
          irDecks: [],
          totalResults: 0,
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

      // Act
      const result = DrugGroupingService.filterDrugGroups(groups, '')

      // Assert
      expect(result).toHaveLength(2)
      expect(result).toEqual(groups)
    })

    it('should filter by drug name', () => {
      // Arrange
      const groups: DrugGroup[] = [
        {
          drugName: 'Semaglutide',
          normalizedName: 'semaglutide',
          papers: [],
          trials: [],
          pressReleases: [],
          irDecks: [],
          totalResults: 0,
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

      // Act
      const result = DrugGroupingService.filterDrugGroups(groups, 'sema')

      // Assert
      expect(result).toHaveLength(1)
      expect(result[0].drugName).toBe('Semaglutide')
    })

    it('should filter by paper title', () => {
      // Arrange
      const groups: DrugGroup[] = [
        {
          drugName: 'Drug A',
          normalizedName: 'drug a',
          papers: [
            {
              pmid: '12345',
              title: 'Study of GLP-1 agonists in diabetes',
              abstract: 'This study examines...',
              authors: [],
              journal: 'Journal',
              publicationDate: '2024-01-01',
              relevanceScore: 0.9,
              fullTextLinks: { pubmed: 'link' },
            } as PubMedArticle,
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
              pmid: '67890',
              title: 'Cardiovascular outcomes',
              abstract: 'Results show...',
              authors: [],
              journal: 'Journal',
              publicationDate: '2024-01-01',
              relevanceScore: 0.8,
              fullTextLinks: { pubmed: 'link' },
            } as PubMedArticle,
          ],
          trials: [],
          pressReleases: [],
          irDecks: [],
          totalResults: 1,
        },
      ]

      // Act
      const result = DrugGroupingService.filterDrugGroups(groups, 'GLP-1')

      // Assert
      expect(result).toHaveLength(1)
      expect(result[0].drugName).toBe('Drug A')
    })

    it('should filter by paper abstract', () => {
      // Arrange
      const groups: DrugGroup[] = [
        {
          drugName: 'Drug A',
          normalizedName: 'drug a',
          papers: [
            {
              pmid: '12345',
              title: 'Study title',
              abstract: 'This study examines obesity treatment',
              authors: [],
              journal: 'Journal',
              publicationDate: '2024-01-01',
              relevanceScore: 0.9,
              fullTextLinks: { pubmed: 'link' },
            } as PubMedArticle,
          ],
          trials: [],
          pressReleases: [],
          irDecks: [],
          totalResults: 1,
        },
      ]

      // Act
      const result = DrugGroupingService.filterDrugGroups(groups, 'obesity')

      // Assert
      expect(result).toHaveLength(1)
      expect(result[0].drugName).toBe('Drug A')
    })

    it('should filter by trial title', () => {
      // Arrange
      const groups: DrugGroup[] = [
        {
          drugName: 'Drug A',
          normalizedName: 'drug a',
          papers: [],
          trials: [
            {
              nctId: 'NCT12345678',
              briefTitle: 'Phase 3 study of diabetes treatment',
              overallStatus: 'Recruiting',
            } as ClinicalTrial,
          ],
          pressReleases: [],
          irDecks: [],
          totalResults: 1,
        },
        {
          drugName: 'Drug B',
          normalizedName: 'drug b',
          papers: [],
          trials: [
            {
              nctId: 'NCT87654321',
              briefTitle: 'Cancer immunotherapy trial',
              overallStatus: 'Active',
            } as ClinicalTrial,
          ],
          pressReleases: [],
          irDecks: [],
          totalResults: 1,
        },
      ]

      // Act
      const result = DrugGroupingService.filterDrugGroups(groups, 'diabetes')

      // Assert
      expect(result).toHaveLength(1)
      expect(result[0].drugName).toBe('Drug A')
    })

    it('should be case insensitive', () => {
      // Arrange
      const groups: DrugGroup[] = [
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

      // Act
      const result = DrugGroupingService.filterDrugGroups(groups, 'SEMAGLUTIDE')

      // Assert
      expect(result).toHaveLength(1)
      expect(result[0].drugName).toBe('Semaglutide')
    })

    it('should return empty array when no matches found', () => {
      // Arrange
      const groups: DrugGroup[] = [
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

      // Act
      const result = DrugGroupingService.filterDrugGroups(groups, 'nonexistent')

      // Assert
      expect(result).toHaveLength(0)
    })
  })
})
