/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
// Vercel API Route for generating dynamic AI responses

import {
  buildConversationContext,
  generateSearchSuggestions,
  buildSystemPrompt,
  buildGraphGenerationPrompt,
  buildSearchPrompt,
  buildMessagesFromHistory,
  detectUserIntent,
  type ChatMessage,
  type ContextPaper,
  type ContextPressRelease,
  type UserIntent
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
    tablesData?: Array<{
      index: number;
      headers: string[];
      rows: string[][];
      rawMarkdown: string;
    }>;
    graphifyResults?: Array<{
      imageName: string;
      isGraph: boolean;
      graphType?: string;
      reason?: string;
      pythonCode?: string;
      data?: Record<string, unknown>;
      assumptions?: string;
      error?: string;
      renderedImage?: string;
      renderError?: string;
      renderTimeMs?: number;
    }>;
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
  intent: 'search_request' | 'general_question' | 'graph_generation';
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
    
    // Debug: Log extraction structure
    if (contextExtractions && contextExtractions.length > 0) {
      contextExtractions.forEach((extraction, idx) => {
        console.log(`[API] Extraction ${idx + 1}:`, {
          jobId: extraction.jobId,
          fileName: extraction.fileName,
          hasTables: extraction.hasTables,
          tablesDataLength: extraction.tablesData?.length || 0,
          tablesDataType: Array.isArray(extraction.tablesData) ? 'array' : typeof extraction.tablesData,
          tablesDataFirst: extraction.tablesData?.[0] ? {
            index: extraction.tablesData[0].index,
            headersCount: extraction.tablesData[0].headers?.length || 0,
            rowsCount: extraction.tablesData[0].rows?.length || 0
          } : 'none'
        });
      });
    }

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

    // Detect user intent to route to appropriate prompt
    const hasExtractions = (contextExtractions && contextExtractions.length > 0) || false;
    const userIntent = detectUserIntent(userQuery, hasExtractions);
    
    console.log('Detected user intent:', userIntent, 'Has extractions:', hasExtractions);
    
    // Build system prompt based on intent
    let systemPrompt: string;
    const isGraphRequest = userIntent === 'graph_generation';
    
    if (userIntent === 'graph_generation') {
      // Use graph-specific prompt that focuses on code generation
      systemPrompt = buildGraphGenerationPrompt(contextExtractions);
      console.log('Using graph generation prompt');
    } else if (userIntent === 'search') {
      // Use search-specific prompt that focuses on search suggestions
      systemPrompt = buildSearchPrompt(contextPapers, contextPressReleases, contextExtractions);
      console.log('Using search prompt');
    } else {
      // Use general conversation prompt
      systemPrompt = buildSystemPrompt(contextPapers, contextPressReleases, contextExtractions, false);
      console.log('Using general conversation prompt');
    }

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
    const maxTokens = isGraphRequest ? 5000 : 2500;  // Graph code needs ~500-1000 tokens, normal needs 1500 to prevent truncation
    
    // Use Sonnet 4.5 with thinking for graph generation, Haiku for other requests
    const model = isGraphRequest ? 'claude-sonnet-4-5' : 'claude-3-haiku-20240307';
    const thinkingConfig = isGraphRequest ? {
      type: "enabled" as const,
      budget_tokens: 2000  // Reasonable thinking budget for complex graph generation
    } : undefined;
    
    console.log('Graph request detected:', isGraphRequest, 'Model:', model, 'Max tokens:', maxTokens, 'Thinking:', !!thinkingConfig);
    
    const requestBody: any = {
      model: model,
      max_tokens: maxTokens,
      temperature: 1,
      system: systemPrompt,  // Papers persist here (ABC-39)
      messages: messages     // Conversation flows here (ABC-39)
    };
    
    // Add thinking config only for graph generation
    if (thinkingConfig) {
      requestBody.thinking = thinkingConfig;
    }
    
    const conversationalResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(requestBody)
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
    
    // Handle response structure - may have thinking content or direct text
    // When thinking mode is enabled, content array has: [{type: 'thinking', ...}, {type: 'text', text: '...'}]
    // We need to find the text content item, not just use content[0]
    let conversationalResult: string = '';
    
    if (conversationalData.content && Array.isArray(conversationalData.content)) {
      // Find the text content item (skip thinking blocks)
      const textContentItem = conversationalData.content.find(
        (item: any) => item.type === 'text' && (item.text || item.content)
      );
      
      if (textContentItem) {
        conversationalResult = textContentItem.text || textContentItem.content || '';
        console.log('[Response] Found text content, length:', conversationalResult.length);
      } else {
        // Fallback: try content[0] if no text item found
        const firstItem = conversationalData.content[0];
        if (firstItem) {
          conversationalResult = firstItem.text || firstItem.content || '';
          if (!conversationalResult && firstItem.type === 'thinking') {
            console.log('[Response] First item is thinking block, looking for text item...');
            // Try to find text in other items
            for (let i = 1; i < conversationalData.content.length; i++) {
              const item = conversationalData.content[i];
              if (item.type === 'text' && (item.text || item.content)) {
                conversationalResult = item.text || item.content || '';
                console.log('[Response] Found text content at index', i);
                break;
              }
            }
          }
        }
      }
      
      // Log structure for debugging if we still don't have text
      if (!conversationalResult) {
        console.warn('[Response] No text content found. Content structure:', 
          conversationalData.content.map((item: any) => ({ type: item.type, hasText: !!item.text }))
        );
      }
    } else {
      console.warn('[Response] No content array found in response');
    }
    
    // Safety check - ensure we have a valid string
    if (!conversationalResult || typeof conversationalResult !== 'string') {
      console.error('[Response] Invalid conversational result:', {
        type: typeof conversationalResult,
        value: conversationalResult,
        contentLength: conversationalData.content?.length,
        contentTypes: conversationalData.content?.map((item: any) => item.type)
      });
      conversationalResult = 'I apologize, but I encountered an error processing the response.';
    }
    
    // Parse search intent metadata from Claude's response (only for search/general intents, not graph)
    let shouldSearch = false;
    let searchSuggestions: Array<{ id: string; label: string; query: string; description?: string }> = [];
    
    // Only parse search intent if NOT a graph generation request
    if (userIntent !== 'graph_generation') {
      const searchIntentMatch = conversationalResult.match(/\[SEARCH_INTENT:\s*(yes|no)\]/i);
      const searchTermsMatch = conversationalResult.match(/\[SEARCH_TERMS:\s*(.+?)\]/i);
      
      const claudeSearchIntent = searchIntentMatch ? searchIntentMatch[1].toLowerCase() === 'yes' : null;
      const claudeSearchTerms = searchTermsMatch ? searchTermsMatch[1].trim() : null;
      
      console.log('Claude search intent:', claudeSearchIntent);
      console.log('Claude search terms:', claudeSearchTerms);
      
      // Remove metadata from response before showing to user (with safety check)
      if (typeof conversationalResult === 'string') {
        conversationalResult = conversationalResult
          .replace(/\[SEARCH_INTENT:\s*(yes|no)\]/gi, '')
          .replace(/\[SEARCH_TERMS:\s*.+?\]/gi, '')
          .trim();
      }
      
      // Use Claude's intent for search/general, but override with detected intent
      shouldSearch = (userIntent === 'search') || (claudeSearchIntent === true && userIntent === 'general');
      searchSuggestions = shouldSearch && claudeSearchTerms && claudeSearchTerms !== 'none' 
        ? [{
            id: 'search-1',
            label: `Search for ${claudeSearchTerms}`,
            query: claudeSearchTerms,
            description: `Find clinical trials and research papers about ${claudeSearchTerms}`
          }]
        : [];
      
      console.log('Using intent routing. userIntent:', userIntent, 'shouldSearch:', shouldSearch);
      console.log('Search suggestions:', searchSuggestions);
    } else {
      // For graph generation, remove any search intent metadata that might have leaked through
      // Also remove any text before/after the Python code block
      if (typeof conversationalResult === 'string') {
        // Remove search intent metadata
        conversationalResult = conversationalResult
          .replace(/\[SEARCH_INTENT:\s*(yes|no)\]/gi, '')
          .replace(/\[SEARCH_TERMS:\s*.+?\]/gi, '')
          .trim();
        
        // Extract ONLY the Python code block if it exists
        const pythonCodeMatch = conversationalResult.match(/```[Pp]ython\s*\n([\s\S]+?)(?:```|$)/);
        if (pythonCodeMatch && pythonCodeMatch[1]) {
          // If we found a code block, use ONLY that (wrapped properly)
          conversationalResult = `\`\`\`python\n${pythonCodeMatch[1].trim()}\n\`\`\``;
          console.log('[Graph] Extracted Python code block, removed surrounding text');
        } else {
          // If no code block found, try to clean up any remaining text
          conversationalResult = conversationalResult
            .replace(/^[^`]*/, '') // Remove text before first backtick
            .replace(/[^`]*$/, '') // Remove text after last backtick
            .trim();
        }
      }
      
      console.log('Graph generation request - no search suggestions will be generated');
    }
    
    // Clean up any stage directions or action notations (e.g., "*responds warmly*", "*smiles*")
    // Only for non-graph requests (graph requests should already be cleaned above)
    if (typeof conversationalResult === 'string' && userIntent !== 'graph_generation') {
      conversationalResult = conversationalResult
        .replace(/\*[^*]+\*/g, '') // Remove anything between asterisks
        .replace(/^\s+/, '') // Remove leading whitespace
        .trim();
    }

    // Extract Python code if present (for graph generation)
    let graphCode: string | undefined;
    
    // For graph generation, the entire response should be the code block
    if (userIntent === 'graph_generation') {
      // Match ```python or ```Python with optional whitespace, then capture everything until closing ```
      // If closing ``` is missing (due to token cutoff), take everything until end of text
      const pythonCodeMatch = conversationalResult.match(/```[Pp]ython\s*\n([\s\S]+?)(?:```|$)/);
      if (pythonCodeMatch && pythonCodeMatch[1]) {
        const extractedCode = pythonCodeMatch[1].trim();
        graphCode = extractedCode;
        console.log('[Graph] Code extracted! Length:', extractedCode.length);
        
        // For graph generation, set the response to just the code (will be displayed by GraphCodeExecutor)
        conversationalResult = `\`\`\`python\n${extractedCode}\n\`\`\``;
      } else {
        console.warn('[Graph] No Python code block found in response:', conversationalResult.substring(0, 200));
      }
    } else {
      // For non-graph requests, extract code if present but keep the full response
      const pythonCodeMatch = conversationalResult.match(/```[Pp]ython\s*\n([\s\S]+?)(?:```|$)/);
      if (pythonCodeMatch && pythonCodeMatch[1]) {
        graphCode = pythonCodeMatch[1].trim();
        console.log('Python code found in response (non-graph request)');
      }
    }

    // Map UserIntent to response intent type
    const responseIntent = userIntent === 'graph_generation' ? 'graph_generation' 
                         : userIntent === 'search' ? 'search_request' 
                         : 'general_question';

    return res.status(200).json({
      success: true,
      response: conversationalResult,
      shouldSearch: shouldSearch,
      searchSuggestions: searchSuggestions,
      graphCode: graphCode,
      intent: responseIntent
    });

  } catch (error) {
    console.error('Error generating response:', error);
    return res.status(500).json({ 
      error: 'Failed to generate response',
      details: error.message 
    });
  }
}
