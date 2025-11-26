import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for Drug Name Extraction API
 * 
 * Bug: The word "placebo" is being included as a drug but it's not valid
 * 
 * Test queries:
 * - "Alzheimer's drugs in Phase 2 trials"
 * - "GLP-1 oral drugs in Phase 3 trials"
 */

// Mock the handler function
const mockHandler = async (req: any, res: any) => {
  const handler = await import('../api/extract-drug-names');
  return handler.default(req, res);
};

describe('Drug Extraction - Placebo Filtering Bug', () => {
  let mockRes: any;
  
  beforeEach(() => {
    // Mock response object
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      end: vi.fn(),
      setHeader: vi.fn(),
    };

    // Reset environment
    process.env.GOOGLE_GEMINI_API_KEY = 'test-api-key';
  });

  it('should NOT extract "placebo" as a valid drug from Alzheimer\'s trial text', async () => {
    const trialText = `
      A randomized, double-blind, placebo-controlled Phase 2 study of Drug-X 
      versus placebo in patients with Alzheimer's Disease. Participants will 
      receive either Drug-X or placebo daily for 12 weeks.
    `;

    const mockReq = {
      method: 'POST',
      body: {
        text: trialText,
        userQuery: "Alzheimer's drugs in Phase 2 trials",
        context: 'clinical_trial'
      }
    };

    // Mock Gemini API response that incorrectly includes placebo
    const mockGeminiResponse = {
      candidates: [{
        content: {
          parts: [{
            text: JSON.stringify({
              drugs: [
                { name: 'Drug-X', type: 'drug', confidence: 'high' },
                { name: 'Placebo', type: 'drug', confidence: 'medium' }  // BUG: Should not be included
              ]
            })
          }]
        }
      }]
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockGeminiResponse
    });

    await mockHandler(mockReq, mockRes);

    const response = mockRes.json.mock.calls[0][0];
    
    // Check if placebo was extracted
    const hasPlacebo = response.drugs.some((drug: any) => 
      drug.name.toLowerCase().includes('placebo')
    );

    if (hasPlacebo) {
      console.error('BUG DETECTED: Placebo was extracted as a drug:', 
        response.drugs.filter((d: any) => d.name.toLowerCase().includes('placebo'))
      );
    }

    // Test: Placebo should NOT be in the extracted drugs
    expect(hasPlacebo).toBe(false);
    
    // Test: Drug-X should be extracted
    const hasDrugX = response.drugs.some((drug: any) => 
      drug.name === 'Drug-X'
    );
    expect(hasDrugX).toBe(true);
  });

  it('should NOT extract "placebo" from GLP-1 trial descriptions', async () => {
    const trialText = `
      This Phase 3 trial compares oral GLP-1 agonist Semaglutide against placebo.
      Patients receive either Semaglutide 50mg or matching placebo tablets once daily.
      The placebo group will be monitored for safety.
    `;

    const mockReq = {
      method: 'POST',
      body: {
        text: trialText,
        userQuery: "GLP-1 oral drugs in Phase 3 trials",
        context: 'clinical_trial'
      }
    };

    // Mock Gemini response with placebo incorrectly included
    const mockGeminiResponse = {
      candidates: [{
        content: {
          parts: [{
            text: JSON.stringify({
              drugs: [
                { name: 'Semaglutide', type: 'drug', confidence: 'high' },
                { name: 'GLP-1 agonist', type: 'drug', confidence: 'high' },
                { name: 'placebo', type: 'intervention', confidence: 'low' }  // BUG: Should be filtered
              ]
            })
          }]
        }
      }]
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockGeminiResponse
    });

    await mockHandler(mockReq, mockRes);

    const response = mockRes.json.mock.calls[0][0];
    
    // Check for placebo in various forms
    const hasPlacebo = response.drugs.some((drug: any) => 
      drug.name.toLowerCase() === 'placebo' || 
      drug.name.toLowerCase().includes('placebo')
    );

    if (hasPlacebo) {
      console.error('BUG DETECTED: Placebo was extracted as a drug:', 
        response.drugs.filter((d: any) => d.name.toLowerCase().includes('placebo'))
      );
    }

    expect(hasPlacebo).toBe(false);
    
    // Valid drugs should be extracted
    expect(response.drugs.length).toBeGreaterThan(0);
    expect(response.drugs.some((d: any) => d.name.includes('Semaglutide'))).toBe(true);
  });

  it('should filter out common non-drug control terms', async () => {
    const trialText = `
      Study comparing Drug-A with placebo and standard of care.
      Control group receives placebo. Active arm gets Drug-A.
      Subjects randomized to placebo or treatment.
    `;

    const mockReq = {
      method: 'POST',
      body: {
        text: trialText,
        userQuery: "Alzheimer's drugs in Phase 2 trials",
        context: 'clinical_trial'
      }
    };

    // Mock response with multiple non-drug terms
    const mockGeminiResponse = {
      candidates: [{
        content: {
          parts: [{
            text: JSON.stringify({
              drugs: [
                { name: 'Drug-A', type: 'drug', confidence: 'high' },
                { name: 'placebo', type: 'intervention', confidence: 'medium' },  // Should be filtered
                { name: 'standard of care', type: 'intervention', confidence: 'low' },  // Should be filtered
                { name: 'control', type: 'intervention', confidence: 'low' }  // Should be filtered
              ]
            })
          }]
        }
      }]
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockGeminiResponse
    });

    await mockHandler(mockReq, mockRes);

    const response = mockRes.json.mock.calls[0][0];
    
    // List of terms that should NOT be extracted as drugs
    const invalidDrugTerms = ['placebo', 'control', 'standard of care', 'sham'];
    
    const hasInvalidTerms = response.drugs.some((drug: any) => 
      invalidDrugTerms.some(term => 
        drug.name.toLowerCase().includes(term)
      )
    );

    if (hasInvalidTerms) {
      const invalidDrugs = response.drugs.filter((drug: any) => 
        invalidDrugTerms.some(term => drug.name.toLowerCase().includes(term))
      );
      console.error('BUG DETECTED: Invalid control terms extracted as drugs:', invalidDrugs);
    }

    expect(hasInvalidTerms).toBe(false);
    expect(response.drugs.some((d: any) => d.name === 'Drug-A')).toBe(true);
  });

  it('should extract only actual drug names from complex trial descriptions', async () => {
    const trialText = `
      Phase 2 trial of Lecanemab in early Alzheimer's disease.
      Participants randomized 1:1 to Lecanemab 10mg/kg or placebo.
      Placebo-controlled, double-blind design. Primary endpoint compares 
      Lecanemab to placebo on CDR-SB scale.
    `;

    const mockReq = {
      method: 'POST',
      body: {
        text: trialText,
        userQuery: "Alzheimer's drugs in Phase 2 trials",
        context: 'clinical_trial'
      }
    };

    const mockGeminiResponse = {
      candidates: [{
        content: {
          parts: [{
            text: JSON.stringify({
              drugs: [
                { name: 'Lecanemab', type: 'drug', confidence: 'high' },
                { name: 'placebo', type: 'intervention', confidence: 'medium' }  // BUG
              ]
            })
          }]
        }
      }]
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockGeminiResponse
    });

    await mockHandler(mockReq, mockRes);

    const response = mockRes.json.mock.calls[0][0];
    
    // Should only have Lecanemab, not placebo
    expect(response.drugs.length).toBe(1);
    expect(response.drugs[0].name).toBe('Lecanemab');
    expect(response.drugs.some((d: any) => 
      d.name.toLowerCase().includes('placebo')
    )).toBe(false);
  });

  it('should handle text with multiple mentions of placebo correctly', async () => {
    const trialText = `
      Triple-blind placebo-controlled study. Arm 1: Drug-Alpha + placebo. 
      Arm 2: Drug-Beta + placebo. Arm 3: placebo + placebo (double placebo).
      All placebo tablets matched for appearance.
    `;

    const mockReq = {
      method: 'POST',
      body: {
        text: trialText,
        userQuery: "GLP-1 oral drugs in Phase 3 trials",
        context: 'clinical_trial'
      }
    };

    const mockGeminiResponse = {
      candidates: [{
        content: {
          parts: [{
            text: JSON.stringify({
              drugs: [
                { name: 'Drug-Alpha', type: 'drug', confidence: 'high' },
                { name: 'Drug-Beta', type: 'drug', confidence: 'high' },
                { name: 'placebo', type: 'intervention', confidence: 'medium' }  // BUG
              ]
            })
          }]
        }
      }]
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockGeminiResponse
    });

    await mockHandler(mockReq, mockRes);

    const response = mockRes.json.mock.calls[0][0];
    
    // Should extract both real drugs but not placebo
    expect(response.drugs.length).toBe(2);
    expect(response.drugs.some((d: any) => d.name === 'Drug-Alpha')).toBe(true);
    expect(response.drugs.some((d: any) => d.name === 'Drug-Beta')).toBe(true);
    expect(response.drugs.some((d: any) => 
      d.name.toLowerCase().includes('placebo')
    )).toBe(false);
  });

  it('should verify the LLM prompt explicitly excludes placebo', async () => {
    const mockReq = {
      method: 'POST',
      body: {
        text: "Study of Drug-X versus placebo",
        userQuery: "Alzheimer's drugs in Phase 2 trials",
        context: 'clinical_trial'
      }
    };

    const mockGeminiResponse = {
      candidates: [{
        content: {
          parts: [{
            text: JSON.stringify({
              drugs: [
                { name: 'Drug-X', type: 'drug', confidence: 'high' }
              ]
            })
          }]
        }
      }]
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockGeminiResponse
    });

    await mockHandler(mockReq, mockRes);

    // Check that fetch was called with Gemini API
    const fetchCall = (global.fetch as any).mock.calls[0];
    const requestBody = JSON.parse(fetchCall[1].body);
    const prompt = requestBody.contents[0].parts[0].text;

    // The prompt should ideally contain instructions to exclude placebo
    // This is a suggestion for the fix
    const promptLower = prompt.toLowerCase();
    
    // Check if prompt has any instructions about filtering
    console.log('Current prompt instructions for drug extraction:', 
      prompt.split('\n').filter((line: string) => 
        line.toLowerCase().includes('rule') || 
        line.toLowerCase().includes('exclude') ||
        line.toLowerCase().includes('do not') ||
        line.toLowerCase().includes('only')
      )
    );
    
    // Note: This test documents what SHOULD be in the prompt
    // Uncomment when the fix is implemented:
    // expect(promptLower).toContain('exclude placebo');
    // expect(promptLower).toContain('do not include control');
  });

  it('should handle case variations of placebo (PLACEBO, Placebo, placebo)', async () => {
    const trialText = `
      Study arms: PLACEBO group, Placebo tablets, or active drug treatment.
    `;

    const mockReq = {
      method: 'POST',
      body: {
        text: trialText,
        userQuery: "Alzheimer's drugs in Phase 2 trials",
        context: 'clinical_trial'
      }
    };

    const mockGeminiResponse = {
      candidates: [{
        content: {
          parts: [{
            text: JSON.stringify({
              drugs: [
                { name: 'PLACEBO', type: 'intervention', confidence: 'low' },
                { name: 'Placebo', type: 'intervention', confidence: 'medium' }
              ]
            })
          }]
        }
      }]
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockGeminiResponse
    });

    await mockHandler(mockReq, mockRes);

    const response = mockRes.json.mock.calls[0][0];
    
    // Should filter out all case variations of placebo
    const hasAnyPlacebo = response.drugs.some((drug: any) => 
      drug.name.toLowerCase() === 'placebo'
    );

    expect(hasAnyPlacebo).toBe(false);
    expect(response.drugs.length).toBe(0);  // No valid drugs in this text
  });
});

