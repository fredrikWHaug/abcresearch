// Vercel API Route for Press Releases search via NewsAPI

import type { PressRelease, PressReleaseSearchParams } from '../src/types/press-releases.js';

interface NewsAPIArticle {
  source: {
    id: string | null;
    name: string;
  };
  author: string | null;
  title: string;
  description: string;
  url: string;
  publishedAt: string;
  content: string;
}

interface NewsAPIResponse {
  status: string;
  totalResults: number;
  articles: NewsAPIArticle[];
}

// Rate limiting
const RATE_LIMIT_DELAY = 1000; // 1 second between requests
let lastRequestTime = 0;

function calculateRelevanceScore(article: NewsAPIArticle, query: string): number {
  let score = 50; // Base score
  const queryLower = query.toLowerCase();
  const queryTerms = queryLower.split(/\s+/).filter(term => term.length > 2);

  // Title relevance (highest weight)
  const titleLower = article.title.toLowerCase();
  queryTerms.forEach(term => {
    if (titleLower.includes(term)) {
      score += 3;
    }
  });

  // Description relevance
  if (article.description) {
    const descLower = article.description.toLowerCase();
    queryTerms.forEach(term => {
      if (descLower.includes(term)) {
        score += 2;
      }
    });
  }

  // Check for press release indicators
  const prIndicators = ['press release', 'announces', 'reports', 'statement'];
  const combinedText = `${article.title} ${article.description || ''}`.toLowerCase();
  prIndicators.forEach(indicator => {
    if (combinedText.includes(indicator)) {
      score += 10;
    }
  });

  // Recency bonus
  const publishDate = new Date(article.publishedAt);
  const daysSincePublish = (Date.now() - publishDate.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSincePublish <= 7) {
    score += 15;
  } else if (daysSincePublish <= 30) {
    score += 10;
  } else if (daysSincePublish <= 90) {
    score += 5;
  }

  return Math.min(score, 100);
}

function extractCompanyName(article: NewsAPIArticle): string {
  // Priority 1: Use author field if available (often contains company name)
  if (article.author && article.author.trim().length > 0) {
    // Clean up author field (sometimes has extra text like "Press Release by...")
    const author = article.author.trim();
    // Remove common prefixes
    const cleanAuthor = author
      .replace(/^(Press Release by|By|From)\s+/i, '')
      .trim();

    if (cleanAuthor.length > 0 && cleanAuthor.toLowerCase() !== 'unknown') {
      return cleanAuthor;
    }
  }

  // Priority 2: Try to extract company name from title
  const title = article.title;
  const patterns = [
    // Match: "Company Name Announces..." or "Company Name Reports..."
    /^([A-Z][a-zA-Z0-9\s&.,'\-]+?)\s+(announces|reports|says|releases|completes|receives|expands|launches|partners|signs)/i,
    // Match: "Company Name:"
    /^([A-Z][a-zA-Z0-9\s&.,'\-]+?):/,
    // Match: "Company Name, Inc. Announces..."
    /^([A-Z][a-zA-Z0-9\s&.,'\-]+?(?:,\s*(?:Inc|LLC|Ltd|Corp|Co)\.?))\s+/i
  ];

  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }

  // Fallback: if title is very short or no match, return source name
  return article.source.name;
}

function transformToPressRelease(article: NewsAPIArticle, query: string): PressRelease {
  const company = extractCompanyName(article);

  // Generate unique ID using full URL hash
  const urlHash = Buffer.from(article.url).toString('base64').replace(/[+/=]/g, '').substring(0, 32);
  const timestamp = new Date(article.publishedAt).getTime();

  return {
    id: `pr-${urlHash}-${timestamp}`,
    title: article.title,
    company: company,
    releaseDate: article.publishedAt.split('T')[0],
    summary: article.description || article.content?.substring(0, 200) || '',
    fullText: article.content,
    source: article.source.name,
    url: article.url,
    relevanceScore: calculateRelevanceScore(article, query),
    mentionedDrugs: [],
    mentionedTrials: [],
    keyAnnouncements: []
  };
}

export default async function handler(req: any, res: any) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const params: PressReleaseSearchParams = req.body;

    if (!params.query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    const newsApiKey = process.env.NEWS_API_KEY;

    if (!newsApiKey) {
      console.error('NEWS_API_KEY not configured');
      return res.status(500).json({
        error: 'NEWS_API_KEY environment variable is required'
      });
    }

    // Rate limiting
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY - timeSinceLastRequest));
    }
    lastRequestTime = Date.now();

    // Build search query
    let searchQuery = params.query;
    if (params.company) {
      searchQuery = `${params.company} ${searchQuery}`;
    }
    searchQuery += ' (press release OR announces OR reports)';

    // Build NewsAPI URL
    const searchParams = new URLSearchParams({
      q: searchQuery,
      language: 'en',
      sortBy: 'relevancy',
      pageSize: Math.min(params.maxResults || 30, 100).toString()
    });

    // Add date filters
    if (params.startDate) {
      searchParams.append('from', params.startDate);
    } else {
      // Default to last 30 days
      const defaultStartDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        .toISOString().split('T')[0];
      searchParams.append('from', defaultStartDate);
    }

    if (params.endDate) {
      searchParams.append('to', params.endDate);
    } else {
      const defaultEndDate = new Date().toISOString().split('T')[0];
      searchParams.append('to', defaultEndDate);
    }

    console.log(`Searching NewsAPI for press releases: ${searchQuery}`);

    const response = await fetch(
      `https://newsapi.org/v2/everything?${searchParams.toString()}`,
      {
        headers: {
          'X-Api-Key': newsApiKey
        }
      }
    );

    if (!response.ok) {
      throw new Error(`NewsAPI error: ${response.statusText}`);
    }

    const data: NewsAPIResponse = await response.json();

    if (data.status !== 'ok') {
      throw new Error('NewsAPI returned error status');
    }

    // Transform and sort by relevance
    const pressReleases = data.articles
      .map(article => transformToPressRelease(article, params.query))
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, params.maxResults || 30);

    return res.status(200).json({
      pressReleases,
      totalCount: data.totalResults
    });

  } catch (error) {
    console.error('Error searching press releases:', error);
    return res.status(500).json({
      error: 'Failed to search press releases',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
