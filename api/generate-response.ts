// Vercel API Route for generating dynamic AI responses

import { 
  buildConversationContext, 
  generateSearchSuggestions,
  type ChatMessage 
} from './utils/chatHelpers.js'

interface GenerateResponseRequest {
  userQuery: string;
  chatHistory?: Array<{
    type: 'user' | 'system';
    message: string;
  }>;
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
    const { userQuery, chatHistory, searchResults, contextPapers }: GenerateResponseRequest = req.body;
    console.log('Parsed userQuery:', userQuery);
    console.log('Parsed chatHistory:', chatHistory?.length || 0, 'messages');
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

    // Build conversation context from chat history (last 6 messages for context)
    const conversationContext = buildConversationContext(chatHistory || []);

    // If we have search results, generate a response about them
    if (searchResults) {
      const { trials, papers, totalCount, searchStrategies } = searchResults;
      
      // Analyze the results for the AI
      const recruitingCount = trials.filter((t: any) => t.overallStatus === 'RECRUITING').length;
      const phase3Count = trials.filter((t: any) => t.phase?.some((p: string) => p.includes('3'))).length;
      const topSponsors = Array.from(new Set(trials.map((t: any) => t.sponsors?.lead).filter(Boolean))).slice(0, 3);
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
        searchSuggestions: [],
        intent: 'search_request'
      });
    }

    // Build context papers section if available (for future use)
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

    // Generate dynamic conversational response with context awareness
    const conversationalPrompt = `You are a thoughtful medical research consultant having a natural conversation with a user. Your goal is to LISTEN and respond naturally to what they're actually saying.

Current user message: "${userQuery}"
${conversationContext}
${contextSection}

CRITICAL RULES:
1. ACTUALLY READ what the user just said - respond to their ACTUAL message, not what you assume they want
2. If they ask you a question, ANSWER IT directly first before asking anything else
3. If they challenge you or seem frustrated, acknowledge it and adjust your approach
4. If they're just greeting you casually, have a normal conversation - DON'T assume they want research help unless they indicate it
5. If they tell you something, BUILD ON IT naturally - don't just pivot to your agenda
6. Be conversational and human-like, not robotic or formulaic
7. Only ask about research specifics when they've clearly expressed interest in searching for trials/papers

Response approach based on situation:
- If they're GREETING you casually: Respond warmly and naturally. Ask what brings them here TODAY (not assumptions about research)
- If they ASK YOU A QUESTION: Answer it directly and thoughtfully
- If they CHALLENGE or CRITICIZE you: Acknowledge their point, apologize if needed, adjust your approach
- If they EXPRESS INTEREST in a topic: THEN ask a thoughtful follow-up question to help refine it
- If they seem FRUSTRATED: Back off the questioning, be more conversational

When asking questions (only when appropriate):
- Make it feel like a colleague brainstorming together, not an interrogation
- Ask about aspects they might not have considered: patient populations, trial phases, outcome measures, geographic regions, time horizons, safety vs efficacy
- But ONLY if they've shown interest in research - don't force it

Tone: Natural, conversational, genuinely helpful. Like a smart colleague, not a scripted chatbot.

IMPORTANT: Write ONLY the actual words you would say. Do NOT include stage directions like "*smiles*", "*responds warmly*", or any actions in asterisks or brackets. Just write natural dialogue.

Generate your response now (respond to what they ACTUALLY said):`;

    const conversationalResponse = await fetch('https://api.anthropic.com/v1/messages', {
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
    
    let conversationalResult = conversationalData.content[0].text;
    
    // Clean up any stage directions or action notations (e.g., "*responds warmly*", "*smiles*")
    conversationalResult = conversationalResult
      .replace(/\*[^*]+\*/g, '') // Remove anything between asterisks
      .replace(/\[[^\]]+\]/g, '') // Remove anything between brackets
      .replace(/^\s+/, '') // Remove leading whitespace
      .trim();

    // Generate search suggestions using helper function
    const searchSuggestions = generateSearchSuggestions(userQuery);
    const shouldSearch = searchSuggestions.length > 0;

    return res.status(200).json({
      success: true,
      response: conversationalResult,
      shouldSearch: shouldSearch,
      searchSuggestions: searchSuggestions,
      intent: shouldSearch ? 'search_request' : 'general_question'
    });

  } catch (error) {
    console.error('Error generating response:', error);
    return res.status(500).json({ 
      error: 'Failed to generate response',
      details: error.message 
    });
  }
}
