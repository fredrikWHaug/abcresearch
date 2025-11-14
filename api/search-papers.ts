// Vercel API Route for PubMed paper search with LLM-based query enhancement

interface PubMedSearchRequest {
  query: string;
  maxResults?: number;
  startDate?: string;
  endDate?: string;
  enhanceQuery?: boolean;  // Whether to use LLM to enhance the query
}

// Rate limiting: PubMed allows 3 requests/second without API key, 10 with API key
const RATE_LIMIT_DELAY = 350; // 350ms between requests (safe for 3 req/sec)
let lastRequestTime = 0;

/**
 * Enhance PubMed query using Gemini LLM to construct better search terms
 * TODO: We are only making ONE PubMed query - we should be using 5 strategies. 
 * Enhance queries should be coming up with 5 clinical trials queries and 5 paper queries
 */
async function enhancePubMedQuery(userQuery: string): Promise<string> {
  const geminiApiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!geminiApiKey) {
    console.warn('No Gemini API key - using query as-is');
    return userQuery;
  }

  const prompt = `You are an expert at constructing PubMed search queries using E-Utilities API syntax.

USER QUERY: "${userQuery}"

Your task is to construct an optimized PubMed search query that will find the most relevant clinical trial papers and research articles.

PUBMED SEARCH SYNTAX:
- Use AND, OR, NOT for boolean operators
- Use [Field] tags for field-specific searches:
  - [Title/Abstract] - search in title and abstract
  - [Publication Type] - filter by publication type
  - [MeSH Terms] - Medical Subject Headings
  - [All Fields] - search everywhere
- Use quotes for exact phrases: "GLP-1 receptor agonist"
- Common publication types for trials: "Clinical Trial", "Randomized Controlled Trial", "Clinical Trial, Phase II", "Clinical Trial, Phase III"

GUIDELINES:
- Extract the main medical condition or disease
- Extract any specific drug names mentioned
- Extract phase information if specified
- Include relevant MeSH terms and synonyms
- Always filter by clinical trial publication types unless user specifically asks for all articles
- Use proper boolean operators to combine terms

EXAMPLES:

Query: "Phase 3 semaglutide obesity trials"
Enhanced: semaglutide[Title/Abstract] AND obesity[Title/Abstract] AND ("Clinical Trial, Phase III"[Publication Type] OR "Clinical Trial"[Publication Type])

Query: "GLP-1 receptor agonist diabetes"
Enhanced: ("GLP-1 receptor agonist"[Title/Abstract] OR "glucagon-like peptide-1"[Title/Abstract]) AND diabetes[Title/Abstract] AND ("Clinical Trial"[Publication Type] OR "Randomized Controlled Trial"[Publication Type])

Query: "Alzheimer's immunotherapy trials"
Enhanced: ("Alzheimer"[Title/Abstract] OR "Alzheimer's disease"[MeSH Terms]) AND (immunotherapy[Title/Abstract] OR "antibody therapy"[Title/Abstract]) AND ("Clinical Trial"[Publication Type] OR "Randomized Controlled Trial"[Publication Type])

Return ONLY the enhanced query string (no JSON, no markdown, just the query).`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 300,
        }
      })
    });

    if (!response.ok) {
      console.warn('Gemini API error - using query as-is');
      return userQuery;
    }

    const data = await response.json();
    const enhancedQuery = data.candidates[0].content.parts[0].text.trim();
    
    console.log(`✅ LLM enhanced PubMed query:`);
    console.log(`   Original: ${userQuery}`);
    console.log(`   Enhanced: ${enhancedQuery}`);
    
    return enhancedQuery;
  } catch (error) {
    console.error('Error enhancing PubMed query with LLM:', error);
    return userQuery;
  }
}

