/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
// Vercel API Route for generating dynamic AI responses

import {
  buildConversationContext,
  generateSearchSuggestions,
  buildSystemPrompt,
  buildMessagesFromHistory,
  type ChatMessage,
  type ContextPaper,
  type ContextPressRelease
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
  contextPressReleases?: Array<{
    id: string;
    title: string;
    company: string;
    releaseDate: string;
    summary: string;
    fullText?: string;
    source: string;
    url?: string;
    keyAnnouncements?: string[];
  }>;
  contextExtractions?: Array<{
    jobId: string;
    fileName: string;
    markdownContent: string;
    hasTables: boolean;
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
  graphCode?: string;
  intent: 'greeting' | 'search_request' | 'follow_up' | 'clarification' | 'general_question';
}

export default async function handler(req: any, res: any) {
  console.log('API endpoint called with method:', req.method);
  console.log('Request body:', req.body);
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userQuery, chatHistory, searchResults, contextPapers, contextPressReleases, contextExtractions }: GenerateResponseRequest = req.body;
    console.log('Parsed userQuery:', userQuery);
    console.log('Parsed chatHistory:', chatHistory?.length || 0, 'messages');
    console.log('Parsed searchResults:', searchResults);
    console.log('Context papers count:', contextPapers?.length || 0);
    console.log('Context press releases count:', contextPressReleases?.length || 0);
    console.log('Context extractions count:', contextExtractions?.length || 0);

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

    // HW9 ABC-85: Detect if user is asking for graph generation early to optimize context
    const isGraphRequest = userQuery.toLowerCase().includes('graph') || 
                          userQuery.toLowerCase().includes('chart') || 
                          userQuery.toLowerCase().includes('comparison') ||
                          userQuery.toLowerCase().includes('visualiz');
    
    // ABC-39, HW9: Build system prompt with context papers, press releases, and PDF extractions (persistent)
    // HW9 ABC-85: Pass isGraphRequest to optimize context (only tables for graph generation)
    const systemPrompt = buildSystemPrompt(contextPapers, contextPressReleases, contextExtractions, isGraphRequest);

    // ABC-39: Build messages array from chat history and current query
    const messages = buildMessagesFromHistory(chatHistory || [], userQuery);

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
          model: 'claude-sonnet-4-5',
          max_tokens: 800,
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
        const searchErrorText = await searchResponse.text();
        console.error('Search response API error:', searchResponse.status, searchErrorText);
        
        // HW11: Handle content filtering errors gracefully
        if (searchErrorText.includes('content filtering policy') || searchErrorText.includes('content_filter')) {
          return res.status(200).json({
            success: true,
            response: "I couldn't generate that response due to content guidelines. Could you try a different search query?",
            shouldSearch: false,
            searchSuggestions: [],
            intent: 'search_request',
            contentFiltered: true
          });
        }
        
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

    // ABC-39: Use proper Anthropic API structure with system prompt and messages array
    // HW8 ABC-57: Reduce max_tokens to encourage brevity (Claude tends to be verbose)
    // HW9 ABC-85: Graph request detected earlier to optimize system prompt context
    // HW11: Ensure minimum 1500 tokens to prevent mid-sentence truncation, but allow more for graphs
    const maxTokens = isGraphRequest ? 2000 : 1500;  // Graph code needs ~500-1000 tokens, normal needs 1500 to prevent truncation
    
    console.log('Graph request detected:', isGraphRequest, 'Max tokens:', maxTokens);
    
    const conversationalResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: maxTokens,  // HW11: Minimum 1500 to prevent truncation, 2000 for graphs
        temperature: 0.7,
        system: systemPrompt,  // Papers persist here (ABC-39)
        messages: messages     // Conversation flows here (ABC-39)
      })
    });

    if (!conversationalResponse.ok) {
      const errorText = await conversationalResponse.text();
      console.error('Conversational response API error:', conversationalResponse.status, errorText);
      
      // HW11: Handle content filtering errors gracefully
      if (errorText.includes('content filtering policy') || errorText.includes('content_filter')) {
        return res.status(200).json({
          success: true,
          response: "I couldn't generate that response due to content guidelines. Could you rephrase your question or ask something related to medical research instead?",
          shouldSearch: false,
          searchSuggestions: [],
          intent: 'general_question',
          contentFiltered: true
        });
      }
      
      throw new Error(`Failed to generate conversational response: ${conversationalResponse.status} - ${errorText}`);
    }

    const conversationalData = await conversationalResponse.json();
    console.log('Conversational API response:', conversationalData);
    
    let conversationalResult = conversationalData.content[0].text;
    
    // HW8 ABC-57: Parse search intent metadata from Claude's response
    const searchIntentMatch = conversationalResult.match(/\[SEARCH_INTENT:\s*(yes|no)\]/i);
    const searchTermsMatch = conversationalResult.match(/\[SEARCH_TERMS:\s*(.+?)\]/i);
    
    const claudeSearchIntent = searchIntentMatch ? searchIntentMatch[1].toLowerCase() === 'yes' : null;
    const claudeSearchTerms = searchTermsMatch ? searchTermsMatch[1].trim() : null;
    
    console.log('HW8 ABC-57: Claude search intent:', claudeSearchIntent);
    console.log('HW8 ABC-57: Claude search terms:', claudeSearchTerms);
    
    // Remove metadata from response before showing to user
    conversationalResult = conversationalResult
      .replace(/\[SEARCH_INTENT:\s*(yes|no)\]/gi, '')
      .replace(/\[SEARCH_TERMS:\s*.+?\]/gi, '')
      .trim();
    
    // Clean up any stage directions or action notations (e.g., "*responds warmly*", "*smiles*")
    conversationalResult = conversationalResult
      .replace(/\*[^*]+\*/g, '') // Remove anything between asterisks
      .replace(/^\s+/, '') // Remove leading whitespace
      .trim();

    // HW8 ABC-57: Use Claude's intent instead of regex
    const shouldSearch = claudeSearchIntent === true;
    const searchSuggestions = shouldSearch && claudeSearchTerms && claudeSearchTerms !== 'none' 
      ? [{
          id: 'search-1',
          label: `Search for ${claudeSearchTerms}`,
          query: claudeSearchTerms,
          description: `Find clinical trials and research papers about ${claudeSearchTerms}`
        }]
      : [];
    
    console.log('HW8 ABC-57: Using Claude intent. shouldSearch:', shouldSearch);
    console.log('HW8 ABC-57: Search suggestions:', searchSuggestions);

    // Extract Python code if present (for graph generation)
    let graphCode: string | undefined;
    
    // Match ```python or ```Python with optional whitespace, then capture everything until closing ```
    // If closing ``` is missing (due to token cutoff), take everything until end of text
    const pythonCodeMatch = conversationalResult.match(/```[Pp]ython\s*\n([\s\S]+?)(?:```|$)/);
    if (pythonCodeMatch && pythonCodeMatch[1]) {
      const extractedCode = pythonCodeMatch[1].trim();
      graphCode = extractedCode;
      console.log('Graph code extracted! Length:', extractedCode.length);
    }

    return res.status(200).json({
      success: true,
      response: conversationalResult,
      shouldSearch: shouldSearch,
      searchSuggestions: searchSuggestions,
      graphCode: graphCode,
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
