 
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
 * Intent types for routing to appropriate prompt and handling
 */
export type UserIntent = 'graph_generation' | 'search' | 'general';

/**
 * Detect user intent from query
 * Prioritizes graph generation over search to prevent graph requests from being treated as searches
 */
export function detectUserIntent(userQuery: string, hasExtractions: boolean = false): UserIntent {
  const query = userQuery.toLowerCase();
  
  // Graph generation keywords - check first to prioritize graph intent
  const graphKeywords = [
    'create a graph', 'generate a graph', 'make a graph', 'plot', 'visualize', 'visualization',
    'graph', 'chart', 'comparison graph', 'comparison chart', 'endpoint', 'endpoints',
    'outcome measures', 'outcomes', 'demographics', 'efficacy comparison', 'efficacy graph',
    'primary outcome', 'secondary outcome', 'bar chart', 'line chart', 'scatter plot',
    'generate python', 'python code', 'matplotlib', 'create chart', 'generate chart'
  ];
  
  const isGraphIntent = graphKeywords.some(keyword => query.includes(keyword));
  
  // If graph intent detected and user has extractions, prioritize graph generation
  if (isGraphIntent && hasExtractions) {
    return 'graph_generation';
  }
  
  // Search keywords
  const searchKeywords = ['search', 'find', 'look for', 'show me', 'trials', 'studies', 'research', 'papers'];
  const isSearchIntent = searchKeywords.some(keyword => query.includes(keyword));
  
  if (isSearchIntent) {
    return 'search';
  }
  
  // Default to general conversation
  return 'general';
}

/**
 * Detect if user wants to search based on keywords
 * @deprecated Use detectUserIntent instead
 */
export function detectSearchIntent(userQuery: string): boolean {
  return detectUserIntent(userQuery) === 'search';
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

// Import canonical types from extraction.ts
// Note: This is a backend file, so we define the types inline to match the structure
// The frontend uses TableData and GraphifyResult from @/types/extraction
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
  }>;  // Matches TableData from extraction.ts
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
  }>;  // Matches GraphifyResult from extraction.ts
}

/**
 * Build system prompt for graph generation intent
 * Focused on generating Python code for data visualization from PDF extractions
 */
