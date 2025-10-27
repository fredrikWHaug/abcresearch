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
 * Goal: UNCOVER drugs in all stages (discovery → approved) via concept/phrase searches
 */
function generateInitialSearchPrompt(query: string): string {
  return `You are a medical research expert specializing in drug discovery through clinical trial searches.

USER QUERY: "${query}"

Your goal is to DISCOVER drugs across all development stages (preclinical, Phase 1-4, approved) by searching for CONCEPTS and PHRASES, not specific drug names.

Generate EXACTLY 5 search strategies that cast a wide net to uncover drugs. Focus on:

1. **Therapeutic mechanisms** (e.g., "GLP-1 receptor agonist", "PD-1 inhibitor")
2. **Disease + mechanism** (e.g., "diabetes incretin", "obesity GLP-1")
3. **Development stage + mechanism** (e.g., "Phase 3 GLP-1", "novel incretin mimetic")
4. **Alternative terminology** (e.g., "glucagon-like peptide", "incretin-based therapy")
5. **Broad discovery** (e.g., "anti-obesity agent", "glucose-lowering therapy")

CRITICAL RULES:
- DO NOT search for specific drug names (e.g., NOT "semaglutide" or "tirzepatide")
- DO search for drug CLASSES, MECHANISMS, INDICATIONS, CONCEPTS
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

Example for "GLP-1":
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
