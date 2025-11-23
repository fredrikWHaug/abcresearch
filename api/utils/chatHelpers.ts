 
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

export interface ContextPressRelease {
  id: string;
  title: string;
  company: string;
  releaseDate: string;
  summary: string;
  fullText?: string;
  source: string;
  url?: string;
  keyAnnouncements?: string[];
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

export interface ContextExtraction {
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
}

/**
 * Build system prompt with context papers, press releases, and PDF extractions (ABC-39, HW9)
 * Papers, press releases, and extractions persist in system prompt across the conversation
 * HW9 ABC-85: For graph generation, only include tables to reduce token usage
 */
export function buildSystemPrompt(
  contextPapers?: ContextPaper[], 
  contextPressReleases?: ContextPressRelease[],
  contextExtractions?: ContextExtraction[],
  isGraphRequest?: boolean
): string {
  if ((!contextPapers || contextPapers.length === 0) && 
      (!contextPressReleases || contextPressReleases.length === 0) && 
      (!contextExtractions || contextExtractions.length === 0)) {
    return `You are a thoughtful medical research consultant having a natural conversation with a user. Your goal is to LISTEN and respond naturally to what they're actually saying.

Assume that the user is a sophisticated biopharma researcher and use a nerdy and educated tone like a PhD candidate.
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

BREVITY: Keep your responses under 300 tokens. Be concise and direct.

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

  // Build context with papers and press releases
  let contextPrompt = `You are a thoughtful medical research consultant with access to selected reference materials. The user has chosen these as relevant context for the conversation.
`;

  // Add papers if available
  if (contextPapers && contextPapers.length > 0) {
    contextPrompt += `
REFERENCE PAPERS:
`;
    contextPapers.forEach((paper, index) => {
      const citationNum = index + 1;
      contextPrompt += `
[${citationNum}] ${paper.title}
Authors: ${paper.authors.slice(0, 3).join(', ')}${paper.authors.length > 3 ? ' et al.' : ''}
Journal: ${paper.journal} (${paper.publicationDate})
PMID: ${paper.pmid}
Abstract: ${paper.abstract}

`;
    });
  }

  // Add press releases if available
  if (contextPressReleases && contextPressReleases.length > 0) {
    contextPrompt += `
PRESS RELEASES:
`;
    contextPressReleases.forEach((pr, index) => {
      const citationNum = index + 1;
      contextPrompt += `
[PR${citationNum}] ${pr.title}
Company: ${pr.company}
Date: ${pr.releaseDate}
Source: ${pr.source}
Summary: ${pr.summary}
${pr.fullText ? `Full Text: ${pr.fullText.substring(0, 500)}...` : ''}
${pr.keyAnnouncements && pr.keyAnnouncements.length > 0 ? `Key Announcements: ${pr.keyAnnouncements.join(', ')}` : ''}

`;
    });
  }

  // Add PDF extractions if available
  if (contextExtractions && contextExtractions.length > 0) {
    contextPrompt += `
PDF EXTRACTIONS:
`;
    contextExtractions.forEach((extraction, index) => {
      const extractionNum = index + 1;
      
      contextPrompt += `
[EXT${extractionNum}] ${extraction.fileName}

`;
      
      // Add structured tables first (full data, not truncated)
      if (extraction.tablesData && extraction.tablesData.length > 0) {
        contextPrompt += `TABLES (${extraction.tablesData.length} found):\n`;
        extraction.tablesData.forEach((table, tableIndex) => {
          contextPrompt += `\nTable ${tableIndex + 1}:\n`;
          contextPrompt += `Headers: ${table.headers.join(' | ')}\n`;
          contextPrompt += `Data:\n`;
          table.rows.forEach((row, rowIndex) => {
            contextPrompt += `  Row ${rowIndex + 1}: ${row.join(' | ')}\n`;
          });
          contextPrompt += `\n`;
        });
      }
      
      // Add graph images if available (only if not generating a graph)
      if (!isGraphRequest && extraction.graphifyResults && extraction.graphifyResults.length > 0) {
        const graphs = extraction.graphifyResults.filter(g => g.isGraph);
        if (graphs.length > 0) {
          contextPrompt += `\nGRAPHS (${graphs.length} found):\n`;
          graphs.forEach((graph, graphIndex) => {
            contextPrompt += `\nGraph ${graphIndex + 1}: ${graph.imageName}\n`;
            contextPrompt += `Type: ${graph.graphType || 'Unknown'}\n`;
            if (graph.reason) {
              contextPrompt += `Description: ${graph.reason}\n`;
            }
            if (graph.data) {
              contextPrompt += `Data: ${JSON.stringify(graph.data, null, 2)}\n`;
            }
            if (graph.assumptions) {
              contextPrompt += `Notes: ${graph.assumptions}\n`;
            }
            contextPrompt += `\n`;
          });
        }
      }
      
      // HW9 ABC-85: Only add full markdown content if NOT generating a graph
      // For graph generation, tables are sufficient and reduce token usage
      if (!isGraphRequest) {
        const truncatedContent = extraction.markdownContent.length > 5000 
          ? extraction.markdownContent.substring(0, 5000) + '\n\n[Content truncated - see structured tables above for full data]'
          : extraction.markdownContent;
        
        contextPrompt += `\nFULL DOCUMENT CONTENT:\n${truncatedContent}\n\n`;
      } else {
        contextPrompt += `\n(Full document content omitted - using structured table data for graph generation)\n\n`;
      }
    });
  }

  contextPrompt += `
INSTRUCTIONS FOR USING REFERENCES:
- When referencing a paper, cite it using its number: [1], [2], etc.
- When referencing a press release, cite it using [PR1], [PR2], etc.
- When referencing a PDF extraction, cite it using [EXT1], [EXT2], etc.
- If the user asks about findings, mechanisms, or results, reference the relevant source(s)
- You can compare sources if the user asks (e.g., "how does [1] compare to [PR1]?")
- Press releases may contain company announcements, clinical trial results, or business updates
- PDF extractions may contain tables, figures, and detailed technical content
- Only cite sources when relevant to the user's question
- Be natural and conversational, not robotic

ENDPOINT COMPARISON GRAPH GENERATION:
If the user asks you to generate a graph comparing endpoints, drugs, or efficacy from tables:
1. Examine ALL of the table data in the PDF extractions ([EXT1], [EXT2], etc.) and specifically focus on the table with all of the endpoints - commonly called Primary end points and components and Key secondary endpoints
2. Extract the relevant data points that could be across different extractions or tables: endpoints (X-axis), different drugs/dosages (series), efficacy values (Y-axis)
3. Generate Python code using matplotlib to create a comparison bar chart
5. Then include your Python code wrapped in triple backticks with 'python' as the language identifier
6. IMPORTANT: Make sure your code block is complete and ends with closing triple backticks
7. Only generate the code. Do not include any other text. Example format:

TRIPLE_BACKTICKS_python
import matplotlib.pyplot as plt
import numpy as np
[your actual data extraction and plotting code here]
TRIPLE_BACKTICKS

Replace TRIPLE_BACKTICKS with three backtick characters.
8. Adapt your code based on the actual table data you find in the PDF extractions

DEMOGRAPHICS COMPARISON GRAPH GENERATION:
If the user asks you to generate a graph comparing demographics from tables:
1. Examine ALL of the table data in the PDF extractions ([EXT1], [EXT2], etc.) and specifically focus on the table with all of the demographics - commonly called Demographics and Patient Characteristics
2. Extract the relevant data points that could be across different extractions or tables: demographics (X-axis), different drugs/dosages (series), efficacy values (Y-axis)
3. Generate Python code using matplotlib to create a comparison bar chart
5. Then include your Python code wrapped in triple backticks with 'python' as the language identifier
6. IMPORTANT: Make sure your code block is complete and ends with closing triple backticks
7. Only generate the code. Do not include any other text. Example format:

TRIPLE_BACKTICKS_python
import matplotlib.pyplot as plt
import numpy as np
[your actual data extraction and plotting code here]
TRIPLE_BACKTICKS

Replace TRIPLE_BACKTICKS with three backtick characters.
8. Adapt your code based on the actual table data you find in the PDF extractions

CONVERSATIONAL RULES:
1. ACTUALLY READ what the user just said - respond to their ACTUAL message
2. If they ask a question, ANSWER IT directly using the references if relevant
3. Be conversational and human-like, not a scripted chatbot
4. Cite sources naturally: "According to [1], the primary finding was..." or "The press release [PR1] announced..."
5. When generating graphs, provide clear Python code that can be executed - you have unlimited space for code generation
6. Write ONLY actual dialogue - NO stage directions like "*smiles*" or actions in asterisks
7. BREVITY: For non-code responses, keep your answer under 300 tokens. Be concise and direct.

Tone: Natural, conversational, genuinely helpful. Like a smart colleague discussing research materials.
`;

  return contextPrompt;
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
  // HW8 ABC-57: Append format reminder to reinforce metadata requirement
  const queryWithReminder = `${currentQuery}

[Remember: Start your response with [SEARCH_INTENT: yes/no] and [SEARCH_TERMS: ...] tags]`;
  
  messages.push({
    role: 'user',
    content: queryWithReminder
  });

  return messages;
}

