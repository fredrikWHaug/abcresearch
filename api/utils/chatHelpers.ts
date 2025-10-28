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
 * Extract search terms from user query using intelligent medical term detection
 * ABC-45: Initial implementation with basic word filtering
 * ABC-46: Enhanced with positive signal detection for medical terms
 */
export function extractSearchTerms(userQuery: string): string {
  // Common conversational words to exclude (focused on 6+ char words that pass length filter)
  const excludeWords = [
    'search', 'find', 'look', 'show', 'help', 'please', 'thanks', 'thank',
    'clinical', 'trial', 'trials', 'research', 'papers', 'studies', 'study', 'results',
    'actually', 'instead', 'rather', 'really', 'pretty', 'something', 'anything',
    'information', 'details', 'things'
  ];

  // Medical suffixes that indicate scientific terms
  const medicalSuffixes = ['mab', 'itis', 'osis', 'pathy', 'oma', 'ase', 'ine'];

  // Remove punctuation except hyphens and apostrophes (keep GLP-1, Alzheimer's)
  const cleanQuery = userQuery.toLowerCase().replace(/[.,!?;:]/g, ' ');
  const words = cleanQuery.split(/\s+/).filter(word => word.length > 0);
  
  // Intelligent term extraction using positive signals
  const searchTerms = words
    .filter(word => {
      // Skip if in exclude list
      if (excludeWords.includes(word)) return false;
      
      // KEEP if has numbers or hyphens (medical codes: GLP-1, IL-6, COVID-19)
      if (/[0-9-]/.test(word)) return true;
      
      // KEEP if has medical suffix
      if (medicalSuffixes.some(suffix => word.endsWith(suffix))) return true;
      
      // SKIP past tense verbs (e.g., "realized", "decided") unless medical
      // But keep medical past tense like "diagnosed"
      if (word.endsWith('ed') && word.length >= 6 && !word.endsWith('osed')) {
        return false;
      }
      
      // KEEP if long word (medical terms are typically 6+ characters)
      if (word.length >= 6) return true;
      
      // Skip short generic words
      return false;
    })
    .join(' ')
    .trim();

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

