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
    
    // If no Gemini API key, return simple fallback immediately
    if (!geminiApiKey) {
      console.log('No Gemini API key configured, using simple search strategy');
      return res.status(200).json({
        success: true,
        enhancedQueries: {
          primary: { query: query },
          alternative: { query: query },
          broad: { query: query }
        }
      });
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
- For "phase" use ONLY: "PHASE1", "PHASE2", "PHASE3", "PHASE4", or null
- For "status" use ONLY: "RECRUITING", "ACTIVE_NOT_RECRUITING", "COMPLETED", "TERMINATED", or null
- For "condition" and "sponsor": use simple terms (e.g., "cancer", "Pfizer")
- For "query": use simple keywords, not full sentences
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
      
      // Fallback to basic search if Gemini fails
      return res.status(200).json({
        success: true,
        enhancedQueries: {
          primary: { query: query },
          alternative: { query: query },
          broad: { query: query }
        }
      });
    }

    const data = await response.json();
    const content = data.candidates[0].content.parts[0].text;
    console.log('Gemini raw response:', content);

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
