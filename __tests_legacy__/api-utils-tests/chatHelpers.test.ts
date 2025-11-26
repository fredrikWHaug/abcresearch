/**
 * Unit tests for chatHelpers.ts (HW8 ABC-57)
 * Testing Claude-powered search intent detection via metadata format
 */

import { describe, it, expect } from 'vitest';
import {
  buildSystemPrompt,
  buildMessagesFromHistory,
  type ChatMessage,
  type ContextPaper
} from '../chatHelpers';

describe('HW8 ABC-57: System Prompt Metadata Instructions', () => {
  describe('buildSystemPrompt', () => {
    it('should include [SEARCH_INTENT: yes/no] format instruction', () => {
      const prompt = buildSystemPrompt();
      
      expect(prompt).toContain('[SEARCH_INTENT: yes/no]');
    });

    it('should include [SEARCH_TERMS: ...] format instruction', () => {
      const prompt = buildSystemPrompt();
      
      expect(prompt).toContain('[SEARCH_TERMS: terms to search for, or "none"]');
    });

    it('should have metadata instructions appear early in the prompt', () => {
      const prompt = buildSystemPrompt();
      
      // Find where the metadata section starts
      const metadataIndex = prompt.indexOf('HW8 ABC-57: RESPONSE FORMAT');
      const conversationalRulesIndex = prompt.indexOf('CRITICAL RULES:');
      
      // Metadata instructions should appear within the first 2500 characters
      // This ensures they're prominent and not buried at the end
      // (Total prompt is ~3000 chars, so this checks it's in the first ~80%)
      expect(metadataIndex).toBeGreaterThan(-1);
      expect(metadataIndex).toBeLessThan(2500);
      
      // Should come after the conversational rules but still early
      expect(metadataIndex).toBeGreaterThan(conversationalRulesIndex);
    });

    it('should include brevity instruction for search-intent responses', () => {
      const prompt = buildSystemPrompt();
      
      // Check for the critical brevity instruction
      expect(prompt).toContain('CRITICAL: If SEARCH_INTENT is yes, keep your response to 1-2 sentences');
    });

    it('should include examples of metadata format', () => {
      const prompt = buildSystemPrompt();
      
      // Should have examples showing the format
      expect(prompt).toContain('[SEARCH_INTENT: yes]');
      expect(prompt).toContain('[SEARCH_TERMS: GLP-1 agonists]');
      expect(prompt).toContain('[SEARCH_INTENT: no]');
      expect(prompt).toContain('[SEARCH_TERMS: none]');
    });

    it('should work without context papers', () => {
      const prompt = buildSystemPrompt();
      
      expect(prompt).toBeTruthy();
      expect(prompt.length).toBeGreaterThan(100);
      expect(prompt).toContain('HW8 ABC-57');
    });

    it('should work with context papers', () => {
      const contextPapers: ContextPaper[] = [
        {
          pmid: '12345678',
          title: 'Test Paper on GLP-1',
          abstract: 'This is a test abstract about GLP-1 agonists.',
          journal: 'Test Journal',
          publicationDate: '2024-01-01',
          authors: ['Smith J', 'Doe A']
        }
      ];

      const prompt = buildSystemPrompt(contextPapers);
      
      expect(prompt).toBeTruthy();
      expect(prompt).toContain('Test Paper on GLP-1');
      expect(prompt).toContain('[1]');
      // Context papers version should still have conversational rules
      expect(prompt).toContain('CONVERSATIONAL RULES:');
    });
  });
});

