/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import Anthropic from '@anthropic-ai/sdk';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface ClinicalTrial {
  nctId: string;
  briefTitle: string;
  officialTitle?: string;
  overallStatus: string;
  phase?: string[];
  conditions?: string[];
  interventions?: string[];
  sponsors?: {
    lead?: string;
    collaborators?: string[];
  };
  startDate?: string;
  completionDate?: string;
  enrollment?: number;
  studyType?: string;
}

interface PubMedArticle {
  pmid: string;
  title: string;
  abstract: string;
  authors?: string[];
  journal: string;
  publicationDate: string;
  doi?: string;
}

interface DrugGroup {
  drugName: string;
  trials: ClinicalTrial[];
  papers: PubMedArticle[];
}

interface PipelineDrugCandidate {
  id: string;
  commercialName?: string;
  scientificName: string;
  sponsorCompany: string;
  stage: 'Marketed' | 'Phase III' | 'Phase II' | 'Phase I' | 'Pre-Clinical' | 'Discovery';
  technologies?: string;
  mechanismOfAction?: string;
  indications?: string[];
  lastTrialStartDate?: string;
  confidence?: number;
  totalEnrollment?: number;
}

/**
 * Generate a comprehensive prompt for extracting pipeline data
 */
function generatePrompt(drugGroup: DrugGroup): string {
  const { drugName, trials, papers } = drugGroup;
  
  // Format trials data
  const trialsText = trials.slice(0, 10).map(t => `
Trial NCT${t.nctId}:
- Title: ${t.briefTitle}
- Phase: ${t.phase?.join(', ') || 'N/A'}
- Status: ${t.overallStatus}
- Sponsor: ${t.sponsors?.lead || 'Unknown'}
- Interventions: ${t.interventions?.join(', ') || 'N/A'}
- Conditions: ${t.conditions?.join(', ') || 'N/A'}
- Start Date: ${t.startDate || 'N/A'}
`).join('\n');

  // Format papers data (top 10 most relevant)
  const papersText = papers.slice(0, 10).map(p => `
Paper PMID ${p.pmid}:
- Title: ${p.title}
- Abstract: ${p.abstract.slice(0, 500)}${p.abstract.length > 500 ? '...' : ''}
- Journal: ${p.journal}
- Date: ${p.publicationDate}
`).join('\n');

  return `You are a pharmaceutical research analyst. Extract structured information about this drug candidate from the provided clinical trials and research papers.

DRUG NAME: ${drugName}

CLINICAL TRIALS DATA:
${trialsText}

RESEARCH PAPERS DATA:
${papersText}

Based on the data above, extract the following information about ${drugName}:

1. **Commercial Name**: If this drug has a marketed brand name (often includes ™ or ®), provide it. If not marketed yet, return null.

2. **Scientific Name**: The generic/INN name or compound identifier (e.g., "Aducanumab", "BAN2401", "ALZ-801")

3. **Sponsor Company**: The lead organization developing this drug (from trial sponsors)

4. **Development Stage**: Determine the most advanced stage achieved in the United States:
   - "Marketed" - If approved/marketed or started Phase 4
   - "Phase III" - If any Phase 3 trials exist
   - "Phase II" - If any Phase 2 trials exist (but no Phase 3)
   - "Phase I" - If only Phase 1 trials exist
   - "Pre-Clinical" - If early stage or pre-clinical studies only
   - "Discovery" - If in discovery phase

5. **Technologies**: The type of drug molecule/technology:
   - "Biologics" (for monoclonal antibodies, proteins)
   - "Small Molecule" (for traditional oral drugs)
   - "Gene Therapy" (for gene/RNA-based therapies)
   - "Cell Therapy" (for cell-based treatments)
   - "Peptide" (for peptide-based drugs)

6. **Mechanism of Action**: Brief description of how the drug works (e.g., "Anti-amyloid beta monoclonal antibody", "NMDA receptor antagonist", "Tau aggregation inhibitor")

7. **Indications**: List of diseases/conditions being treated (from trial conditions)

8. **Last Trial Start Date**: The most recent trial start date in YYYY-MM-DD format

Return ONLY a valid JSON object in this exact format (no markdown, no explanation):
{
  "commercialName": "string or null",
  "scientificName": "string",
  "sponsorCompany": "string",
  "stage": "Marketed|Phase III|Phase II|Phase I|Pre-Clinical|Discovery",
  "technologies": "string",
  "mechanismOfAction": "string",
  "indications": ["string"],
  "lastTrialStartDate": "YYYY-MM-DD or null"
}`;
}

/**
 * Parse JSON from LLM response, handling various formats
 */
