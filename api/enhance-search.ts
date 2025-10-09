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
  console.log('🔍 Enhance Search API called');
  console.log('Method:', req.method);
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);

  if (req.method !== 'POST') {
    console.log('❌ Method not allowed:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { query }: EnhancedSearchRequest = req.body;
    console.log('📝 Query received:', query);

    if (!query || query.trim().length === 0) {
      console.log('❌ No query provided');
      return res.status(400).json({ error: 'No query provided' });
    }

    const geminiApiKey = process.env.GOOGLE_GEMINI_API_KEY;
    console.log('🔑 Gemini API key exists:', !!geminiApiKey);
    console.log('🔑 Gemini API key length:', geminiApiKey?.length || 0);
    
    if (!geminiApiKey) {
      console.log('❌ Google Gemini API key not configured');
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
- For "phase" use ONLY: "PHASE1", "PHASE2", "PHASE3", "PHASE4", or null
- For "status" use ONLY: "RECRUITING", "ACTIVE_NOT_RECRUITING", "COMPLETED", "TERMINATED", or null
- For "condition" and "sponsor": use simple terms (e.g., "cancer", "Pfizer")
- For "query": use simple keywords, not full sentences
- Return null for fields that don't apply
- Only return the JSON object, nothing else`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`;
    console.log('🌐 Calling Gemini API:', geminiUrl.replace(geminiApiKey, 'API_KEY_HIDDEN'));
    
    const requestBody = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1000,
      }
    };
    console.log('📤 Request body:', JSON.stringify(requestBody, null, 2));

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    console.log('📥 Gemini API response status:', response.status);
    console.log('📥 Gemini API response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Gemini API error:', errorText);
      console.error('❌ Response status:', response.status);
      console.error('❌ Response status text:', response.statusText);
      
      // Fallback to basic search if Gemini fails
      console.log('🔄 Falling back to basic search');
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
    console.log('📥 Gemini API full response:', JSON.stringify(data, null, 2));
    
    const content = data.candidates[0].content.parts[0].text;
    console.log('📝 Gemini raw response text:', content);

    // Parse the JSON response from Gemini
    let enhancedQueries;
    try {
      // Clean the response - remove any markdown formatting or extra text
      let cleanedContent = content.trim();
      console.log('🧹 Cleaning response content...');
      
      // Remove markdown code blocks if present
      if (cleanedContent.startsWith('```json')) {
        cleanedContent = cleanedContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        console.log('🧹 Removed ```json markdown');
      } else if (cleanedContent.startsWith('```')) {
        cleanedContent = cleanedContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
        console.log('🧹 Removed ``` markdown');
      }
      
      // Find JSON object in the response
      const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedContent = jsonMatch[0];
        console.log('🧹 Extracted JSON from response');
      }
      
      console.log('🧹 Final cleaned content:', cleanedContent);
      enhancedQueries = JSON.parse(cleanedContent);
      console.log('✅ Successfully parsed enhanced queries:', enhancedQueries);
    } catch (parseError) {
      console.error('❌ Failed to parse Gemini response:', content);
      console.error('❌ Parse error:', parseError);
      
      // Fallback: return a simple search strategy
      console.log('🔄 Using fallback search strategy');
      enhancedQueries = {
        primary: { query: query },
        alternative: { query: query },
        broad: { query: query }
      };
    }

    console.log('✅ Returning enhanced queries:', enhancedQueries);
    return res.status(200).json({
      success: true,
      enhancedQueries
    });

  } catch (error) {
    console.error('Error enhancing search:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
