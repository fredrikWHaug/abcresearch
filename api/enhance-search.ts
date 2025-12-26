/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
// Vercel API Route for enhancing search queries with Gemini
// Generates flexible, comprehensive search strategies using LLM

interface EnhancedSearchRequest {
  query: string;
  searchType?: 'initial' | 'drug-specific';
  context?: string; // Additional context (e.g., original query for drug searches)
}

interface SearchStrategy {
  query: string; // For backwards compatibility - will be deprecated
  queryTerm?: string; // General search terms (excluding phase and drug names)
  phase?: string; // Specific phase (e.g., "Phase 2", "Phase 1|Phase 2")
  interventionName?: string; // Drug names with spelling corrections and synonyms
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

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-lite:generateContent?key=${geminiApiKey}`, {
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
      
      return res.status(500).json({
        success: false,
        error: 'Search enhancement failed',
        details: errorText
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
      
      return res.status(500).json({
        success: false,
        error: 'Failed to parse search enhancement response',
        details: parseError instanceof Error ? parseError.message : 'Unknown parsing error'
      });
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
  return `You are a pharmaceutical company research analyst generating STRUCTURED search strategies for ClinicalTrials.gov API v2.

USER QUERY: "${query}"

CRITICAL: You must generate STRUCTURED queries using the ClinicalTrials.gov API v2 field system. Think carefully about the fields available to you. 

QUERY STRUCTURE:
1. **phase**: Extract phase information and put it in the SEPARATE PHASE field
   - Examples: "Phase 1", "Phase 2", "Phase 3", "Phase 4", "Phase 1|Phase 2" (for multiple phases)
   - If user specifies phase, extract it. If no phase specified, leave this field empty or use strategic phases
   
2. **interventionName**: For SPECIFIC drug names (if mentioned), put corrected spelling and key synonyms here
   - Correct any spelling errors in drug names
   - Include brand names and generic names as synonyms (use | separator)
   - Example: "semaglutide|Ozempic|Wegovy" or "tirzepatide|Mounjaro"
   - Leave EMPTY if searching by mechanism/class (discovery searches)
   
3. **queryTerm**: General search terms EXCLUDING phase and specific drug names
   - Mechanisms (e.g., "GLP-1 receptor agonist")
   - Indications (e.g., "diabetes", "obesity")
   - Drug classes and therapeutic approaches
   - DO NOT repeat phase or drug names here

4. **query**: Deprecated fallback - combine all terms if structured fields aren't suitable

SEARCH STRATEGY TYPES:
- For DISCOVERY searches (no specific drug): Use queryTerm with mechanisms/classes, leave interventionName empty
- For SPECIFIC drug searches: Extract drug name to interventionName, use queryTerm for mechanism/indication
- ALWAYS extract phase to separate phase field if mentioned

Generate EXACTLY 5 search strategies that uncover drugs. Focus on:

1. **Therapeutic mechanisms** 
2. **Disease + mechanism**
3. **Alternative terminology** 
4. **Indication-based** 
5. **Formulation variations**

CRITICAL RULES:
- ALWAYS extract phase to the "phase" field if specified by user
- ALWAYS extract specific drug names to "interventionName" field with synonyms
- Use "queryTerm" for mechanisms, indications, and classes (NOT phase or drug names)
- For discovery: leave interventionName empty, use queryTerm for mechanism/class
- Match user's phase requirement: if they specify Phase 2, ALL queries should have "phase": "Phase 2"
- Limit to EXACTLY 5 strategies

Return ONLY a valid JSON array with EXACTLY 5 strategies (no markdown):

[
  {
    "queryTerm": "mechanism or class here",
    "phase": "Phase X" or "",
    "interventionName": "drugName|synonym|brandName" or "",
    "query": "fallback combined query",
    "description": "what this discovers",
    "priority": "high|medium|low",
    "searchType": "mechanism|indication|stage|synonym|broad"
  }
]

Example for "Phase 2 GLP-1 receptor agonist":
[
  {"queryTerm": "GLP-1 receptor agonist", "phase": "Phase 2", "interventionName": "", "query": "Phase 2 GLP-1 receptor agonist", "description": "Primary mechanism in Phase 2", "priority": "high", "searchType": "mechanism"},
  {"queryTerm": "incretin mimetic", "phase": "Phase 2", "interventionName": "", "query": "Phase 2 incretin mimetic", "description": "Alternative term in Phase 2", "priority": "high", "searchType": "synonym"},
  {"queryTerm": "glucagon-like peptide diabetes", "phase": "Phase 2", "interventionName": "", "query": "Phase 2 glucagon-like peptide diabetes", "description": "Full name + indication Phase 2", "priority": "medium", "searchType": "synonym"},
  {"queryTerm": "GLP-1 obesity", "phase": "Phase 2", "interventionName": "", "query": "Phase 2 GLP-1 obesity", "description": "Secondary indication Phase 2", "priority": "medium", "searchType": "indication"},
  {"queryTerm": "oral GLP-1 receptor agonist", "phase": "Phase 2", "interventionName": "", "query": "Phase 2 oral GLP-1", "description": "Oral delivery Phase 2", "priority": "medium", "searchType": "broad"}
]

Example for "semaglutide Phase 3 trials":
[
  {"queryTerm": "", "phase": "Phase 3", "interventionName": "semaglutide|Ozempic|Wegovy", "query": "Phase 3 semaglutide", "description": "Direct semaglutide search Phase 3", "priority": "high", "searchType": "targeted"},
  {"queryTerm": "GLP-1 receptor agonist", "phase": "Phase 3", "interventionName": "", "query": "Phase 3 GLP-1 receptor agonist", "description": "Mechanism class Phase 3", "priority": "high", "searchType": "mechanism"},
  {"queryTerm": "", "phase": "Phase 3", "interventionName": "semaglutide", "query": "Phase 3 semaglutide diabetes", "description": "Semaglutide diabetes trials", "priority": "medium", "searchType": "indication"},
  {"queryTerm": "", "phase": "Phase 3", "interventionName": "semaglutide", "query": "Phase 3 semaglutide obesity", "description": "Semaglutide weight loss trials", "priority": "medium", "searchType": "indication"},
  {"queryTerm": "incretin mimetic", "phase": "Phase 3", "interventionName": "", "query": "Phase 3 incretin", "description": "Alternative term Phase 3", "priority": "low", "searchType": "synonym"}
]

Example for "Alzheimer's Phase 1 trials":
[
  {"queryTerm": "Alzheimer beta-amyloid inhibitor", "phase": "Phase 1", "interventionName": "", "query": "Phase 1 Alzheimer beta-amyloid", "description": "Primary mechanism Phase 1", "priority": "high", "searchType": "mechanism"},
  {"queryTerm": "Alzheimer tau protein", "phase": "Phase 1", "interventionName": "", "query": "Phase 1 Alzheimer tau", "description": "Alternative target Phase 1", "priority": "high", "searchType": "mechanism"},
  {"queryTerm": "cognitive decline neurodegeneration", "phase": "Phase 1", "interventionName": "", "query": "Phase 1 cognitive decline", "description": "Symptom-based Phase 1", "priority": "medium", "searchType": "indication"},
  {"queryTerm": "Alzheimer immunotherapy", "phase": "Phase 1", "interventionName": "", "query": "Phase 1 Alzheimer immunotherapy", "description": "Treatment approach Phase 1", "priority": "medium", "searchType": "synonym"},
  {"queryTerm": "dementia neuroprotection", "phase": "Phase 1", "interventionName": "", "query": "Phase 1 dementia neuroprotection", "description": "Related indication Phase 1", "priority": "medium", "searchType": "broad"}
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
