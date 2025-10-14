// Vercel API Route for extracting drug names using Gemini
// Proxy to Google Gemini API for drug name extraction

interface ExtractDrugNamesRequest {
  text: string;
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
    const { text, context = 'general' }: ExtractDrugNamesRequest = req.body;

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
      general: 'Extract all drug names, medications, and therapeutic interventions.'
    };

    const prompt = `You are a medical AI expert specializing in pharmacology. Extract all drug names, medications, and therapeutic interventions from the following text.

Context: ${contextInstructions[context]}

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
- Extract brand names and generic names
- Include biological therapies, vaccines, and medical interventions
- Set confidence to "high" for standard drug names, "medium" for less common, "low" for uncertain
- For type: "drug" for pharmaceuticals, "intervention" for procedures, "therapy" for treatment approaches
- Return empty array if no drugs found
- Remove duplicates
- Only return the JSON object, nothing else`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`, {
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