export function buildGraphGenerationPrompt(
  contextExtractions?: ContextExtraction[]
): string {
  if (!contextExtractions || contextExtractions.length === 0) {
    return `You are a data visualization assistant. The user wants to generate a graph, but no PDF extractions are available in context. Please inform them that they need to add PDF extractions first.`;
  }

  let prompt = `You are a data visualization assistant specialized in generating Python code for scientific graphs and charts from PDF extraction data.

CRITICAL: Your response must contain ONLY Python code. Nothing else. No text, no explanations, no metadata, no search intent tags, no comments outside the code block.

ABSOLUTE REQUIREMENTS:
1. Your ENTIRE response must be a single Python code block wrapped in triple backticks
2. Format: \`\`\`python\n[code here]\n\`\`\`
3. Do NOT include [SEARCH_INTENT: ...] or [SEARCH_TERMS: ...] tags
4. Do NOT include any text before or after the code block
5. Do NOT include explanatory comments outside the code block
6. Do NOT generate search suggestions
7. Extract data from the PDF extraction tables provided below
8. Use matplotlib with appropriate chart types (bar charts for comparisons, line charts for trends, etc.)
9. If Confidence intervals are provided, use them to calculate the error bars
10. The code must be complete and executable

PDF EXTRACTIONS WITH TABLES:
`;

  // Log context being provided
  console.log(`[Graph Prompt] Building prompt with ${contextExtractions.length} extraction(s)`);

  contextExtractions.forEach((extraction, index) => {
    const extractionNum = index + 1;
    prompt += `\n[EXT${extractionNum}] ${extraction.fileName}\n`;
    
    // Debug: Log what we're receiving
    console.log(`[Graph Prompt] EXT${extractionNum} structure:`, {
      hasTables: extraction.hasTables,
      tablesDataExists: !!extraction.tablesData,
      tablesDataIsArray: Array.isArray(extraction.tablesData),
      tablesDataLength: extraction.tablesData?.length || 0,
      tablesDataType: typeof extraction.tablesData
    });
    
    // Log markdown content preview
    if (extraction.markdownContent) {
      const markdownPreview = extraction.markdownContent.substring(0, 100).replace(/\n/g, ' ');
      console.log(`[Graph Prompt] EXT${extractionNum} markdown (first 100 chars): ${markdownPreview}...`);
    }
    
    // Add structured tables as CSV format
    if (extraction.tablesData && Array.isArray(extraction.tablesData) && extraction.tablesData.length > 0) {
      console.log(`[Graph Prompt] EXT${extractionNum} has ${extraction.tablesData.length} table(s)`);
      prompt += `TABLES (${extraction.tablesData.length} found) - CSV format:\n`;
      extraction.tablesData.forEach((table, tableIndex) => {
        // Log table preview
        const tablePreview = `Headers: ${table.headers?.join(', ') || 'N/A'} | First row: ${table.rows?.[0]?.join(', ') || 'N/A'}`;
        console.log(`[Graph Prompt] EXT${extractionNum} Table ${tableIndex + 1} (first 100 chars): ${tablePreview.substring(0, 100)}...`);
        console.log(`[Graph Prompt] EXT${extractionNum} Table ${tableIndex + 1} structure:`, {
          hasHeaders: !!table.headers,
          headersLength: table.headers?.length || 0,
          hasRows: !!table.rows,
          rowsLength: table.rows?.length || 0,
          firstRowLength: table.rows?.[0]?.length || 0
        });
        
        // Convert table to CSV format
        if (table.headers && Array.isArray(table.headers) && table.rows && Array.isArray(table.rows)) {
          prompt += `\nTable ${tableIndex + 1} (CSV):\n`;
          // CSV header row
          prompt += table.headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(',') + '\n';
          // CSV data rows
          table.rows.forEach((row) => {
            if (Array.isArray(row)) {
              prompt += row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',') + '\n';
            }
          });
          prompt += `\n`;
        } else {
          console.log(`[Graph Prompt] EXT${extractionNum} Table ${tableIndex + 1} has invalid structure - headers or rows not arrays`);
        }
      });
    } else {
      console.log(`[Graph Prompt] EXT${extractionNum} has NO tables - tablesData:`, {
        exists: !!extraction.tablesData,
        isArray: Array.isArray(extraction.tablesData),
        type: typeof extraction.tablesData,
        value: extraction.tablesData
      });
    }
    
    // Log graph data if available
    if (extraction.graphifyResults && extraction.graphifyResults.length > 0) {
      const graphs = extraction.graphifyResults.filter(g => g.isGraph);
      console.log(`[Graph Prompt] EXT${extractionNum} has ${graphs.length} graph(s) in graphifyResults`);
      graphs.forEach((graph, graphIndex) => {
        const graphDataPreview = graph.data ? JSON.stringify(graph.data).substring(0, 100) : 'N/A';
        console.log(`[Graph Prompt] EXT${extractionNum} Graph ${graphIndex + 1} data (first 100 chars): ${graphDataPreview}...`);
      });
    }
  });

  prompt += `
INSTRUCTIONS:
1. Examine ALL table data in the PDF extractions (provided in CSV format)
2. For endpoint/outcome comparisons: Look for tables with "Primary outcomes / end points", "Key secondary endpoints", or similar
3. For demographics comparisons: Look for tables with "Demographics", "Patient Characteristics", or similar
4. Extract relevant data points from the CSV tables: endpoints or outcomes (X-axis labels), drugs+dosages (series), values (Y-axis labels)
5. Use pandas to read the CSV data: pd.read_csv(StringIO(csv_string)) or parse the CSV directly
6. If Confidence intervals are provided, use them to calculate the error bars
7. Generate Python code using matplotlib to create the appropriate chart type

YOUR RESPONSE FORMAT (THIS IS THE ONLY THING YOU SHOULD OUTPUT):
\`\`\`python
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from io import StringIO
# [your data extraction and plotting code here]
plt.show()
\`\`\`

CRITICAL REMINDERS:
- Your ENTIRE response must be ONLY the code block above
- Do NOT add [SEARCH_INTENT: ...] or [SEARCH_TERMS: ...] tags
- Do NOT add any text before or after the code block
- Do NOT add explanatory comments outside the code block
- Make sure your code block is complete with opening and closing triple backticks
- Adapt your code based on the actual CSV table data you find
- Use appropriate chart types: bar charts for categorical comparisons, line charts for trends over time
- Extract numbers directly from the CSV - do NOT hallucinate or invent values

Your response should start with \`\`\`python and end with \`\`\`. Nothing else.`;

  return prompt;
}

