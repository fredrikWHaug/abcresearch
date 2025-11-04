import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { BioRxivPreprint, BioRxivSearchParams, BioRxivAPIResponse } from '../src/types/preprints';

// Rate limiting for bioRxiv API
const RATE_LIMIT_DELAY = 1000; // 1 second between requests
let lastRequestTime = 0;

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY - timeSinceLastRequest));
  }

  lastRequestTime = Date.now();
  return fetch(url);
}

function calculateRelevanceScore(item: any, query: string): number {
  let score = 0;
  const queryLower = query.toLowerCase();
  const queryTerms = queryLower.split(/\s+/).filter(term => term.length > 2);

  // Title relevance (highest weight)
  const titleLower = item.title.toLowerCase();
  queryTerms.forEach(term => {
    if (titleLower.includes(term)) {
      score += 3;
    }
  });

  // Abstract relevance
  const abstractLower = item.abstract.toLowerCase();
  queryTerms.forEach(term => {
    if (abstractLower.includes(term)) {
      score += 2;
    }
  });

  // Category relevance (bonus if query matches category)
  const categoryLower = item.category.toLowerCase();
  queryTerms.forEach(term => {
    if (categoryLower.includes(term)) {
      score += 1;
    }
  });

  // Recency bonus (papers from last 30 days get bonus)
  const paperDate = new Date(item.date);
  const daysSincePublished = (Date.now() - paperDate.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSincePublished <= 30) {
    score += 2;
  } else if (daysSincePublished <= 90) {
    score += 1;
  }

  return score;
}

function formatAuthors(authorsString: string): string[] {
  // bioRxiv returns authors as semicolon-separated string
  return authorsString.split(';').map(author => author.trim()).filter(author => author.length > 0);
}

async function searchBioRxiv(params: BioRxivSearchParams): Promise<BioRxivPreprint[]> {
  const {
    query,
    server = 'both',
    startDate,
    endDate,
    maxResults = 30
  } = params;

  // Default to last 6 months if no date range provided
  const defaultEndDate = new Date().toISOString().split('T')[0];
  const defaultStartDate = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const start = startDate || defaultStartDate;
  const end = endDate || defaultEndDate;

  const servers = server === 'both' ? ['biorxiv', 'medrxiv'] : [server];
  const allResults: BioRxivPreprint[] = [];

  for (const serverName of servers) {
    try {
      // bioRxiv API endpoint for date range query
      const url = `https://api.biorxiv.org/details/${serverName}/${start}/${end}/json`;

      const response = await rateLimitedFetch(url);

      if (!response.ok) {
        console.error(`Error fetching from ${serverName}:`, response.statusText);
        continue;
      }

      const data: BioRxivAPIResponse = await response.json();

      if (!data.collection || data.collection.length === 0) {
        continue;
      }

      // Filter and score results
      const relevantResults = data.collection
        .map(item => {
          const relevanceScore = calculateRelevanceScore(item, query);

          if (relevanceScore === 0) {
            return null; // Skip irrelevant results
          }

          const preprint: BioRxivPreprint = {
            doi: item.doi,
            title: item.title,
            abstract: item.abstract,
            authors: formatAuthors(item.authors),
            authorCorresponding: item.author_corresponding,
            date: item.date,
            version: item.version,
            category: item.category,
            server: item.server as 'biorxiv' | 'medrxiv',
            relevanceScore,
            fullTextLinks: {
              doi: `https://doi.org/${item.doi}`,
              ...(item.server === 'biorxiv' && { biorxiv: `https://www.biorxiv.org/content/${item.doi}v${item.version}` }),
              ...(item.server === 'medrxiv' && { medrxiv: `https://www.medrxiv.org/content/${item.doi}v${item.version}` })
            }
          };

          return preprint;
        })
        .filter((item): item is BioRxivPreprint => item !== null)
        .sort((a, b) => b.relevanceScore - a.relevanceScore);

      allResults.push(...relevantResults);

    } catch (error) {
      console.error(`Error searching ${serverName}:`, error);
    }
  }

  // Sort all results by relevance and limit
  return allResults
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, maxResults);
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const searchParams: BioRxivSearchParams = req.body;

    if (!searchParams.query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    const results = await searchBioRxiv(searchParams);

    return res.status(200).json({
      success: true,
      count: results.length,
      results
    });

  } catch (error) {
    console.error('Error in search-preprints:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
