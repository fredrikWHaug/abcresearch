/**
 * Helper functions for ChatAPI (ABC-41, ABC-39)
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

export interface ContextPaper {
  pmid: string;
  title: string;
  abstract: string;
  journal: string;
  publicationDate: string;
  authors: string[];
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

/**
 * Build system prompt with context papers (ABC-39)
 * Papers persist in system prompt across the conversation
 */
export function buildSystemPrompt(contextPapers?: ContextPaper[]): string {
  if (!contextPapers || contextPapers.length === 0) {
    return `You are a thoughtful medical research consultant having a natural conversation with a user. Your goal is to LISTEN and respond naturally to what they're actually saying.

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

HW8 ABC-57: RESPONSE FORMAT
IMPORTANT: Start your response with metadata tags, then your message:

[SEARCH_INTENT: yes/no]
[SEARCH_TERMS: terms to search for, or "none"]
Your response here.

CRITICAL: If SEARCH_INTENT is yes, keep your response to 1-2 sentences. Just say you can search for it.

Examples:
If user says "GLP-1": 
[SEARCH_INTENT: yes]
[SEARCH_TERMS: GLP-1 agonists]
I can search for research on GLP-1 agonists.

If user says "I'm trying to understand GLP-1s":
[SEARCH_INTENT: yes]
[SEARCH_TERMS: GLP-1 agonists]
I can find clinical trials and papers on GLP-1 agonists for you.

If user says "Hi there":
[SEARCH_INTENT: no]
[SEARCH_TERMS: none]
Hey! How can I help you today?

The metadata helps the system understand if you think the user wants research results.`;
  }

  // Build context papers with citation numbers
  let papersContext = `You are a thoughtful medical research consultant with access to the following research papers. The user has selected these papers as relevant context for the conversation.

REFERENCE PAPERS:
`;

  contextPapers.forEach((paper, index) => {
    const citationNum = index + 1;
    papersContext += `
[${citationNum}] ${paper.title}
Authors: ${paper.authors.slice(0, 3).join(', ')}${paper.authors.length > 3 ? ' et al.' : ''}
Journal: ${paper.journal} (${paper.publicationDate})
PMID: ${paper.pmid}
Abstract: ${paper.abstract}

`;
  });

  papersContext += `
INSTRUCTIONS FOR USING PAPERS:
- When referencing a paper, cite it using its number: [1], [2], etc.
- If the user asks about findings, mechanisms, or results, reference the relevant paper(s)
- You can compare papers if the user asks (e.g., "how does [1] compare to [2]?")
- If asked about "the first paper" or "Paper 2", understand they mean [1] and [2] respectively
- Only cite papers when relevant to the user's question
- Be natural and conversational, not robotic

CONVERSATIONAL RULES:
1. ACTUALLY READ what the user just said - respond to their ACTUAL message
2. If they ask a question, ANSWER IT directly using the papers if relevant
3. Be conversational and human-like, not a scripted chatbot
4. Cite papers naturally in your response: "According to [1], the primary finding was..."
5. Write ONLY actual dialogue - NO stage directions like "*smiles*" or actions in asterisks

Tone: Natural, conversational, genuinely helpful. Like a smart colleague discussing research papers.`;

  return papersContext;
}

/**
 * Build messages array from chat history (ABC-39)
 * Converts chat history into proper Anthropic Messages API format
 */
export function buildMessagesFromHistory(
  chatHistory: ChatMessage[],
  currentQuery: string
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  // Add previous conversation (last 6 messages for context)
  const recentHistory = chatHistory.slice(-6);
  recentHistory.forEach(msg => {
    messages.push({
      role: msg.type === 'user' ? 'user' : 'assistant',
      content: msg.message
    });
  });

  // Add current user query
  messages.push({
    role: 'user',
    content: currentQuery
  });

  return messages;
}