function parseJSON(response: string): any {
  // Remove markdown code blocks if present
  let cleaned = response.trim();
  cleaned = cleaned.replace(/```json\n?/g, '');
  cleaned = cleaned.replace(/```\n?/g, '');
  cleaned = cleaned.trim();
  
  try {
    return JSON.parse(cleaned);
  } catch (error) {
    console.error('Failed to parse JSON:', cleaned);
    throw new Error('Invalid JSON response from LLM');
  }
}

/**
 * Calculate total enrollment across all trials for a drug
 */
function calculateTotalEnrollment(trials: ClinicalTrial[]): number {
  return trials.reduce((total, trial) => {
    return total + (trial.enrollment || 0);
  }, 0);
}

/**
 * Extract pipeline data for a single drug using Claude
 * 
 * Model: Claude 3.5 Haiku
 * - Cost effective: $0.80/1M input, $4/1M output (74% cheaper than Sonnet)
 * - Fast response time (~1-2s per drug)
 * - Excellent for structured extraction tasks
 * - Cost per extraction: ~$0.046 (10 drugs)
 */
async function extractDrugData(drugGroup: DrugGroup): Promise<PipelineDrugCandidate> {
  const prompt = generatePrompt(drugGroup);
  
  try {
    const message = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 2048, // Sufficient for detailed JSON with mechanism descriptions
      temperature: 0, // Deterministic output for consistency
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const responseText = message.content[0].type === 'text' 
      ? message.content[0].text 
      : '';
    
    const extracted = parseJSON(responseText);
    
    // Validate required fields
    if (!extracted.scientificName || !extracted.sponsorCompany || !extracted.stage) {
      throw new Error('Missing required fields in LLM response');
    }
    
    // Calculate total enrollment
    const totalEnrollment = calculateTotalEnrollment(drugGroup.trials);
    
    // Build candidate object
    const candidate: PipelineDrugCandidate = {
      id: drugGroup.drugName.toLowerCase(),
      commercialName: extracted.commercialName || undefined,
      scientificName: extracted.scientificName,
      sponsorCompany: extracted.sponsorCompany,
      stage: extracted.stage,
      technologies: extracted.technologies || 'Unknown',
      mechanismOfAction: extracted.mechanismOfAction || 'Unknown',
      indications: Array.isArray(extracted.indications) ? extracted.indications : [],
      lastTrialStartDate: extracted.lastTrialStartDate || undefined,
      confidence: 0.9, // High confidence for Claude extraction
      totalEnrollment: totalEnrollment > 0 ? totalEnrollment : undefined
    };
    
    return candidate;
  } catch (error) {
    console.error(`Error extracting data for ${drugGroup.drugName}:`, error);
    throw error;
  }
}

/**
 * Main API handler
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { drugGroups, limit = 10 } = req.body as { drugGroups: DrugGroup[]; limit?: number };

    if (!drugGroups || !Array.isArray(drugGroups)) {
      return res.status(400).json({ error: 'Invalid request: drugGroups array required' });
    }

    if (drugGroups.length === 0) {
      return res.status(200).json({ candidates: [] });
    }

    // Validate limit
    const requestedLimit = Math.min(Math.max(1, limit), 50); // Cap at 50 for cost control

    // Sort by combined papers + trials count (descending)
    const sortedDrugs = [...drugGroups]
      .sort((a, b) => {
        const aTotal = a.papers.length + a.trials.length;
        const bTotal = b.papers.length + b.trials.length;
        return bTotal - aTotal;
      })
      .slice(0, requestedLimit);

    console.log(`Processing top ${sortedDrugs.length} drugs (out of ${drugGroups.length} total)`);
    console.log('Top drugs:', sortedDrugs.map(d => 
      `${d.drugName} (${d.papers.length} papers, ${d.trials.length} trials)`
    ));

    // Extract data for each drug sequentially (to avoid rate limits)
    const candidates: PipelineDrugCandidate[] = [];
    const errors: string[] = [];

    for (let i = 0; i < sortedDrugs.length; i++) {
      const drugGroup = sortedDrugs[i];
      console.log(`Processing ${i + 1}/${sortedDrugs.length}: ${drugGroup.drugName}`);
      
      try {
        const candidate = await extractDrugData(drugGroup);
        candidates.push(candidate);
        
        // Small delay to avoid rate limits
        if (i < sortedDrugs.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        const errorMsg = `Failed to process ${drugGroup.drugName}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    return res.status(200).json({
      candidates,
      totalProcessed: candidates.length,
      totalRequested: drugGroups.length,
      limit: requestedLimit,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Error in generate-asset-pipeline-table:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

