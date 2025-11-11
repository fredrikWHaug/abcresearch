// Vercel API Route for IR Decks search via SEC EDGAR

import type { IRDeck, IRDeckSearchParams } from '../src/types/ir-decks.js';

interface SECFiling {
  accessionNumber: string;
  filingDate: string;
  reportDate: string;
  acceptanceDateTime: string;
  act: string;
  form: string;
  fileNumber: string;
  filmNumber: string;
  items: string;
  size: number;
  isXBRL: number;
  isInlineXBRL: number;
  primaryDocument: string;
  primaryDocDescription: string;
}

interface SECCompanyData {
  cik: string;
  entityType: string;
  sic: string;
  sicDescription: string;
  name: string;
  tickers?: string[];
  exchanges?: string[];
  filings: {
    recent: {
      accessionNumber: string[];
      filingDate: string[];
      reportDate: string[];
      acceptanceDateTime: string[];
      act: string[];
      form: string[];
      fileNumber: string[];
      filmNumber: string[];
      items: string[];
      size: number[];
      isXBRL: number[];
      isInlineXBRL: number[];
      primaryDocument: string[];
      primaryDocDescription: string[];
    };
  };
}

// Rate limiting
const RATE_LIMIT_DELAY = 100; // SEC requires reasonable rate (100ms between requests)
let lastRequestTime = 0;

function calculateRelevanceScore(filing: any, query: string): number {
  let score = 50; // Base score

  // Prefer certain filing types
  if (filing.form === 'DEF 14A') score += 20; // Proxy statements often have presentations
  if (filing.form === '8-K') score += 15; // Current reports may have IR materials
  if (filing.form === 'DEFA14A') score += 15; // Additional proxy materials
  if (filing.form === 'SC 13D') score += 10; // Beneficial ownership

  // Recency bonus
  const filingDate = new Date(filing.filingDate);
  const daysSinceFiling = (Date.now() - filingDate.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceFiling <= 30) {
    score += 20;
  } else if (daysSinceFiling <= 90) {
    score += 15;
  } else if (daysSinceFiling <= 180) {
    score += 10;
  } else if (daysSinceFiling <= 365) {
    score += 5;
  }

  return Math.min(score, 100);
}

function transformToIRDeck(
  filing: any,
  companyName: string,
  ticker: string | undefined,
  cik: string
): IRDeck {
  const accessionNumber = filing.accessionNumber.replace(/-/g, '');
  const filingUrl = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=${filing.form}&dateb=&owner=exclude&count=1`;

  // Construct document URL
  const documentUrl = filing.primaryDocument
    ? `https://www.sec.gov/Archives/edgar/data/${cik}/${accessionNumber}/${filing.primaryDocument}`
    : undefined;

  return {
    id: `ir-${accessionNumber}`,
    company: companyName,
    ticker: ticker,
    title: `${filing.form} - ${filing.primaryDocDescription || 'SEC Filing'}`,
    filingType: filing.form,
    filingDate: filing.filingDate,
    reportDate: filing.reportDate || filing.filingDate,
    description: filing.items || filing.primaryDocDescription,
    url: filingUrl,
    documentUrl: documentUrl,
    relevanceScore: calculateRelevanceScore(filing, companyName)
  };
}

async function searchCompanyByCIK(cik: string): Promise<SECCompanyData | null> {
  // Rate limiting
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY - timeSinceLastRequest));
  }
  lastRequestTime = Date.now();

  try {
    const paddedCik = cik.padStart(10, '0');
    const url = `https://data.sec.gov/submissions/CIK${paddedCik}.json`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'ABC Research abcresearch@example.com',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.error(`SEC API error for CIK ${cik}:`, response.statusText);
      return null;
    }

    const data: SECCompanyData = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching SEC data for CIK ${cik}:`, error);
    return null;
  }
}

// Simple company name to potential tickers mapping
// In production, you'd use a proper company database or API
const COMPANY_TICKER_MAP: Record<string, string> = {
  'eli lilly': '0000059478',
  'novo nordisk': '0001108134',
  'pfizer': '0000078003',
  'moderna': '0001682852',
  'biontech': '0001776985',
  'neumora therapeutics': '0001907249',
  // Add more as needed
};

function getCIKFromCompany(companyName: string): string | null {
  const normalized = companyName.toLowerCase();

  // Try exact match first
  if (COMPANY_TICKER_MAP[normalized]) {
    return COMPANY_TICKER_MAP[normalized];
  }

  // Try partial match
  for (const [key, cik] of Object.entries(COMPANY_TICKER_MAP)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return cik;
    }
  }

  return null;
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
    const params: IRDeckSearchParams = req.body;

    if (!params.query && !params.company) {
      return res.status(400).json({ error: 'Query or company parameter is required' });
    }

    const companyName = params.company || params.query;
    const cik = getCIKFromCompany(companyName);

    if (!cik) {
      console.log(`No CIK found for company: ${companyName}`);
      return res.status(200).json({
        irDecks: [],
        totalCount: 0
      });
    }

    console.log(`Searching SEC filings for company: ${companyName} (CIK: ${cik})`);

    const companyData = await searchCompanyByCIK(cik);

    if (!companyData) {
      return res.status(200).json({
        irDecks: [],
        totalCount: 0
      });
    }

    // Filter filings to relevant types
    const relevantForms = params.filingTypes || ['8-K', 'DEF 14A', 'DEFA14A', 'SC 13D'];
    const maxResults = params.maxResults || 20;

    const filings: any[] = [];
    const recentFilings = companyData.filings.recent;

    for (let i = 0; i < recentFilings.form.length && filings.length < maxResults * 2; i++) {
      if (relevantForms.includes(recentFilings.form[i])) {
        filings.push({
          accessionNumber: recentFilings.accessionNumber[i],
          filingDate: recentFilings.filingDate[i],
          reportDate: recentFilings.reportDate[i],
          form: recentFilings.form[i],
          items: recentFilings.items[i],
          primaryDocument: recentFilings.primaryDocument[i],
          primaryDocDescription: recentFilings.primaryDocDescription[i]
        });
      }
    }

    // Transform and sort by relevance
    const irDecks = filings
      .map(filing => transformToIRDeck(
        filing,
        companyData.name,
        companyData.tickers?.[0],
        cik
      ))
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, maxResults);

    return res.status(200).json({
      irDecks,
      totalCount: filings.length
    });

  } catch (error) {
    console.error('Error searching IR decks:', error);
    return res.status(500).json({
      error: 'Failed to search IR decks',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
