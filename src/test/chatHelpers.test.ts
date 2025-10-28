import { describe, it, expect } from 'vitest'
import {
  buildConversationContext,
  detectSearchIntent,
  extractSearchTerms,
  generateSearchSuggestions,
  buildSystemPrompt,
  buildMessagesFromHistory,
  type ChatMessage,
  type ContextPaper
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
      
      // All words are common, should be empty
      expect(terms.length).toBeLessThan(10)
    })

    // ABC-45: Bug fix test - conversational words should be filtered
    it('should filter conversational filler words (ABC-45)', () => {
      const query = 'Good thanks. Can you help me search for GLP1 clinical trials please?'
      const terms = extractSearchTerms(query)
      
      // Should extract only meaningful term
      expect(terms).toContain('glp1')
      
      // Should NOT include conversational words
      expect(terms).not.toContain('good')
      expect(terms).not.toContain('thanks')
      expect(terms).not.toContain('please')
      
      // Should NOT include generic medical terms (too broad)
      expect(terms).not.toContain('clinical')
      expect(terms).not.toContain('trials')
    })

    it('should handle punctuation correctly (ABC-45)', () => {
      const terms = extractSearchTerms('Hello! Can you find diabetes, please?')
      
      expect(terms).toBe('diabetes')
      expect(terms).not.toContain('hello')
      expect(terms).not.toContain('please')
    })

    it('should handle typos and variations (ABC-45)', () => {
      const terms = extractSearchTerms('Can you search for GLP-1s pleas?')
      
      expect(terms).toBe('glp-1s')
      expect(terms).not.toContain('pleas') // Common typo of "please"
    })

    // ABC-46: Intelligent medical term detection tests
    it('should extract medical terms from conversational context (ABC-46)', () => {
      const query = 'Actually, pleas search for diabetes instead'
      const terms = extractSearchTerms(query)
      
      expect(terms).toBe('diabetes')
      expect(terms).not.toContain('actually')
      expect(terms).not.toContain('instead')
    })

    it('should detect medical codes with numbers/hyphens (ABC-46)', () => {
      const terms1 = extractSearchTerms('Show me GLP-1 trials')
      expect(terms1).toBe('glp-1')
      
      const terms2 = extractSearchTerms('Find IL-6 research')
      expect(terms2).toBe('il-6')
      
      const terms3 = extractSearchTerms('COVID-19 studies please')
      expect(terms3).toBe('covid-19')
    })

    it('should detect medical suffixes (ABC-46)', () => {
      expect(extractSearchTerms('find pembrolizumab trials')).toContain('pembrolizumab')
      expect(extractSearchTerms('arthritis research')).toContain('arthritis')
      expect(extractSearchTerms('tuberculosis studies')).toContain('tuberculosis')
    })

    it('should prioritize long medical terms over short words (ABC-46)', () => {
      const terms = extractSearchTerms('Can you help me find semaglutide please?')
      
      expect(terms).toBe('semaglutide')
      expect(terms).not.toContain('can')
      expect(terms).not.toContain('help')
    })

    it('should handle complex conversational queries (ABC-46)', () => {
      const query = 'Actually, could you just search for metformin instead of that other drug?'
      const terms = extractSearchTerms(query)
      
      expect(terms).toContain('metformin')
      expect(terms).not.toContain('actually')
      expect(terms).not.toContain('could')
      expect(terms).not.toContain('instead')
      expect(terms).not.toContain('other')
    })

    it('should filter past tense verbs (ABC-46)', () => {
      const query = 'I realized I wanted information about diabetes'
      const terms = extractSearchTerms(query)
      
      expect(terms).toBe('diabetes')
      expect(terms).not.toContain('realized')
      expect(terms).not.toContain('wanted')
    })

    it('should filter generic results word (ABC-46)', () => {
      const terms = extractSearchTerms('search for clinical trial results on Alzheimer\'s disease')
      
      expect(terms).toContain('alzheimer\'s')
      expect(terms).toContain('disease')
      expect(terms).not.toContain('results')
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

  // ABC-39: Unified Context System Tests
  describe('buildSystemPrompt (ABC-39)', () => {
    const mockPaper: ContextPaper = {
      pmid: '12345678',
      title: 'Effect of semaglutide on cardiovascular outcomes',
      abstract: 'This study examined the cardiovascular effects of semaglutide in patients with type 2 diabetes.',
      journal: 'New England Journal of Medicine',
      publicationDate: '2024-01-15',
      authors: ['Smith J', 'Johnson A', 'Williams B']
    }

    it('should build basic prompt without papers', () => {
      const prompt = buildSystemPrompt()
      
      expect(prompt).toContain('thoughtful medical research consultant')
      expect(prompt).toContain('CRITICAL RULES')
      expect(prompt).not.toContain('[1]')
    })

    it('should build prompt with one paper and [1] citation', () => {
      const prompt = buildSystemPrompt([mockPaper])
      
      expect(prompt).toContain('[1]')
      expect(prompt).toContain('Effect of semaglutide')
      expect(prompt).toContain('REFERENCE PAPERS')
    })

    it('should build prompt with multiple papers [1], [2], [3]', () => {
      const paper2 = { ...mockPaper, pmid: '87654321', title: 'GLP-1 receptor agonists in diabetes' }
      const paper3 = { ...mockPaper, pmid: '11223344', title: 'Tirzepatide efficacy study' }
      
      const prompt = buildSystemPrompt([mockPaper, paper2, paper3])
      
      expect(prompt).toContain('[1]')
      expect(prompt).toContain('[2]')
      expect(prompt).toContain('[3]')
      expect(prompt).toContain('Effect of semaglutide')
      expect(prompt).toContain('GLP-1 receptor')
      expect(prompt).toContain('Tirzepatide')
    })

    it('should include paper metadata (title, authors, journal, PMID)', () => {
      const prompt = buildSystemPrompt([mockPaper])
      
      expect(prompt).toContain('Effect of semaglutide')
      expect(prompt).toContain('Smith J, Johnson A, Williams B')
      expect(prompt).toContain('New England Journal of Medicine')
      expect(prompt).toContain('12345678')
      expect(prompt).toContain('2024-01-15')
    })

    it('should include paper abstract', () => {
      const prompt = buildSystemPrompt([mockPaper])
      
      expect(prompt).toContain('cardiovascular effects of semaglutide')
      expect(prompt).toContain('type 2 diabetes')
    })

    it('should instruct AI to cite papers with [N] notation', () => {
      const prompt = buildSystemPrompt([mockPaper])
      
      expect(prompt).toContain('cite it using its number: [1], [2]')
      expect(prompt).toContain('According to [1]')
    })

    it('should handle papers with many authors (et al.)', () => {
      const manyAuthorsPaper = {
        ...mockPaper,
        authors: ['Author1', 'Author2', 'Author3', 'Author4', 'Author5']
      }
      
      const prompt = buildSystemPrompt([manyAuthorsPaper])
      
      expect(prompt).toContain('Author1, Author2, Author3 et al.')
      expect(prompt).not.toContain('Author4')
    })

    it('should provide clear instructions for paper references', () => {
      const prompt = buildSystemPrompt([mockPaper])
      
      expect(prompt).toContain('INSTRUCTIONS FOR USING PAPERS')
      expect(prompt).toContain('first paper')
      expect(prompt).toContain('Paper 2')
    })
  })

  describe('buildMessagesFromHistory (ABC-39)', () => {
    it('should convert empty history with current query', () => {
      const messages = buildMessagesFromHistory([], 'What is GLP-1?')
      
      expect(messages).toHaveLength(1)
      expect(messages[0].role).toBe('user')
      expect(messages[0].content).toBe('What is GLP-1?')
    })

    it('should convert user/assistant messages to proper Anthropic format', () => {
      const history: ChatMessage[] = [
        { type: 'user', message: 'Hello' },
        { type: 'system', message: 'Hi there!' },
        { type: 'user', message: 'How are you?' }
      ]
      
      const messages = buildMessagesFromHistory(history, 'Tell me about diabetes')
      
      expect(messages).toHaveLength(4) // 3 history + 1 current
      expect(messages[0].role).toBe('user')
      expect(messages[0].content).toBe('Hello')
      expect(messages[1].role).toBe('assistant')
      expect(messages[1].content).toBe('Hi there!')
      expect(messages[2].role).toBe('user')
      expect(messages[2].content).toBe('How are you?')
    })

    it('should include current query as final message', () => {
      const history: ChatMessage[] = [
        { type: 'user', message: 'Hello' },
        { type: 'system', message: 'Hi!' }
      ]
      
      const messages = buildMessagesFromHistory(history, 'What about GLP-1?')
      
      const lastMessage = messages[messages.length - 1]
      expect(lastMessage.role).toBe('user')
      expect(lastMessage.content).toBe('What about GLP-1?')
    })

    it('should limit to last 6 messages from history', () => {
      const history: ChatMessage[] = Array.from({ length: 10 }, (_, i) => ({
        type: i % 2 === 0 ? 'user' : 'system',
        message: `Message ${i}`
      }))
      
      const messages = buildMessagesFromHistory(history, 'Current query')
      
      // Should have 6 history messages + 1 current = 7 total
      expect(messages).toHaveLength(7)
      
      // Should NOT contain early messages
      expect(messages.find(m => m.content === 'Message 0')).toBeUndefined()
      expect(messages.find(m => m.content === 'Message 1')).toBeUndefined()
      
      // Should contain last 6 history messages
      expect(messages.find(m => m.content === 'Message 4')).toBeDefined()
      expect(messages.find(m => m.content === 'Message 9')).toBeDefined()
    })

    it('should properly map system messages to assistant role', () => {
      const history: ChatMessage[] = [
        { type: 'system', message: 'AI response here' }
      ]
      
      const messages = buildMessagesFromHistory(history, 'Follow up')
      
      expect(messages[0].role).toBe('assistant')
      expect(messages[0].content).toBe('AI response here')
    })

    it('should handle alternating conversation correctly', () => {
      const history: ChatMessage[] = [
        { type: 'user', message: 'Question 1' },
        { type: 'system', message: 'Answer 1' },
        { type: 'user', message: 'Question 2' },
        { type: 'system', message: 'Answer 2' }
      ]
      
      const messages = buildMessagesFromHistory(history, 'Question 3')
      
      expect(messages).toHaveLength(5)
      expect(messages[0].role).toBe('user')
      expect(messages[1].role).toBe('assistant')
      expect(messages[2].role).toBe('user')
      expect(messages[3].role).toBe('assistant')
      expect(messages[4].role).toBe('user')
    })
  })
})

