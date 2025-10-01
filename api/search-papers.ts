// Vercel API Route for PubMed paper search

interface PubMedSearchRequest {
  query: string;
  maxResults?: number;
  startDate?: string;
  endDate?: string;
}

// Rate limiting: PubMed allows 3 requests/second without API key, 10 with API key
const RATE_LIMIT_DELAY = 350; // 350ms between requests (safe for 3 req/sec)
let lastRequestTime = 0;

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
    const { query, maxResults, startDate, endDate }: PubMedSearchRequest = req.body;
    
    if (!query || query.trim().length === 0) {
      return res.status(400).json({ error: 'Query is required' });
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
      term: query,
      retmode: 'json',
      retmax: (maxResults || 20).toString(),
      sort: 'relevance'
    });

    if (API_KEY) searchParams.append('api_key', API_KEY);
    if (EMAIL) searchParams.append('email', EMAIL);

    console.log(`Searching PubMed for: ${query}`);
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
