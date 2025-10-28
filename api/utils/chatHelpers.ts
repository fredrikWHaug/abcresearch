/**
 * Helper functions for ChatAPI (ABC-41)
 * Extracted for testability
 */

export interface ChatMessage {
  type: 'user' | 'system';
  message: string;
}

export interface SearchSuggestion {
  id: string;
  label: string;
  query: string;
  description?: string;
}

/**
 * Build conversation context from chat history
 * Takes last 6 messages and formats them for the AI prompt
 */
export function buildConversationContext(chatHistory: ChatMessage[]): string {
  if (!chatHistory || chatHistory.length === 0) {
    return '';
  }

  const recentMessages = chatHistory.slice(-6);
  const context = recentMessages
    .map(msg => `${msg.type === 'user' ? 'User' : 'Assistant'}: ${msg.message}`)
    .join('\n');

  return '\n\nConversation so far:\n' + context;
}

/**
 * Detect if user wants to search based on keywords
 */
export function detectSearchIntent(userQuery: string): boolean {
  const searchKeywords = ['search', 'find', 'look for', 'show me', 'trials', 'studies', 'research', 'papers'];
  return searchKeywords.some(keyword => userQuery.toLowerCase().includes(keyword));
}

/**
 * Extract search terms from user query by filtering common words
 */
export function extractSearchTerms(userQuery: string): string {
  const commonWords = [
    'please', 'can', 'you', 'help', 'me', 'search', 'for', 'find', 
    'look', 'show', 'clinical', 'trial', 'results', 'on', 'the', 
    'a', 'an', 'and', 'or', 'in', 'about'
  ];

  const words = userQuery.toLowerCase().split(/\s+/);
  const searchTerms = words
    .filter(word => !commonWords.includes(word) && word.length > 2)
    .join(' ');

  return searchTerms;
}

/**
 * Generate search suggestions if user wants to search
 */
export function generateSearchSuggestions(
  userQuery: string
): SearchSuggestion[] {
  if (!detectSearchIntent(userQuery)) {
    return [];
  }

  const searchTerms = extractSearchTerms(userQuery);
  
  if (!searchTerms) {
    return [];
  }

  return [{
    id: 'search-1',
    label: `Search for ${searchTerms}`,
    query: searchTerms,
    description: `Find clinical trials and research papers about ${searchTerms}`
  }];
}