/**
 * Build system prompt for search intent
 * Focused on helping users search for clinical trials and papers
 */
export function buildSearchPrompt(
  contextPapers?: ContextPaper[], 
  contextPressReleases?: ContextPressRelease[]
): string {
  let prompt = `You are a medical research search assistant. Your goal is to help users find relevant clinical trials and research papers.

CRITICAL RULES:
1. When the user wants to search, respond briefly (1-2 sentences) confirming you can search
2. Use the [SEARCH_INTENT: yes] and [SEARCH_TERMS: ...] format
3. Keep responses concise - under 100 tokens
4. Do NOT generate graphs or Python code
5. Do NOT provide detailed analysis - just confirm the search

RESPONSE FORMAT:
[SEARCH_INTENT: yes]
[SEARCH_TERMS: extracted search terms]
Your brief confirmation message here.

Example:
[SEARCH_INTENT: yes]
[SEARCH_TERMS: GLP-1 agonists diabetes]
I can search for clinical trials and papers on GLP-1 agonists for diabetes.`;

  // Add context if available (but keep it brief for search intent)
  if (contextPapers && contextPapers.length > 0) {
    prompt += `\n\nNote: You have ${contextPapers.length} reference paper(s) in context that may be relevant.`;
  }

  if (contextPressReleases && contextPressReleases.length > 0) {
    prompt += `\nNote: You have ${contextPressReleases.length} press release(s) in context.`;
  }

  return prompt;
}

