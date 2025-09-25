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

    const prompt = `You are a medical research expert. Given a user's search query for clinical trials, generate 3 different search strategies:

1. PRIMARY: Most specific and targeted search
2. ALTERNATIVE: Broader medical terms and synonyms  
3. BROAD: Very wide search to catch related trials

User Query: "${query}"

For each strategy, provide:
- condition: Medical condition (use standard medical terminology)
- sponsor: Company name (if mentioned)
- phase: Clinical trial phase (if mentioned)
- status: Trial status (if mentioned)
- query: Additional search terms

Format your response as JSON:
{
  "primary": {
    "condition": "string",
    "sponsor": "string", 
    "phase": "string",
    "status": "string",
    "query": "string"
  },
  "alternative": {
    "condition": "string",
    "sponsor": "string",
    "phase": "string", 
    "status": "string",
    "query": "string"
  },
  "broad": {
    "condition": "string",
    "sponsor": "string",
    "phase": "string",
    "status": "string", 
    "query": "string"
  }
}

Focus on medical accuracy and use ClinicalTrials.gov terminology.`;

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
      enhancedQueries = JSON.parse(content);
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', content);
      return res.status(500).json({ error: 'Failed to parse enhanced search queries' });
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