export default async function handler(
  req: any,
  res: any
) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { query, maxResults, startDate, endDate, enhanceQuery = false }: PubMedSearchRequest = req.body;
    
    if (!query || query.trim().length === 0) {
      return res.status(400).json({ error: 'Query is required' });
    }

    // Optionally enhance the query using LLM
    let searchQuery = query;
    if (enhanceQuery) {
      searchQuery = await enhancePubMedQuery(query);
    }

    // Rate limiting: Ensure we don't exceed PubMed's rate limits
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY - timeSinceLastRequest));
    }
    lastRequestTime = Date.now();

    // Build PubMed search URL
    const BASE_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
    const API_KEY = process.env.PUBMED_API_KEY || '';
    const EMAIL = process.env.PUBMED_EMAIL || 'your-email@example.com';
    
    // Log API key status for debugging
    if (API_KEY) {
      console.log('Using PubMed API key for enhanced rate limits');
    } else {
      console.log('No API key provided - using standard rate limits (3 req/sec)');
    }

    // Step 1: Search for PMIDs
    const searchParams = new URLSearchParams({
      db: 'pubmed',
      term: searchQuery,
      retmode: 'json',
      retmax: (maxResults || 20).toString(),
      sort: 'relevance'
    });

    if (API_KEY) searchParams.append('api_key', API_KEY);
    if (EMAIL) searchParams.append('email', EMAIL);

    console.log(`Searching PubMed for: ${searchQuery}`);
    const searchResponse = await fetch(`${BASE_URL}/esearch.fcgi?${searchParams.toString()}`);
    
    if (!searchResponse.ok) {
      throw new Error(`PubMed API error: ${searchResponse.statusText}`);
    }
    
    const searchData = await searchResponse.json();
    
    const pmids = searchData.esearchresult?.idlist || [];
    if (pmids.length === 0) {
      return res.status(200).json({ papers: [] });
    }

    // Step 2: Fetch article details (with additional rate limiting)
    const now2 = Date.now();
    const timeSinceLastRequest2 = now2 - lastRequestTime;
    if (timeSinceLastRequest2 < RATE_LIMIT_DELAY) {
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY - timeSinceLastRequest2));
    }
    lastRequestTime = Date.now();

    const fetchParams = new URLSearchParams({
      db: 'pubmed',
      id: pmids.join(','),
      retmode: 'xml'
    });

    if (API_KEY) fetchParams.append('api_key', API_KEY);
    if (EMAIL) fetchParams.append('email', EMAIL);

    console.log(`Fetching details for ${pmids.length} papers`);
    const fetchResponse = await fetch(`${BASE_URL}/efetch.fcgi?${fetchParams.toString()}`);
    
    if (!fetchResponse.ok) {
      throw new Error(`PubMed API error: ${fetchResponse.statusText}`);
    }
    
    const xmlData = await fetchResponse.text();
    
    // Parse XML response
    const papers = parseArticlesXML(xmlData);
    
    return res.status(200).json({ papers });
  } catch (error) {
    console.error('Paper search error:', error);
    return res.status(500).json({ error: 'Failed to search papers' });
  }
}

// Helper functions for XML parsing
function parseArticlesXML(xmlData: string): any[] {
  const articles: any[] = [];
  
  // Extract each PubmedArticle block
  const articleMatches = xmlData.match(/<PubmedArticle>[\s\S]*?<\/PubmedArticle>/g) || [];
  
  for (const articleXml of articleMatches) {
    const article = {
      pmid: extractXMLValue(articleXml, 'PMID') || '',
      title: extractXMLValue(articleXml, 'ArticleTitle') || '',
      abstract: extractXMLValue(articleXml, 'AbstractText') || '',
      journal: extractXMLValue(articleXml, 'Title') || '',
      publicationDate: extractPublicationDate(articleXml),
      doi: extractXMLValue(articleXml, 'ELocationID') || undefined,
      authors: extractAuthors(articleXml),
      nctNumber: extractNCTNumber(articleXml),
      relevanceScore: calculateRelevanceScore(articleXml),
      fullTextLinks: {
        pubmed: `https://pubmed.ncbi.nlm.nih.gov/${extractXMLValue(articleXml, 'PMID')}/`
      }
    };
    
    if (article.doi) {
      (article.fullTextLinks as any).doi = `https://doi.org/${article.doi}`;
    }
    
    articles.push(article);
  }
  
  return articles;
}

function extractXMLValue(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*>([^<]*)<\/${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

function extractPublicationDate(xml: string): string {
  const year = extractXMLValue(xml, 'Year') || '';
  const month = extractXMLValue(xml, 'Month') || '01';
  const day = extractXMLValue(xml, 'Day') || '01';
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function extractAuthors(xml: string): string[] {
  const authors: string[] = [];
  const authorMatches = xml.match(/<Author[^>]*>[\s\S]*?<\/Author>/g) || [];
  
  for (const authorXml of authorMatches) {
    const lastName = extractXMLValue(authorXml, 'LastName') || '';
    const foreName = extractXMLValue(authorXml, 'ForeName') || '';
    if (lastName) {
      authors.push(`${lastName} ${foreName}`.trim());
    }
  }
  
  return authors.slice(0, 5); // Limit to first 5 authors
}

function extractNCTNumber(xml: string): string | undefined {
  const nctMatch = xml.match(/NCT\d{8}/);
  return nctMatch ? nctMatch[0] : undefined;
}

function calculateRelevanceScore(xml: string): number {
  let score = 50; // Base score
  
  // Premium journal bonus
  const journal = extractXMLValue(xml, 'Title') || '';
  const premiumJournals = ['New England Journal', 'JAMA', 'Lancet', 'Nature Medicine'];
  if (premiumJournals.some(j => journal.includes(j))) {
    score += 30;
  }
  
  // Phase 3 trial bonus
  if (xml.includes('Clinical Trial, Phase III')) {
    score += 20;
  }
  
  // Recent publication bonus
  const year = parseInt(extractXMLValue(xml, 'Year') || '0');
  const currentYear = new Date().getFullYear();
  if (currentYear - year <= 2) {
    score += 15;
  }
  
  return Math.min(score, 100);
}