describe('HW8 ABC-57: Message History Format Reminders', () => {
  describe('buildMessagesFromHistory', () => {
    it('should include format reminder in final user message', () => {
      const chatHistory: ChatMessage[] = [];
      const currentQuery = 'Tell me about GLP-1';

      const messages = buildMessagesFromHistory(chatHistory, currentQuery);

      // Should have exactly 1 message (the current query)
      expect(messages).toHaveLength(1);
      
      // The message should include the reminder
      const finalMessage = messages[messages.length - 1];
      expect(finalMessage.content).toContain('[Remember: Start your response with [SEARCH_INTENT: yes/no] and [SEARCH_TERMS: ...] tags]');
    });

    it('should not interfere with actual user query', () => {
      const chatHistory: ChatMessage[] = [];
      const currentQuery = 'What is semaglutide?';

      const messages = buildMessagesFromHistory(chatHistory, currentQuery);

      const finalMessage = messages[messages.length - 1];
      
      // Should still contain the original query
      expect(finalMessage.content).toContain('What is semaglutide?');
      
      // But also have the reminder appended
      expect(finalMessage.content).toContain('[Remember:');
    });

    it('should have correct format: query followed by reminder', () => {
      const chatHistory: ChatMessage[] = [];
      const currentQuery = 'GLP-1 trials';

      const messages = buildMessagesFromHistory(chatHistory, currentQuery);

      const finalMessage = messages[messages.length - 1];
      const content = finalMessage.content;
      
      // Query should come first
      const queryIndex = content.indexOf('GLP-1 trials');
      const reminderIndex = content.indexOf('[Remember:');
      
      expect(queryIndex).toBeLessThan(reminderIndex);
      
      // Should be separated by newlines
      expect(content).toMatch(/GLP-1 trials\s+\[Remember:/);
    });

    it('should maintain chat history and add reminder to final message', () => {
      const chatHistory: ChatMessage[] = [
        { type: 'user', message: 'Hello' },
        { type: 'system', message: 'Hi! How can I help?' },
        { type: 'user', message: 'Tell me about diabetes drugs' }
      ];
      const currentQuery = 'What about GLP-1?';

      const messages = buildMessagesFromHistory(chatHistory, currentQuery);

      // Should have 4 messages: 3 from history + 1 current
      expect(messages).toHaveLength(4);
      
      // First 3 should be the history (without reminder)
      expect(messages[0].content).toBe('Hello');
      expect(messages[1].content).toBe('Hi! How can I help?');
      expect(messages[2].content).toBe('Tell me about diabetes drugs');
      
      // Last message should have the query + reminder
      expect(messages[3].content).toContain('What about GLP-1?');
      expect(messages[3].content).toContain('[Remember:');
    });

    it('should only add reminder to current query, not historical messages', () => {
      const chatHistory: ChatMessage[] = [
        { type: 'user', message: 'Previous question' },
        { type: 'system', message: 'Previous answer' }
      ];
      const currentQuery = 'Current question';

      const messages = buildMessagesFromHistory(chatHistory, currentQuery);

      // Historical messages should NOT have the reminder
      expect(messages[0].content).not.toContain('[Remember:');
      expect(messages[1].content).not.toContain('[Remember:');
      
      // Only the current query should have it
      expect(messages[2].content).toContain('[Remember:');
    });

    it('should handle empty chat history', () => {
      const chatHistory: ChatMessage[] = [];
      const currentQuery = 'First message';

      const messages = buildMessagesFromHistory(chatHistory, currentQuery);

      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe('user');
      expect(messages[0].content).toContain('First message');
      expect(messages[0].content).toContain('[Remember:');
    });

    it('should limit history to last 6 messages', () => {
      const chatHistory: ChatMessage[] = [
        { type: 'user', message: 'Message 1' },
        { type: 'system', message: 'Response 1' },
        { type: 'user', message: 'Message 2' },
        { type: 'system', message: 'Response 2' },
        { type: 'user', message: 'Message 3' },
        { type: 'system', message: 'Response 3' },
        { type: 'user', message: 'Message 4' },
        { type: 'system', message: 'Response 4' }
      ];
      const currentQuery = 'Message 5';

      const messages = buildMessagesFromHistory(chatHistory, currentQuery);

      // Should have 6 recent messages + 1 current = 7 total
      expect(messages).toHaveLength(7);
      
      // First message should be Message 2 (8 total messages, last 6 starts at index 2)
      expect(messages[0].content).toBe('Message 2');
    });

    it('should convert message types to correct roles', () => {
      const chatHistory: ChatMessage[] = [
        { type: 'user', message: 'User message' },
        { type: 'system', message: 'Assistant message' }
      ];
      const currentQuery = 'Current query';

      const messages = buildMessagesFromHistory(chatHistory, currentQuery);

      expect(messages[0].role).toBe('user');
      expect(messages[1].role).toBe('assistant');
      expect(messages[2].role).toBe('user');
    });
  });
});

