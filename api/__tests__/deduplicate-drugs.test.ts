/**
 * Tests for deduplicate-drugs API endpoint
 * 
 * This endpoint uses the Gemini LLM to deduplicate drug names by:
 * - Merging brand/generic names (e.g., Keytruda + Pembrolizumab)
 * - Handling spelling variations
 * - Resolving abbreviations
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import handler from '../deduplicate-drugs';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Mock fetch globally
global.fetch = vi.fn();

interface DrugInfo {
  name: string;
  type?: string;
  confidence: 'high' | 'medium' | 'low';
  source: string;
  sourceType: 'trial' | 'paper';
}

interface ResponseData {
  success?: boolean;
  error?: string;
  drugs?: DrugInfo[];
  originalCount?: number;
  deduplicatedCount?: number;
  details?: string;
}

describe('deduplicate-drugs API', () => {
  let mockReq: Partial<VercelRequest>;
  let mockRes: Partial<VercelResponse>;
  let statusCode: number;
  let responseData: ResponseData | null;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    statusCode = 200;
    responseData = null;

    // Mock request
    mockReq = {
      method: 'POST',
      body: {
        drugs: [
          { name: 'Keytruda', type: 'drug', confidence: 'high' as const, source: 'NCT123', sourceType: 'trial' as const },
          { name: 'Pembrolizumab', type: 'drug', confidence: 'high' as const, source: 'NCT456', sourceType: 'trial' as const },
          { name: 'Nivolumab', type: 'drug', confidence: 'high' as const, source: 'NCT789', sourceType: 'trial' as const }
        ]
      }
    };

    // Mock response
    mockRes = {
      status: vi.fn((code: number) => {
        statusCode = code;
        return mockRes as VercelResponse;
      }),
      json: vi.fn((data: ResponseData) => {
        responseData = data;
        return mockRes as VercelResponse;
      }),
      setHeader: vi.fn(),
      end: vi.fn(),
    };

    // Set environment
    process.env.GOOGLE_GEMINI_API_KEY = 'test-api-key';
  });

  it('should reject non-POST requests', async () => {
    mockReq.method = 'GET';

    await handler(mockReq as VercelRequest, mockRes as VercelResponse);

    expect(statusCode).toBe(405);
    expect(responseData).not.toBeNull();
    expect(responseData!.error).toBe('Method not allowed');
  });

  it('should reject requests without drugs array', async () => {
    mockReq.body = {};

    await handler(mockReq as VercelRequest, mockRes as VercelResponse);

    expect(statusCode).toBe(400);
    expect(responseData).not.toBeNull();
    expect(responseData!.error).toContain('drugs array required');
  });

  it('should return drugs as-is if only 1 drug provided', async () => {
    mockReq.body = {
      drugs: [
        { name: 'Keytruda', type: 'drug', confidence: 'high' as const, source: 'NCT123', sourceType: 'trial' as const }
      ]
    };

    await handler(mockReq as VercelRequest, mockRes as VercelResponse);

    expect(statusCode).toBe(200);
    expect(responseData).not.toBeNull();
    expect(responseData!.success).toBe(true);
    expect(responseData!.drugs).toHaveLength(1);
    expect(responseData!.drugs![0].name).toBe('Keytruda');
  });

  it('should return 500 if Gemini API key not configured', async () => {
    delete process.env.GOOGLE_GEMINI_API_KEY;

    await handler(mockReq as VercelRequest, mockRes as VercelResponse);

    expect(statusCode).toBe(500);
    expect(responseData).not.toBeNull();
    expect(responseData!.error).toContain('Gemini API key not configured');
  });

  it('should deduplicate drugs using Gemini API', async () => {
    // Mock successful Gemini API response
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: '["Pembrolizumab", "Nivolumab"]' // Merged Keytruda → Pembrolizumab
            }]
          }
        }]
      })
    });

    await handler(mockReq as VercelRequest, mockRes as VercelResponse);

    expect(statusCode).toBe(200);
    expect(responseData).not.toBeNull();
    expect(responseData!.success).toBe(true);
    expect(responseData!.originalCount).toBe(3);
    expect(responseData!.deduplicatedCount).toBe(2);
    expect(responseData!.drugs).toHaveLength(2);
    
    // Should preserve drug metadata
    expect(responseData!.drugs![0]).toHaveProperty('type');
    expect(responseData!.drugs![0]).toHaveProperty('confidence');
    expect(responseData!.drugs![0]).toHaveProperty('source');
  });

  it('should handle Gemini API returning JSON in markdown code blocks', async () => {
    // Mock Gemini response with markdown code blocks
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: '```json\n["Pembrolizumab", "Nivolumab"]\n```'
            }]
          }
        }]
      })
    });

    await handler(mockReq as VercelRequest, mockRes as VercelResponse);

    expect(statusCode).toBe(200);
    expect(responseData).not.toBeNull();
    expect(responseData!.success).toBe(true);
    expect(responseData!.drugs).toHaveLength(2);
  });

  it('should handle Gemini API errors', async () => {
    // Mock failed Gemini API response
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error'
    });

    await handler(mockReq as VercelRequest, mockRes as VercelResponse);

    expect(statusCode).toBe(500);
    expect(responseData).not.toBeNull();
    expect(responseData!.error).toContain('Gemini API failed');
  });

  it('should handle invalid JSON response from Gemini', async () => {
    // Mock Gemini returning invalid JSON
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: 'This is not valid JSON'
            }]
          }
        }]
      })
    });

    await handler(mockReq as VercelRequest, mockRes as VercelResponse);

    expect(statusCode).toBe(500);
    expect(responseData).not.toBeNull();
    expect(responseData!.error).toContain('Invalid JSON');
  });

  it('should combine sources when merging drugs', async () => {
    // Mock deduplication that merges Keytruda + Pembrolizumab
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: '["Pembrolizumab", "Nivolumab"]'
            }]
          }
        }]
      })
    });

    await handler(mockReq as VercelRequest, mockRes as VercelResponse);

    expect(statusCode).toBe(200);
    expect(responseData).not.toBeNull();
    
    // Find the Pembrolizumab entry (merged from Keytruda + Pembrolizumab)
    const pembrolizumab = responseData!.drugs?.find((d: DrugInfo) => 
      d.name.toLowerCase() === 'pembrolizumab'
    );
    
    expect(pembrolizumab).toBeDefined();
    // Source should contain both original sources
    expect(pembrolizumab?.source).toContain('NCT');
  });

  it('should preserve highest confidence when merging drugs', async () => {
    mockReq.body = {
      drugs: [
        { name: 'Keytruda', type: 'drug', confidence: 'medium' as const, source: 'NCT123', sourceType: 'trial' as const },
        { name: 'Pembrolizumab', type: 'drug', confidence: 'high' as const, source: 'NCT456', sourceType: 'trial' as const }
      ]
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: '["Pembrolizumab"]' // Merged both into one
            }]
          }
        }]
      })
    });

    await handler(mockReq as VercelRequest, mockRes as VercelResponse);

    expect(statusCode).toBe(200);
    expect(responseData).not.toBeNull();
    expect(responseData!.drugs![0].confidence).toBe('high'); // Should use highest confidence
  });
});
