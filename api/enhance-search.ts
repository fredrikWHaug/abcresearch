// Vercel API Route for enhancing search queries with Gemini
// Generates flexible, comprehensive search strategies using LLM

interface EnhancedSearchRequest {
  query: string;
  searchType?: 'initial' | 'drug-specific';
  context?: string; // Additional context (e.g., original query for drug searches)
}

interface SearchStrategy {
  query: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  searchType: 'targeted' | 'broad' | 'synonym' | 'brand' | 'indication' | 'combination';
}

interface EnhancedSearchResponse {
  success: boolean;
  strategies: SearchStrategy[];
  totalStrategies: number;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { query, searchType = 'initial', context = '' }: EnhancedSearchRequest = req.body;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({ error: 'No query provided' });
    }

    const geminiApiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!geminiApiKey) {
      return res.status(500).json({ error: 'Google Gemini API key not configured' });
    }

    // Generate different prompts based on search type
    const prompt = searchType === 'drug-specific' 
      ? generateDrugSpecificPrompt(query, context)
      : generateInitialSearchPrompt(query);

    console.log(`Enhancing ${searchType} search for: "${query}"`);
    if (context) console.log(`Context: "${context}"`);;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 2000, // Increased for multiple strategies
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', errorText);
      
      // Fallback to basic search strategies
      return res.status(200).json({
        success: true,
        strategies: [
          {
            query: query,
            description: 'Original query',
            priority: 'high',
            searchType: 'targeted'
          }
        ],
        totalStrategies: 1
      });
    }

    const data = await response.json();
    const content = data.candidates[0].content.parts[0].text;
    console.log('Gemini raw response:', content);

    // Parse the JSON response from Gemini
    let strategies: SearchStrategy[];
    try {
      // Clean the response - remove any markdown formatting
      let cleanedContent = content.trim();
      
      if (cleanedContent.startsWith('```json')) {
        cleanedContent = cleanedContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanedContent.startsWith('```')) {
        cleanedContent = cleanedContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      // Find JSON array or object in the response
      const jsonMatch = cleanedContent.match(/\[[\s\S]*\]|\{[\s\S]*"strategies"[\s\S]*\}/);
      if (jsonMatch) {
        cleanedContent = jsonMatch[0];
      }
      
      const parsed = JSON.parse(cleanedContent);
      
      // Handle both array and object responses
      if (Array.isArray(parsed)) {
        strategies = parsed;
      } else if (parsed.strategies && Array.isArray(parsed.strategies)) {
        strategies = parsed.strategies;
      } else {
        throw new Error('Invalid response format');
      }
      
      console.log(`Successfully parsed ${strategies.length} search strategies`);
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', content);
      console.error('Parse error:', parseError);
      
      // Fallback: return basic strategies
      strategies = [
        {
          query: query,
          description: 'Original query',
          priority: 'high',
          searchType: 'targeted'
        }
      ];
    }

    return res.status(200).json({
      success: true,
      strategies,
      totalStrategies: strategies.length
    });

  } catch (error) {
    console.error('Error enhancing search:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Generate prompt for discovery-focused phrase searches
 * Goal: UNCOVER drugs by matching the user's intent (including phase/stage if specified)
 */
function generateInitialSearchPrompt(query: string): string {
  return `You are a pharmaceutical company research analyst generating search strategies for clinical trial discovery.

USER QUERY: "${query}"

PHASE/STAGE HANDLING:
- If the user mentions a specific phase or stage (e.g., "Phase 2 trials", "Phase 3"), include that phase in ALL 5 search queries
- If no phase is mentioned, generate diverse queries across different stages or without stage constraints
- Match the user's intent exactly - if they want Phase 2 only, all queries should focus on Phase 2

Your goal is to DISCOVER drugs by searching for CONCEPTS and PHRASES, not specific drug names.

Generate EXACTLY 5 search strategies that uncover drugs. Focus on:

1. **Therapeutic mechanisms** (e.g., "GLP-1 receptor agonist", "PD-1 inhibitor")
2. **Disease + mechanism** (e.g., "diabetes incretin", "obesity GLP-1")
3. **Alternative terminology** (e.g., "glucagon-like peptide", "incretin-based therapy")
4. **Indication-based** (e.g., "anti-obesity agent", "glucose-lowering therapy")
5. **Formulation/delivery** (e.g., "oral GLP-1", "subcutaneous incretin")

CRITICAL RULES:
- DO NOT search for specific drug names (e.g., NOT "semaglutide" or "tirzepatide")
- DO search for drug CLASSES, MECHANISMS, INDICATIONS, CONCEPTS
- Match the user's phase requirement: if they specify a phase, include it in ALL queries
- Focus on discovering UNKNOWN/EMERGING drugs
- Each query should discover different subsets of drugs
- Limit to EXACTLY 5 strategies

For each strategy, provide:
- query: Phrase-based search string (NO specific drug names)
- description: What types of drugs this will uncover
- priority: "high" (essential), "medium" (important), "low" (exploratory)
- searchType: "mechanism", "indication", "stage", "synonym", or "broad"

Return ONLY a valid JSON array with EXACTLY 5 strategies (no markdown):

[
  {
    "query": "phrase here (no drug names)",
    "description": "discovers X type of drugs",
    "priority": "high|medium|low",
    "searchType": "mechanism|indication|stage|synonym|broad"
  }
]

Example for "Alzheimer's drugs in Phase 2 trials":
[
  {"query": "Phase 2 Alzheimer beta-amyloid inhibitor", "description": "Primary mechanism in Phase 2", "priority": "high", "searchType": "mechanism"},
  {"query": "Phase 2 Alzheimer tau protein", "description": "Alternative target in Phase 2", "priority": "high", "searchType": "mechanism"},
  {"query": "Phase 2 cognitive decline neurodegeneration", "description": "Symptom-based Phase 2 trials", "priority": "medium", "searchType": "indication"},
  {"query": "Phase 2 Alzheimer immunotherapy", "description": "Treatment approach in Phase 2", "priority": "medium", "searchType": "synonym"},
  {"query": "Phase 2 dementia neuroprotection", "description": "Related indication in Phase 2", "priority": "medium", "searchType": "broad"}
]

Example for "GLP-1 oral drugs in Phase 3 trials":
[
  {"query": "Phase 3 oral GLP-1 receptor agonist", "description": "Oral delivery in Phase 3", "priority": "high", "searchType": "mechanism"},
  {"query": "Phase 3 oral incretin mimetic", "description": "Alternative term oral Phase 3", "priority": "high", "searchType": "synonym"},
  {"query": "Phase 3 oral glucagon-like peptide diabetes", "description": "Full name oral Phase 3", "priority": "medium", "searchType": "synonym"},
  {"query": "Phase 3 oral GLP-1 weight loss", "description": "Secondary indication oral Phase 3", "priority": "medium", "searchType": "indication"},
  {"query": "Phase 3 oral GLP-1 once-daily", "description": "Dosing variation oral Phase 3", "priority": "medium", "searchType": "broad"}
]

Example for "GLP-1 drugs" (no phase specified):
[
  {"query": "GLP-1 receptor agonist diabetes", "description": "Primary mechanism + indication", "priority": "high", "searchType": "mechanism"},
  {"query": "incretin mimetic obesity", "description": "Alternative term + secondary indication", "priority": "high", "searchType": "synonym"},
  {"query": "glucagon-like peptide cardiovascular", "description": "Full name + CV outcomes", "priority": "medium", "searchType": "synonym"},
  {"query": "Phase 3 GLP-1 weight loss", "description": "Late-stage trials", "priority": "medium", "searchType": "stage"},
  {"query": "novel GLP-1 oral formulation", "description": "Emerging delivery methods", "priority": "medium", "searchType": "broad"}
]`;
}

/**
 * DEPRECATED: Drug-specific searches are NOT used
 * Keeping for potential future use, but discovery approach is phrase-based only
 */
function generateDrugSpecificPrompt(drugName: string, originalQuery: string): string {
  // This prompt is no longer used in the discovery-focused approach
  // Discovery happens through phrase-based searches, not drug-specific queries
  return generateInitialSearchPrompt(originalQuery);
}