/**
 * Build system prompt with context papers, press releases, and PDF extractions (ABC-39, HW9)
 * Papers, press releases, and extractions persist in system prompt across the conversation
 * Used for general conversation (not search or graph generation)
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
    console.log(`[General Prompt] Building prompt with ${contextPapers.length} paper(s)`);
    contextPrompt += `
REFERENCE PAPERS:
`;
    contextPapers.forEach((paper, index) => {
      const citationNum = index + 1;
      const abstractPreview = paper.abstract.substring(0, 100).replace(/\n/g, ' ');
      console.log(`[General Prompt] Paper ${citationNum} abstract (first 100 chars): ${abstractPreview}...`);
      
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
    console.log(`[General Prompt] Building prompt with ${contextPressReleases.length} press release(s)`);
    contextPrompt += `
PRESS RELEASES:
`;
    contextPressReleases.forEach((pr, index) => {
      const citationNum = index + 1;
      const summaryPreview = pr.summary.substring(0, 100).replace(/\n/g, ' ');
      const fullTextPreview = pr.fullText ? pr.fullText.substring(0, 100).replace(/\n/g, ' ') : 'N/A';
      console.log(`[General Prompt] PR${citationNum} summary (first 100 chars): ${summaryPreview}...`);
      if (pr.fullText) {
        console.log(`[General Prompt] PR${citationNum} fullText (first 100 chars): ${fullTextPreview}...`);
      }
      
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
    console.log(`[General Prompt] Building prompt with ${contextExtractions.length} extraction(s)`);
    
    contextPrompt += `
PDF EXTRACTIONS:
`;
    contextExtractions.forEach((extraction, index) => {
      const extractionNum = index + 1;
      
      contextPrompt += `
[EXT${extractionNum}] ${extraction.fileName}

`;
      
      // Log markdown content preview
      if (extraction.markdownContent) {
        const markdownPreview = extraction.markdownContent.substring(0, 100).replace(/\n/g, ' ');
        console.log(`[General Prompt] EXT${extractionNum} markdown (first 100 chars): ${markdownPreview}...`);
      }
      
      // Add structured tables as CSV format
      if (extraction.tablesData && Array.isArray(extraction.tablesData) && extraction.tablesData.length > 0) {
        console.log(`[General Prompt] EXT${extractionNum} has ${extraction.tablesData.length} table(s)`);
        contextPrompt += `TABLES (${extraction.tablesData.length} found) - CSV format:\n`;
        extraction.tablesData.forEach((table, tableIndex) => {
          // Log table preview
          const tablePreview = `Headers: ${table.headers?.join(', ') || 'N/A'} | First row: ${table.rows?.[0]?.join(', ') || 'N/A'}`;
          console.log(`[General Prompt] EXT${extractionNum} Table ${tableIndex + 1} (first 100 chars): ${tablePreview.substring(0, 100)}...`);
          
          // Convert table to CSV format
          if (table.headers && Array.isArray(table.headers) && table.rows && Array.isArray(table.rows)) {
            contextPrompt += `\nTable ${tableIndex + 1} (CSV):\n`;
            // CSV header row
            contextPrompt += table.headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(',') + '\n';
            // CSV data rows
            table.rows.forEach((row) => {
              if (Array.isArray(row)) {
                contextPrompt += row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',') + '\n';
              }
            });
            contextPrompt += `\n`;
          }
        });
      } else {
        console.log(`[General Prompt] EXT${extractionNum} has NO tables - tablesData:`, {
          exists: !!extraction.tablesData,
          isArray: Array.isArray(extraction.tablesData),
          type: typeof extraction.tablesData
        });
      }
      
      // Add graph images if available (only if not generating a graph)
      if (!isGraphRequest && extraction.graphifyResults && extraction.graphifyResults.length > 0) {
        const graphs = extraction.graphifyResults.filter(g => g.isGraph);
        if (graphs.length > 0) {
          console.log(`[General Prompt] EXT${extractionNum} has ${graphs.length} graph(s) in graphifyResults`);
          contextPrompt += `\nGRAPHS (${graphs.length} found):\n`;
          graphs.forEach((graph, graphIndex) => {
            // Log graph data preview
            const graphDataPreview = graph.data ? JSON.stringify(graph.data).substring(0, 100) : 'N/A';
            console.log(`[General Prompt] EXT${extractionNum} Graph ${graphIndex + 1} data (first 100 chars): ${graphDataPreview}...`);
            
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
  // Filter out empty messages to avoid API errors
  const recentHistory = chatHistory.slice(-6).filter(msg => {
    const hasContent = msg.message && typeof msg.message === 'string' && msg.message.trim().length > 0;
    if (!hasContent) {
      console.warn('[buildMessagesFromHistory] Skipping empty message:', { type: msg.type, messageLength: msg.message?.length });
    }
    return hasContent;
  });
  
  recentHistory.forEach(msg => {
    messages.push({
      role: msg.type === 'user' ? 'user' : 'assistant',
      content: msg.message.trim()
    });
  });

  // Add current user query (only if not empty)
  if (currentQuery && typeof currentQuery === 'string' && currentQuery.trim().length > 0) {
    // HW8 ABC-57: Append format reminder to reinforce metadata requirement
    // But only for non-graph requests (graph requests should not have this reminder)
    const queryWithReminder = `${currentQuery.trim()}

[Remember: Start your response with [SEARCH_INTENT: yes/no] and [SEARCH_TERMS: ...] tags]`;
    
    messages.push({
      role: 'user',
      content: queryWithReminder
    });
  } else {
    console.warn('[buildMessagesFromHistory] Current query is empty, skipping');
  }

  // Final safety check: ensure all messages have non-empty content
  const validMessages = messages.filter(msg => msg.content && msg.content.trim().length > 0);
  
  if (validMessages.length !== messages.length) {
    console.warn(`[buildMessagesFromHistory] Filtered out ${messages.length - validMessages.length} empty message(s)`);
  }

  return validMessages;
}

