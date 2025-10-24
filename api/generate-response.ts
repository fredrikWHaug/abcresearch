// Vercel API Route for generating dynamic AI responses

interface GenerateResponseRequest {
  userQuery: string;
  contextPapers?: Array<{
    pmid: string;
    title: string;
    abstract: string;
    journal: string;
    publicationDate: string;
    authors: string[];
  }>;
  searchResults?: {
    trials: any[];
    papers: any[];
    totalCount: number;
    searchStrategies: {
      primary: { count: number; trials: any[] };
      alternative: { count: number; trials: any[] };
      broad: { count: number; trials: any[] };
    };
  };
}

interface GenerateResponseResponse {
  success: boolean;
  response: string;
  shouldSearch: boolean;
  searchQuery?: string;
  searchSuggestions?: Array<{
    id: string;
    label: string;
    query: string;
    description?: string;
  }>;
  intent: 'greeting' | 'search_request' | 'follow_up' | 'clarification' | 'general_question';
}

export default async function handler(req: any, res: any) {
  console.log('API endpoint called with method:', req.method);
  console.log('Request body:', req.body);
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userQuery, searchResults, contextPapers }: GenerateResponseRequest = req.body;
    console.log('Parsed userQuery:', userQuery);
    console.log('Parsed searchResults:', searchResults);
    console.log('Context papers count:', contextPapers?.length || 0);

    if (!userQuery) {
      console.log('No userQuery provided');
      return res.status(400).json({ error: 'User query is required' });
    }

    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    console.log('Anthropic API key exists:', !!anthropicApiKey);
    if (!anthropicApiKey) {
      return res.status(500).json({ error: 'Anthropic API key not configured' });
    }

    // Temporary test response to verify API is working
    if (userQuery === 'test') {
      console.log('Returning test response');
      return res.status(200).json({
        success: true,
        response: 'Test response working!',
        shouldSearch: false,
        searchQuery: null,
        intent: 'general_question'
      });
    }

    console.log('Starting intent classification...');
    // First, classify the user's intent
    const intentPrompt = `You are a medical research assistant. Classify the user's message and determine if they want to search for research.

User message: "${userQuery}"

Classify this as one of these intents:
- "greeting": Hello, hi, how are you, good morning, etc.
- "search_request": Looking for papers, trials, research on [topic], find studies about [topic], etc.
- "follow_up": Tell me more, what about [topic], explain that, etc.
- "clarification": I meant [topic], focus on [topic], etc.
- "general_question": What can you help with, how does this work, etc.

Also determine:
1. Should we search for research? (true/false)
2. If yes, what search terms should we use? (extract key medical/research terms)
3. What type of response should we give? (conversational, search suggestion, clarification request)

Return ONLY a JSON object with this exact structure:
{
  "intent": "greeting|search_request|follow_up|clarification|general_question",
  "shouldSearch": true|false,
  "searchQuery": "extracted search terms or null",
  "searchSuggestions": [
    {
      "id": "unique_id",
      "label": "Button text",
      "query": "search terms",
      "description": "optional description"
    }
  ],
  "responseType": "conversational|search_suggestion|clarification_request"
}`;

    const intentResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 300,
        temperature: 0.3,
        messages: [
          {
            role: 'user',
            content: intentPrompt
          }
        ]
      })
    });

    if (!intentResponse.ok) {
      const errorText = await intentResponse.text();
      console.error('Anthropic API error:', intentResponse.status, errorText);
      throw new Error(`Failed to classify intent: ${intentResponse.status} - ${errorText}`);
    }

    const intentData = await intentResponse.json();
    console.log('Intent API response:', intentData);
    
    let intentResult;
    try {
      const rawText = intentData.content[0].text;
      console.log('Raw intent text:', rawText);
      
      // Clean the response - remove any markdown formatting
      let cleanedText = rawText.trim();
      if (cleanedText.startsWith('```json')) {
        cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      // Find JSON object in the response
      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedText = jsonMatch[0];
      }
      
      intentResult = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error('Failed to parse intent response:', parseError);
      console.error('Raw response:', intentData.content[0].text);
      throw new Error(`Failed to parse intent response: ${parseError.message}`);
    }

    // If we have search results, generate a response about them
    if (searchResults) {
      const { trials, papers, totalCount, searchStrategies } = searchResults;
      
      // Analyze the results for the AI
      const recruitingCount = trials.filter((t: any) => t.overallStatus === 'RECRUITING').length;
      const phase3Count = trials.filter((t: any) => t.phase?.some((p: string) => p.includes('3'))).length;
      const topSponsors = [...new Set(trials.map((t: any) => t.sponsors?.lead).filter(Boolean))].slice(0, 3);
      const recentPapers = papers.filter((p: any) => {
        const year = new Date(p.publicationDate).getFullYear();
        return year >= new Date().getFullYear() - 2;
      }).length;

      const searchResultsPrompt = `You are a helpful medical research assistant. A user searched for: "${userQuery}"

Here are the search results:

CLINICAL TRIALS FOUND: ${totalCount}
- Currently recruiting: ${recruitingCount}
- Phase 3 trials: ${phase3Count}
- Top sponsors: ${topSponsors.join(', ') || 'None identified'}

RESEARCH PAPERS FOUND: ${papers.length}
- Recent papers (last 2 years): ${recentPapers}

Generate a natural, conversational response that:
1. Acknowledges what the user was looking for
2. Summarizes what you found in an engaging way
3. Highlights the most interesting or relevant findings
4. Mentions both clinical trials and research papers if both were found
5. Provides helpful context about the results
6. Keeps the tone professional but conversational

Keep the response concise (2-3 sentences) and natural. Don't use bullet points or lists.`;

      const searchResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicApiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 500,
          temperature: 0.7,
          messages: [
            {
              role: 'user',
              content: searchResultsPrompt
            }
          ]
        })
      });

      if (!searchResponse.ok) {
        throw new Error('Failed to generate search response');
      }

      const searchData = await searchResponse.json();
      const searchResult = searchData.content[0].text;

      return res.status(200).json({
        success: true,
        response: searchResult,
        shouldSearch: false,
        intent: intentResult.intent
      });
    }

    // Build context papers section if available
    let contextSection = '';
    if (contextPapers && contextPapers.length > 0) {
      contextSection = `\n\nThe user has selected ${contextPapers.length} paper(s) as relevant context for this conversation:\n\n`;
      contextPapers.forEach((paper, index) => {
        contextSection += `Paper ${index + 1}:
Title: ${paper.title}
Journal: ${paper.journal}
Publication Date: ${paper.publicationDate}
Authors: ${paper.authors.slice(0, 3).join(', ')}${paper.authors.length > 3 ? ' et al.' : ''}
Abstract: ${paper.abstract}

---

`;
      });
      contextSection += '\nWhen answering the user\'s question, reference these papers if relevant. Cite them by their title or as "Paper 1", "Paper 2", etc.';
    }

    // Generate conversational response based on intent
    const conversationalPrompt = `You are a helpful medical research assistant. The user said: "${userQuery}"

Intent: ${intentResult.intent}
Response type: ${intentResult.responseType}${contextSection}

Generate an appropriate response:
- If greeting: Be friendly and explain what you can help with
- If search_request: Acknowledge their request and suggest conducting a search
- If follow_up: Respond to their follow-up question, referencing the context papers if relevant
- If clarification: Ask for clarification about what they want to search for
- If general_question: Answer their question about your capabilities, referencing context papers if relevant

${contextPapers && contextPapers.length > 0 ? 
  'IMPORTANT: The user has provided specific papers for context. If their question relates to these papers (e.g., comparing them, asking about specific findings, analyzing them), make sure to reference the papers in your response.' : 
  ''}

Keep it conversational, helpful, and professional. 1-2 sentences max unless analyzing the context papers.`;

    const conversationalResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 300,
        temperature: 0.7,
        messages: [
          {
            role: 'user',
            content: conversationalPrompt
          }
        ]
      })
    });

    if (!conversationalResponse.ok) {
      const errorText = await conversationalResponse.text();
      console.error('Conversational response API error:', conversationalResponse.status, errorText);
      throw new Error(`Failed to generate conversational response: ${conversationalResponse.status} - ${errorText}`);
    }

    const conversationalData = await conversationalResponse.json();
    console.log('Conversational API response:', conversationalData);
    
    const conversationalResult = conversationalData.content[0].text;

    return res.status(200).json({
      success: true,
      response: conversationalResult,
      shouldSearch: intentResult.shouldSearch,
      searchQuery: intentResult.searchQuery,
      searchSuggestions: intentResult.searchSuggestions || [],
      intent: intentResult.intent
    });

  } catch (error) {
    console.error('Error generating response:', error);
    return res.status(500).json({ 
      error: 'Failed to generate response',
      details: error.message 
    });
  }
}
