// Vercel API Route for enhancing search queries with Gemini

interface EnhancedSearchRequest {
  query: string;
}

interface EnhancedSearchResponse {
  success: boolean;
  enhancedQueries: {
    primary: any;
    alternative: any;
    broad: any;
  };
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { query }: EnhancedSearchRequest = req.body;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({ error: 'No query provided' });
    }

    const geminiApiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!geminiApiKey) {
      return res.status(500).json({ error: 'Google Gemini API key not configured' });
    }

    const prompt = `You are a medical research expert. Given a user's search query for clinical trials, generate 3 different search strategies.

User Query: "${query}"

Return ONLY a valid JSON object with this exact structure (no markdown, no explanations):

{
  "primary": {
    "condition": "string or null",
    "sponsor": "string or null", 
    "phase": "string or null",
    "status": "string or null",
    "query": "string"
  },
  "alternative": {
    "condition": "string or null",
    "sponsor": "string or null",
    "phase": "string or null", 
    "status": "string or null",
    "query": "string"
  },
  "broad": {
    "condition": "string or null",
    "sponsor": "string or null",
    "phase": "string or null",
    "status": "string or null", 
    "query": "string"
  }
}

Rules:
- PRIMARY: Most specific and targeted search
- ALTERNATIVE: Broader medical terms and synonyms  
- BROAD: Very wide search to catch related trials
- Use ClinicalTrials.gov terminology
- Return null for fields that don't apply
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
          temperature: 0.3,
          maxOutputTokens: 1000,
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', errorText);
      return res.status(500).json({ error: 'Failed to enhance search query' });
    }

    const data = await response.json();
    const content = data.candidates[0].content.parts[0].text;

    // Parse the JSON response from Gemini
    let enhancedQueries;
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
      
      enhancedQueries = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', content);
      console.error('Parse error:', parseError);
      
      // Fallback: return a simple search strategy
      enhancedQueries = {
        primary: { query: query },
        alternative: { query: query },
        broad: { query: query }
      };
    }

    return res.status(200).json({
      success: true,
      enhancedQueries
    });

  } catch (error) {
    console.error('Error enhancing search:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
