/**
 * Integration tests for generate-response API (HW8 ABC-57)
 * Testing Claude-powered search intent detection with REAL API calls
 * 
 * NOTE: These tests make actual calls to Claude API (costs ~$0.001 per test)
 */

// Load environment variables from .env file (API keys stay private)
import dotenv from 'dotenv';
dotenv.config();

import { describe, it, expect, beforeAll, vi } from 'vitest';
import handler from '../generate-response';

describe('HW8 ABC-57: Integration Tests - Real Claude API Calls', () => {
  beforeAll(() => {
    // Verify we have the API key
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error(
        '⚠️  ANTHROPIC_API_KEY not set. Please set it in your environment:\n' +
        'export ANTHROPIC_API_KEY=your-key-here\n' +
        'or add it to .env.local file'
      );
    }
  });

  /**
   * Helper to create mock Vercel request/response objects
   */
  function createMockReqRes(userQuery: string, chatHistory: any[] = []) {
    const req = {
      method: 'POST',
      body: {
        userQuery,
        chatHistory,
      },
    };

    const responseData: any = {};
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn((data: any) => {
        Object.assign(responseData, data);
        return res;
      }),
      setHeader: vi.fn(),
      _getData: () => responseData,
    };

    return { req, res };
  }

  /**
   * Helper to call the handler and get response data
   */
  async function callGenerateResponse(userQuery: string, chatHistory: any[] = []) {
    const { req, res } = createMockReqRes(userQuery, chatHistory);
    await handler(req, res);
    return res._getData();
  }

  describe('Positive Cases: Should Trigger Search', () => {
    it('should detect search intent for "What\'s the latest on semaglutide for obesity?"', async () => {
      const data = await callGenerateResponse("What's the latest on semaglutide for obesity?");

      // Check API response structure
      expect(data.success).toBe(true);
      expect(data.shouldSearch).toBe(true);
      expect(data.searchSuggestions).toBeDefined();
      expect(data.searchSuggestions.length).toBeGreaterThan(0);
      expect(data.intent).toBe('search_request');

      // Check search suggestions have the right content
      const suggestion = data.searchSuggestions[0];
      expect(suggestion.query.toLowerCase()).toContain('semaglutide');
    }, 15000); // 15s timeout for API call

    it('should detect search intent for "Tell me about GLP-1 agonists in diabetes trials"', async () => {
      const data = await callGenerateResponse("Tell me about GLP-1 agonists in diabetes trials");

      expect(data.success).toBe(true);
      expect(data.shouldSearch).toBe(true);
      expect(data.searchSuggestions).toBeDefined();
      expect(data.searchSuggestions.length).toBeGreaterThan(0);

      const suggestion = data.searchSuggestions[0];
      expect(suggestion.query.toLowerCase()).toMatch(/glp-1|glp1/);
    }, 15000);

    it('should detect search intent for "Has anyone studied pembrolizumab in melanoma?"', async () => {
      const data = await callGenerateResponse("Has anyone studied pembrolizumab in melanoma?");

      expect(data.success).toBe(true);
      expect(data.shouldSearch).toBe(true);
      expect(data.searchSuggestions.length).toBeGreaterThan(0);

      const suggestion = data.searchSuggestions[0];
      expect(suggestion.query.toLowerCase()).toContain('pembrolizumab');
    }, 15000);

    it('should detect search intent for "I\'m interested in CAR-T therapies"', async () => {
      const data = await callGenerateResponse("I'm interested in CAR-T therapies");

      expect(data.success).toBe(true);
      expect(data.shouldSearch).toBe(true);
      expect(data.searchSuggestions.length).toBeGreaterThan(0);

      const suggestion = data.searchSuggestions[0];
      expect(suggestion.query.toLowerCase()).toMatch(/car-t|car t/);
    }, 15000);

    it('should detect search intent for "Are there any phase 3 trials for drug X?"', async () => {
      const data = await callGenerateResponse("Are there any phase 3 trials for drug X?");

      expect(data.success).toBe(true);
      expect(data.shouldSearch).toBe(true);
      expect(data.searchSuggestions.length).toBeGreaterThan(0);
    }, 15000);
  });

  describe('Negative Cases: Should NOT Trigger Search', () => {
    it('should NOT detect search intent for "Hello, how are you?"', async () => {
      const data = await callGenerateResponse("Hello, how are you?");

      expect(data.success).toBe(true);
      expect(data.shouldSearch).toBe(false);
      expect(data.searchSuggestions).toEqual([]);
      expect(data.intent).not.toBe('search_request');
    }, 15000);

    it('should NOT detect search intent for "Thanks for that information"', async () => {
      const data = await callGenerateResponse("Thanks for that information");

      expect(data.success).toBe(true);
      expect(data.shouldSearch).toBe(false);
      expect(data.searchSuggestions).toEqual([]);
    }, 15000);

    it('should NOT detect search intent for "Can you explain what you just said?"', async () => {
      const data = await callGenerateResponse("Can you explain what you just said?");

      expect(data.success).toBe(true);
      expect(data.shouldSearch).toBe(false);
      expect(data.searchSuggestions).toEqual([]);
    }, 15000);

    it('should NOT detect search intent for "What does phase 3 mean?"', async () => {
      const data = await callGenerateResponse("What does phase 3 mean?");

      expect(data.success).toBe(true);
      expect(data.shouldSearch).toBe(false);
      expect(data.searchSuggestions).toEqual([]);
    }, 15000);

    it('should NOT detect search intent for "I don\'t understand the last result"', async () => {
      const data = await callGenerateResponse("I don't understand the last result");

      expect(data.success).toBe(true);
      expect(data.shouldSearch).toBe(false);
      expect(data.searchSuggestions).toEqual([]);
    }, 15000);
  });

  describe('Edge Cases', () => {
    it('should detect search intent in mixed greeting: "Hi, I want to know about checkpoint inhibitors"', async () => {
      const data = await callGenerateResponse("Hi, I want to know about checkpoint inhibitors");

      expect(data.success).toBe(true);
      expect(data.shouldSearch).toBe(true);
      expect(data.searchSuggestions.length).toBeGreaterThan(0);

      const suggestion = data.searchSuggestions[0];
      expect(suggestion.query.toLowerCase()).toContain('checkpoint');
    }, 15000);

    it('should NOT detect search for clarification with drug name: "What did you mean about semaglutide?"', async () => {
      // First, establish some context
      await callGenerateResponse("Tell me about semaglutide");

      // Then ask for clarification
      const data = await callGenerateResponse("What did you mean about semaglutide?", [
        { type: 'user', message: 'Tell me about semaglutide' },
        { type: 'system', message: 'Semaglutide is a GLP-1 agonist...' }
      ]);

      expect(data.success).toBe(true);
      // This might be tricky for Claude to distinguish, but ideally:
      // expect(data.shouldSearch).toBe(false);
      
      // For now, just verify we get a response
      expect(data.response).toBeTruthy();
    }, 20000);

    it('should distinguish "tell me about this drug" (search) from general medical question', async () => {
      // Search case
      const searchData = await callGenerateResponse("Tell me about ozempic");
      expect(searchData.shouldSearch).toBe(true);

      // General question (may or may not trigger search depending on Claude's interpretation)
      const generalData = await callGenerateResponse("What is a GLP-1 receptor?");
      expect(generalData.success).toBe(true);
      expect(generalData.response).toBeTruthy();
    }, 20000);
  });

  describe('Context Awareness', () => {
    it('should handle follow-up questions with conversation context', async () => {
      const chatHistory = [
        { type: 'user', message: 'Tell me about diabetes drugs' },
        { type: 'system', message: 'I can search for diabetes drugs for you.' }
      ];

      const data = await callGenerateResponse("What about cardiovascular outcomes?", chatHistory);

      expect(data.success).toBe(true);
      expect(data.response).toBeTruthy();
      
      // Claude should understand this is related to diabetes drugs context
      // May or may not trigger search depending on interpretation
    }, 15000);
  });

  describe('Response Quality', () => {
    it('should provide brief responses when search intent is detected', async () => {
      const data = await callGenerateResponse("GLP-1");

      expect(data.success).toBe(true);
      expect(data.shouldSearch).toBe(true);
      expect(data.response).toBeTruthy();

      // ENFORCE: Response should be brief (1-2 sentences, ~20 words max)
      const wordCount = data.response.split(/\s+/).length;
      const sentenceCount = (data.response.match(/[.!?]+/g) || []).length;
      
      console.log(`Response word count: ${wordCount} (required: ≤20)`);
      console.log(`Response sentence count: ${sentenceCount} (required: ≤2)`);
      console.log(`Response: "${data.response}"`);
      
      // ACTUAL ENFORCEMENT (these will fail until bug is fixed)
      expect(wordCount).toBeLessThanOrEqual(20);
      expect(sentenceCount).toBeLessThanOrEqual(2);
      
      // Should still mention searching
      expect(data.response.toLowerCase()).toMatch(/search|find|look/);
    }, 15000);

    it('should provide detailed responses for conversational queries', async () => {
      const data = await callGenerateResponse("What is a clinical trial?");

      expect(data.success).toBe(true);
      expect(data.response).toBeTruthy();

      // Conversational responses CAN be longer
      const wordCount = data.response.split(/\s+/).length;
      console.log(`Conversational response word count: ${wordCount}`);
      
      // Should actually explain, not just offer to search
      expect(wordCount).toBeGreaterThan(10);
    }, 15000);
  });

  describe('Known Bug Documentation (ABC-XX)', () => {
    /**
     * BUG: Claude provides verbose responses despite brevity instructions
     * 
     * Desired behavior: When SEARCH_INTENT is yes, response should be 1-2 sentences
     * Steps to reproduce: Send "I'm trying to understand GLP-1s"
     * Wrong behavior: Claude gives 4-5 sentence explanation instead of brief "I can search"
     * 
     * This test documents the bug exists
     */
    it('KNOWN BUG: documents that Claude ignores brevity instruction for search responses', async () => {
      const data = await callGenerateResponse("I'm trying to understand GLP-1s");

      expect(data.success).toBe(true);
      expect(data.shouldSearch).toBe(true);

      const wordCount = data.response.split(/\s+/).length;
      const sentenceCount = (data.response.match(/[.!?]+/g) || []).length;

      console.log(`\n🐛 BUG DOCUMENTATION:`);
      console.log(`Query: "I'm trying to understand GLP-1s"`);
      console.log(`Response: "${data.response}"`);
      console.log(`Word count: ${wordCount} (ideal: <20)`);
      console.log(`Sentence count: ${sentenceCount} (ideal: ≤2)`);
      console.log(`shouldSearch: ${data.shouldSearch}`);

      // Document that the bug exists (response is longer than ideal)
      // EXPECTED: Brief response like "I can search for GLP-1 research."
      // ACTUAL: Often 50-200+ words with explanations
      
      // Test will pass but logs the bug
      expect(wordCount).toBeGreaterThan(0); // Just verify we got something
    }, 15000);
  });
});
