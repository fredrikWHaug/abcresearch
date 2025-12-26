/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
// Vercel API Route for extracting drug names using Gemini
// Thin proxy to Google Gemini API - just handles LLM calls and JSON parsing

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
      clinical_trial: 'Focus on drug names, compounds and therapies that are the primary intervention in clinical trial data.',
      research_paper: 'Extract drug names, compounds, and therapeutic agents that are the focus of the research paper.',
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
- Extract brand names and generic names of pharmaceutical drugs that are the primary intervention(s) in the clinical trial or research paper.
- If it is a combination treatment (Blinatumomab Combined With Auto-HSCT Sandwich Strategy), extract the entire combination.
- Include biological therapies, small molecule drugs, vaccines, and medical interventions
- Set confidence to "high" for standard drug names, "medium" for less common, "low" for uncertain
- For type: "drug" for pharmaceuticals, "intervention" for procedures, "therapy" for treatment approaches
- Return empty array if no drugs found
- Only extract drugs that are relevant to the user's query

EXCLUSIONS - DO NOT extract:
- Placebo or placebo-controlled mentions
- Diagnostic tests or procedures (e.g., blood tests, imaging)
- Behavioral interventions or therapy (e.g., counseling, lifestyle modifications)
- "No intervention" or control groups
- Supplements (vitamins, minerals) unless specifically part of the user's query
- Medical devices unless specifically part of the user's query
- Sham treatments or sham procedures
- Standard of care references
- Control group comparators
- Generic drug class names alone (e.g., "GLP-1", "SGLT2", "DPP-4", "ACE inhibitor", "beta blocker", "statin", CAR-T, etc.)
- Very generic terms (e.g., "insulin", "metformin", "aspirin", "chemotherapy", "radiation", "surgery")
- Generic descriptors (e.g., "combination", "monotherapy", "therapy", "treatment", "intervention", "drug", "medication", "agent")
- Terms that are too short (3 characters or less) or likely acronyms without clear drug identity

Only return the JSON object, nothing else.`;

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
          temperature: 0.1,
          maxOutputTokens: 1000,
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', errorText);
      
      return res.status(500).json({
        success: false,
        error: 'Drug extraction failed',
        details: errorText
      });
    }

    const data = await response.json();
    const content = data.candidates[0].content.parts[0].text;

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
      
      return res.status(500).json({
        success: false,
        error: 'Failed to parse drug extraction response',
        details: parseError instanceof Error ? parseError.message : 'Unknown parsing error'
      });
    }

    // Return raw results - let the service handle deduplication and filtering
    return res.status(200).json({
      success: true,
      drugs: result.drugs || []
    });

  } catch (error) {
    console.error('Error extracting drug names:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

