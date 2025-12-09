import { describe, it, expect } from 'vitest'
import { getStageBadgeColor, truncateText, chunkArray } from '@/services/pipelineExportService'

describe('pipelineExportService', () => {
  describe('getStageBadgeColor', () => {
    it('should return correct color for Marketed stage', () => {
      // Arrange & Act
      const color = getStageBadgeColor('Marketed')

      // Assert
      expect(color).toBe('10B981') // green-500
    })

    it('should return correct color for Phase III', () => {
      // Arrange & Act
      const color = getStageBadgeColor('Phase III')

      // Assert
      expect(color).toBe('3B82F6') // blue-500
    })

    it('should return correct color for Phase II', () => {
      // Arrange & Act
      const color = getStageBadgeColor('Phase II')

      // Assert
      expect(color).toBe('F59E0B') // yellow-500
    })

    it('should return correct color for Phase I', () => {
      // Arrange & Act
      const color = getStageBadgeColor('Phase I')

      // Assert
      expect(color).toBe('F97316') // orange-500
    })

    it('should return correct color for Pre-Clinical', () => {
      // Arrange & Act
      const color = getStageBadgeColor('Pre-Clinical')

      // Assert
      expect(color).toBe('A855F7') // purple-500
    })

    it('should return default gray for unknown stage', () => {
      // Arrange & Act
      const color = getStageBadgeColor('Unknown Stage')

      // Assert
      expect(color).toBe('6B7280') // gray-500
    })
  })

  describe('truncateText', () => {
    it('should return original text when shorter than max length', () => {
      // Arrange
      const text = 'Short text'

      // Act
      const result = truncateText(text, 20)

      // Assert
      expect(result).toBe('Short text')
    })

    it('should return original text when equal to max length', () => {
      // Arrange
      const text = 'Exactly ten'

      // Act
      const result = truncateText(text, 11)

      // Assert
      expect(result).toBe('Exactly ten')
    })

    it('should truncate text and add ellipsis when longer than max length', () => {
      // Arrange
      const text = 'This is a very long text that needs to be truncated'

      // Act
      const result = truncateText(text, 20)

      // Assert
      expect(result).toBe('This is a very long ...')
      expect(result.length).toBe(23) // 20 chars + '...'
    })

    it('should handle empty string', () => {
      // Arrange
      const text = ''

      // Act
      const result = truncateText(text, 10)

      // Assert
      expect(result).toBe('')
    })
  })

  describe('chunkArray', () => {
    it('should split array into chunks of specified size', () => {
      // Arrange
      const array = [1, 2, 3, 4, 5, 6, 7, 8]

      // Act
      const result = chunkArray(array, 3)

      // Assert
      expect(result).toEqual([
        [1, 2, 3],
        [4, 5, 6],
        [7, 8],
      ])
    })

    it('should handle array smaller than chunk size', () => {
      // Arrange
      const array = [1, 2, 3]

      // Act
      const result = chunkArray(array, 5)

      // Assert
      expect(result).toEqual([[1, 2, 3]])
    })

    it('should handle array perfectly divisible by chunk size', () => {
      // Arrange
      const array = [1, 2, 3, 4, 5, 6]

      // Act
      const result = chunkArray(array, 2)

      // Assert
      expect(result).toEqual([
        [1, 2],
        [3, 4],
        [5, 6],
      ])
    })

    it('should handle empty array', () => {
      // Arrange
      const array: number[] = []

      // Act
      const result = chunkArray(array, 3)

      // Assert
      expect(result).toEqual([])
    })

    it('should handle chunk size of 1', () => {
      // Arrange
      const array = [1, 2, 3]

      // Act
      const result = chunkArray(array, 1)

      // Assert
      expect(result).toEqual([[1], [2], [3]])
    })
  })
})