describe('Drug Extraction - Deduplication Tests', () => {
  let mockRes: any;
  
  beforeEach(() => {
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      end: vi.fn(),
      setHeader: vi.fn(),
    };
    process.env.GOOGLE_GEMINI_API_KEY = 'test-api-key';
  });

  it('should deduplicate drug names with different confidence levels', async () => {
    const mockReq = {
      method: 'POST',
      body: {
        text: "Study of semaglutide and Semaglutide in diabetes",
        userQuery: "GLP-1 oral drugs in Phase 3 trials",
        context: 'clinical_trial'
      }
    };

    const mockGeminiResponse = {
      candidates: [{
        content: {
          parts: [{
            text: JSON.stringify({
              drugs: [
                { name: 'semaglutide', type: 'drug', confidence: 'medium' },
                { name: 'Semaglutide', type: 'drug', confidence: 'high' }  // Same drug, higher confidence
              ]
            })
          }]
        }
      }]
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockGeminiResponse
    });

    await mockHandler(mockReq, mockRes);

    const response = mockRes.json.mock.calls[0][0];
    
    // Should have only one entry for semaglutide
    expect(response.drugs.length).toBe(1);
    expect(response.drugs[0].name).toMatch(/semaglutide/i);
    // Should keep the higher confidence version
    expect(response.drugs[0].confidence).toBe('high');
  });
});

