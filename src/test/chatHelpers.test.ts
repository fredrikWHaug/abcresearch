import { describe, it, expect } from 'vitest'
import {
  buildConversationContext,
  detectSearchIntent,
  extractSearchTerms,
  generateSearchSuggestions,
  type ChatMessage
} from '../../api/utils/chatHelpers'

/**
 * Unit Tests for ABC-41: ChatAPI Helper Functions
 * 
 * Tests core functionality for dynamic AI responses:
 * - Conversation context building
 * - Search intent detection
 * - Search term extraction
 */

describe('ABC-41: ChatAPI Helpers', () => {
  describe('buildConversationContext', () => {
    it('should build context from chat history', () => {
      const history: ChatMessage[] = [
        { type: 'user', message: 'Hello' },
        { type: 'system', message: 'Hi there!' },
        { type: 'user', message: 'How are you?' }
      ]

      const context = buildConversationContext(history)

      expect(context).toContain('User: Hello')
      expect(context).toContain('Assistant: Hi there!')
      expect(context).toContain('User: How are you?')
    })

    it('should limit to last 6 messages', () => {
      const history: ChatMessage[] = Array.from({ length: 10 }, (_, i) => ({
        type: 'user' as const,
        message: `Message ${i}`
      }))

      const context = buildConversationContext(history)

      // Should NOT contain early messages
      expect(context).not.toContain('Message 0')
      expect(context).not.toContain('Message 3')
      
      // Should contain last 6
      expect(context).toContain('Message 4')
      expect(context).toContain('Message 9')
    })

    it('should return empty string for empty history', () => {
      const context = buildConversationContext([])
      expect(context).toBe('')
    })
  })

  describe('detectSearchIntent', () => {
    it('should detect search keywords', () => {
      expect(detectSearchIntent('search for GLP-1')).toBe(true)
      expect(detectSearchIntent('find clinical trials')).toBe(true)
      expect(detectSearchIntent('show me papers')).toBe(true)
      expect(detectSearchIntent('look for studies')).toBe(true)
    })

    it('should not detect search in casual conversation', () => {
      expect(detectSearchIntent('Hello, how are you?')).toBe(false)
      expect(detectSearchIntent('Thanks for your help!')).toBe(false)
      expect(detectSearchIntent('What can you do?')).toBe(false)
    })
  })

  describe('extractSearchTerms', () => {
    it('should extract medical terms from query', () => {
      const terms = extractSearchTerms('Can you search for GLP-1 trials?')
      
      expect(terms).toContain('glp-1')
      expect(terms).toContain('trials')
      expect(terms).not.toContain('can')
      expect(terms).not.toContain('you')
    })

    it('should filter common words', () => {
      const terms = extractSearchTerms('Please help me find diabetes research')
      
      expect(terms).toContain('diabetes')
      expect(terms).not.toContain('please')
      expect(terms).not.toContain('help')
      expect(terms).not.toContain('me')
    })

    it('should handle queries with no meaningful terms', () => {
      const terms = extractSearchTerms('can you help me please')
      
      // All words are common, should be empty or just 'me'
      expect(terms.length).toBeLessThan(10)
    })
  })

  describe('generateSearchSuggestions', () => {
    it('should generate suggestion for search query', () => {
      const suggestions = generateSearchSuggestions('search for GLP-1 clinical trials')
      
      expect(suggestions).toHaveLength(1)
      expect(suggestions[0].query).toContain('glp-1')
      expect(suggestions[0].label).toContain('Search for')
    })

    it('should return empty array for non-search query', () => {
      const suggestions = generateSearchSuggestions('Hello, how are you?')
      
      expect(suggestions).toHaveLength(0)
    })

    it('should include description in suggestion', () => {
      const suggestions = generateSearchSuggestions('find diabetes trials')
      
      expect(suggestions[0].description).toContain('Find clinical trials')
    })
  })
})

