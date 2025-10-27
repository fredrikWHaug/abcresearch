import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for Clinical Trials Search API
 * 
 * Bug: Trials that don't match the clinical PHASE in the user query are being included
 * 
 * Test queries:
 * - "Alzheimer's drugs in Phase 2 trials"
 * - "GLP-1 oral drugs in Phase 3 trials"
 */

// Mock the handler function
const mockHandler = async (req: any, res: any) => {
  const handler = await import('../api/search-clinical-trials');
  return handler.default(req, res);
};

describe('Clinical Trials Search - Phase Filtering Bug', () => {
  let mockRes: any;
  
  beforeEach(() => {
    // Mock response object
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      end: vi.fn(),
      setHeader: vi.fn(),
    };
  });

  it('should only return Phase 2 trials when searching for Alzheimer\'s drugs in Phase 2', async () => {
    // Mock request for Phase 2 Alzheimer's trials
    const mockReq = {
      method: 'POST',
      body: {
        condition: 'Alzheimer',
        phase: 'Phase 2',
        pageSize: 20
      }
    };

    // Mock the fetch response from ClinicalTrials.gov API
    const mockTrials = [
      {
        protocolSection: {
          identificationModule: {
            nctId: 'NCT001',
            briefTitle: 'Study of Drug A for Alzheimer\'s Disease'
          },
          statusModule: {
            overallStatus: 'Recruiting'
          },
          designModule: {
            phases: ['Phase 2'],  // Correct phase
            studyType: 'Interventional'
          },
          conditionsModule: {
            conditions: ['Alzheimer\'s Disease']
          }
        }
      },
      {
        protocolSection: {
          identificationModule: {
            nctId: 'NCT002',
            briefTitle: 'Another Phase 2 Alzheimer Trial'
          },
          statusModule: {
            overallStatus: 'Active'
          },
          designModule: {
            phases: ['Phase 2'],  // Correct phase
            studyType: 'Interventional'
          },
          conditionsModule: {
            conditions: ['Alzheimer\'s Disease']
          }
        }
      },
      {
        protocolSection: {
          identificationModule: {
            nctId: 'NCT003',
            briefTitle: 'Phase 1 Alzheimer Trial (Should be filtered out)'
          },
          statusModule: {
            overallStatus: 'Recruiting'
          },
          designModule: {
            phases: ['Phase 1'],  // WRONG phase - this is the bug
            studyType: 'Interventional'
          },
          conditionsModule: {
            conditions: ['Alzheimer\'s Disease']
          }
        }
      }
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        studies: mockTrials,
        totalCount: 3
      })
    });

    await mockHandler(mockReq, mockRes);

    // Get the response
    const response = mockRes.json.mock.calls[0][0];
    
    // Test: All returned trials should be Phase 2
    const allPhase2 = response.trials.every((trial: any) => {
      return trial.phase && trial.phase.includes('Phase 2');
    });

    if (!allPhase2) {
      const incorrectPhases = response.trials
        .filter((trial: any) => !trial.phase || !trial.phase.includes('Phase 2'))
        .map((trial: any) => ({
          nctId: trial.nctId,
          phase: trial.phase,
          title: trial.briefTitle
        }));
      
      console.error('BUG DETECTED: Trials with incorrect phases found:', incorrectPhases);
    }

    expect(allPhase2).toBe(true);
    expect(response.trials.length).toBeLessThanOrEqual(3);
  });

  it('should only return Phase 3 trials when searching for GLP-1 drugs in Phase 3', async () => {
    // Mock request for Phase 3 GLP-1 trials
    const mockReq = {
      method: 'POST',
      body: {
        query: 'GLP-1 oral',
        phase: 'Phase 3',
        pageSize: 20
      }
    };

    // Mock the fetch response with mixed phases
    const mockTrials = [
      {
        protocolSection: {
          identificationModule: {
            nctId: 'NCT101',
            briefTitle: 'Oral GLP-1 Agonist Phase 3 Study'
          },
          statusModule: {
            overallStatus: 'Recruiting'
          },
          designModule: {
            phases: ['Phase 3'],  // Correct phase
            studyType: 'Interventional'
          },
          armsInterventionsModule: {
            interventions: [
              { type: 'Drug', name: 'Oral GLP-1 Agonist' }
            ]
          }
        }
      },
      {
        protocolSection: {
          identificationModule: {
            nctId: 'NCT102',
            briefTitle: 'GLP-1 Phase 2/3 Study'
          },
          statusModule: {
            overallStatus: 'Active'
          },
          designModule: {
            phases: ['Phase 2', 'Phase 3'],  // Should be acceptable
            studyType: 'Interventional'
          },
          armsInterventionsModule: {
            interventions: [
              { type: 'Drug', name: 'GLP-1 Receptor Agonist' }
            ]
          }
        }
      },
      {
        protocolSection: {
          identificationModule: {
            nctId: 'NCT103',
            briefTitle: 'Early Phase GLP-1 Study (Should be filtered)'
          },
          statusModule: {
            overallStatus: 'Recruiting'
          },
          designModule: {
            phases: ['Phase 1'],  // WRONG phase - this is the bug
            studyType: 'Interventional'
          },
          armsInterventionsModule: {
            interventions: [
              { type: 'Drug', name: 'GLP-1 Compound' }
            ]
          }
        }
      },
      {
        protocolSection: {
          identificationModule: {
            nctId: 'NCT104',
            briefTitle: 'Phase 2 GLP-1 Trial (Should be filtered)'
          },
          statusModule: {
            overallStatus: 'Active'
          },
          designModule: {
            phases: ['Phase 2'],  // WRONG phase - this is the bug
            studyType: 'Interventional'
          },
          armsInterventionsModule: {
            interventions: [
              { type: 'Drug', name: 'Oral GLP-1 Drug' }
            ]
          }
        }
      }
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        studies: mockTrials,
        totalCount: 4
      })
    });

    await mockHandler(mockReq, mockRes);

    // Get the response
    const response = mockRes.json.mock.calls[0][0];
    
    // Test: All returned trials should include Phase 3
    const allPhase3 = response.trials.every((trial: any) => {
      return trial.phase && trial.phase.some((p: string) => p.includes('Phase 3'));
    });

    if (!allPhase3) {
      const incorrectPhases = response.trials
        .filter((trial: any) => !trial.phase || !trial.phase.some((p: string) => p.includes('Phase 3')))
        .map((trial: any) => ({
          nctId: trial.nctId,
          phase: trial.phase,
          title: trial.briefTitle
        }));
      
      console.error('BUG DETECTED: Trials with incorrect phases found:', incorrectPhases);
    }

    expect(allPhase3).toBe(true);
  });

  it('should correctly build the phase query parameter', async () => {
    const mockReq = {
      method: 'POST',
      body: {
        condition: 'Alzheimer',
        phase: 'Phase 2',
        pageSize: 20
      }
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        studies: [],
        totalCount: 0
      })
    });

    await mockHandler(mockReq, mockRes);

    // Check if fetch was called with the correct query parameters
    const fetchCall = (global.fetch as any).mock.calls[0][0];
    
    // The URL should include AREA[Phase] in the query
    expect(fetchCall).toContain('AREA[Phase]Phase%202');
  });

  it('should handle mixed phase trials (e.g., Phase 2/3) appropriately', async () => {
    const mockReq = {
      method: 'POST',
      body: {
        condition: 'Diabetes',
        phase: 'Phase 3',
        pageSize: 20
      }
    };

    const mockTrials = [
      {
        protocolSection: {
          identificationModule: {
            nctId: 'NCT201',
            briefTitle: 'Phase 2/3 Diabetes Study'
          },
          statusModule: {
            overallStatus: 'Recruiting'
          },
          designModule: {
            phases: ['Phase 2', 'Phase 3'],  // Mixed phase - should be included
            studyType: 'Interventional'
          },
          conditionsModule: {
            conditions: ['Type 2 Diabetes']
          }
        }
      }
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        studies: mockTrials,
        totalCount: 1
      })
    });

    await mockHandler(mockReq, mockRes);

    const response = mockRes.json.mock.calls[0][0];
    
    // Mixed phase trials that include the requested phase should be acceptable
    expect(response.trials.length).toBe(1);
    expect(response.trials[0].phase).toContain('Phase 3');
  });

  it('should reject trials that are clearly in the wrong phase', async () => {
    const mockReq = {
      method: 'POST',
      body: {
        condition: 'Cancer',
        phase: 'Phase 3',
        pageSize: 20
      }
    };

    const mockTrials = [
      {
        protocolSection: {
          identificationModule: {
            nctId: 'NCT301',
            briefTitle: 'Early Phase 1 Cancer Study'
          },
          statusModule: {
            overallStatus: 'Recruiting'
          },
          designModule: {
            phases: ['Early Phase 1'],  // Should NOT be included for Phase 3 query
            studyType: 'Interventional'
          },
          conditionsModule: {
            conditions: ['Cancer']
          }
        }
      },
      {
        protocolSection: {
          identificationModule: {
            nctId: 'NCT302',
            briefTitle: 'Phase 4 Cancer Study'
          },
          statusModule: {
            overallStatus: 'Active'
          },
          designModule: {
            phases: ['Phase 4'],  // Should NOT be included for Phase 3 query
            studyType: 'Interventional'
          },
          conditionsModule: {
            conditions: ['Cancer']
          }
        }
      }
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        studies: mockTrials,
        totalCount: 2
      })
    });

    await mockHandler(mockReq, mockRes);

    const response = mockRes.json.mock.calls[0][0];
    
    // None of these trials should match Phase 3
    const anyPhase3 = response.trials.some((trial: any) => {
      return trial.phase && trial.phase.some((p: string) => p.includes('Phase 3'));
    });

    expect(anyPhase3).toBe(false);
  });
});

