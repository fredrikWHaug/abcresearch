// Vercel API Route for generating dynamic AI responses

interface GenerateResponseRequest {
  userQuery: string;
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
  intent: 'greeting' | 'search_request' | 'follow_up' | 'clarification' | 'general_question';
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userQuery, searchResults }: GenerateResponseRequest = req.body;

    if (!userQuery) {
      return res.status(400).json({ error: 'User query is required' });
    }

    const geminiApiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!geminiApiKey) {
      return res.status(500).json({ error: 'Google Gemini API key not configured' });
    }

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
  "responseType": "conversational|search_suggestion|clarification_request"
}`;

    const intentResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: intentPrompt
          }]
        }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 300,
        }
      })
    });

    if (!intentResponse.ok) {
      throw new Error('Failed to classify intent');
    }

    const intentData = await intentResponse.json();
    const intentResult = JSON.parse(intentData.candidates[0].content.parts[0].text);

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

      const searchResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: searchResultsPrompt
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 500,
          }
        })
      });

      if (!searchResponse.ok) {
        throw new Error('Failed to generate search response');
      }

      const searchData = await searchResponse.json();
      const searchResult = searchData.candidates[0].content.parts[0].text;

      return res.status(200).json({
        success: true,
        response: searchResult,
        shouldSearch: false,
        intent: intentResult.intent
      });
    }

    // Generate conversational response based on intent
    const conversationalPrompt = `You are a helpful medical research assistant. The user said: "${userQuery}"

Intent: ${intentResult.intent}
Response type: ${intentResult.responseType}

Generate an appropriate response:
- If greeting: Be friendly and explain what you can help with
- If search_request: Acknowledge their request and suggest conducting a search
- If follow_up: Respond to their follow-up question
- If clarification: Ask for clarification about what they want to search for
- If general_question: Answer their question about your capabilities

Keep it conversational, helpful, and professional. 1-2 sentences max.`;

    const conversationalResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: conversationalPrompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 300,
        }
      })
    });

    if (!conversationalResponse.ok) {
      throw new Error('Failed to generate conversational response');
    }

    const conversationalData = await conversationalResponse.json();
    const conversationalResult = conversationalData.candidates[0].content.parts[0].text;

    return res.status(200).json({
      success: true,
      response: conversationalResult,
      shouldSearch: intentResult.shouldSearch,
      searchQuery: intentResult.searchQuery,
      intent: intentResult.intent
    });

  } catch (error) {
    console.error('Error generating response:', error);
    return res.status(500).json({ error: 'Failed to generate response' });
  }
}
