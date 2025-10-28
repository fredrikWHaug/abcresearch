// Vercel API Route for extracting drug names using Gemini
// Proxy to Google Gemini API for drug name extraction

interface ExtractDrugNamesRequest {
  text: string;
  userQuery?: string; // The original user search query for context
  context?: 'clinical_trial' | 'research_paper' | 'general';
}

interface DrugInfo {
  name: string;
  type?: string; // e.g., "drug", "intervention", "therapy"
  confidence: 'high' | 'medium' | 'low';
}

interface ExtractDrugNamesResponse {
  success: boolean;
  drugs: DrugInfo[];
}

// Deduplication helper function
function deduplicateDrugs(drugs: DrugInfo[]): DrugInfo[] {
  const seen = new Map<string, DrugInfo>();
  
  for (const drug of drugs) {
    // Normalize the drug name for comparison (lowercase, trim, remove extra spaces)
    const normalizedName = drug.name.toLowerCase().trim().replace(/\s+/g, ' ');
    
    if (!seen.has(normalizedName)) {
      // First occurrence - keep it
      seen.set(normalizedName, drug);
    } else {
      // Duplicate found - keep the one with higher confidence
      const existing = seen.get(normalizedName)!;
      const confidenceRank = { high: 3, medium: 2, low: 1 };
      
      if (confidenceRank[drug.confidence] > confidenceRank[existing.confidence]) {
        // Replace with higher confidence version
        seen.set(normalizedName, drug);
      }
      // If same confidence, keep the first one (already in map)
    }
  }
  
  return Array.from(seen.values());
}

export default async function handler(req: any, res: any) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text, userQuery, context = 'general' }: ExtractDrugNamesRequest = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'No text provided' });
    }

    const geminiApiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!geminiApiKey) {
      return res.status(500).json({ error: 'Google Gemini API key not configured' });
    }

    const contextInstructions = {
      clinical_trial: 'Focus on interventions, drug names, and therapies mentioned in clinical trial data.',
      research_paper: 'Extract drug names, compounds, and therapeutic agents mentioned in research papers.',
      general: 'Extract all drug names, medications, and therapeutic interventions that are relevant to the user query.'
    };

    const userQueryContext = userQuery 
      ? `\n\nUser's Original Query: "${userQuery}"\n\nFocus on extracting drugs that are relevant to what the user is searching for.` 
      : '';

    const prompt = `You are a pharmaceutical company research analyst extracting drug and therapeutic information from clinical trial and research data.

Context: ${contextInstructions[context]}${userQueryContext}

Text: "${text}"

Return ONLY a valid JSON object with this exact structure (no markdown, no explanations):

{
  "drugs": [
    {
      "name": "drug name",
      "type": "drug|intervention|therapy",
      "confidence": "high|medium|low"
    }
  ]
}

Rules:
- Extract brand names and generic names of actual pharmaceutical drugs
- Include biological therapies, vaccines, and medical interventions
- Set confidence to "high" for standard drug names, "medium" for less common, "low" for uncertain
- For type: "drug" for pharmaceuticals, "intervention" for procedures, "therapy" for treatment approaches
- Return empty array if no drugs found
- Only extract drugs that are relevant to the user's query

EXCLUSIONS - DO NOT extract:
- Placebo or placebo-controlled mentions
- Diagnostic tests or procedures
- Behavioral interventions or therapy
- "No intervention" or control groups
- Supplements (vitamins, minerals) unless specifically part of the user's query
- Medical devices unless specifically part of the user's query
- Sham treatments
- Standard of care references
- Control group comparators

Only return the JSON object, nothing else.`;

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
          temperature: 0.1,
          maxOutputTokens: 1000,
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', errorText);
      
      // Fallback to empty response if Gemini fails
      return res.status(200).json({
        success: true,
        drugs: []
      });
    }

    const data = await response.json();
    const content = data.candidates[0].content.parts[0].text;
    console.log('Gemini raw response:', content);

    // Parse the JSON response from Gemini
    let result: { drugs: DrugInfo[] };
    try {
      // Clean the response - remove any markdown formatting or extra text
      let cleanedContent = content.trim();
      
      // Remove markdown code blocks if present
      if (cleanedContent.startsWith('```json')) {
        cleanedContent = cleanedContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanedContent.startsWith('```')) {
        cleanedContent = cleanedContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      // Find JSON object in the response
      const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedContent = jsonMatch[0];
      }
      
      result = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', content);
      console.error('Parse error:', parseError);
      
      // Fallback: return empty array
      result = { drugs: [] };
    }

    // Deduplicate the drugs to ensure a clean final list
    const deduplicatedDrugs = deduplicateDrugs(result.drugs || []);

    // Filter out excluded terms unless they're in the user query
    const excludedTerms = ['placebo', 'diagnostic', 'behavioral', 'no intervention', 'supplement', 'device', 'control', 'sham', 'standard of care'];
    const userQueryLower = (userQuery || '').toLowerCase();
    
    const filteredDrugs = deduplicatedDrugs.filter((drug: DrugInfo) => {
      const nameLower = drug.name.toLowerCase().trim();
      
      // Check if this drug name contains any excluded term
      const containsExcludedTerm = excludedTerms.some(term => 
        nameLower === term || nameLower.includes(term)
      );
      
      if (!containsExcludedTerm) {
        return true; // Not an excluded term, keep it
      }
      
      // If it contains an excluded term, only keep it if the term is in the user query
      return excludedTerms.some(term => userQueryLower.includes(term) && nameLower.includes(term));
    });

    return res.status(200).json({
      success: true,
      drugs: filteredDrugs
    });

  } catch (error) {
    console.error('Error extracting drug names:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

