/**
 * Consolidated Search API
 * 
 * Handles multiple search types:
 * - POST /api/search?type=trials - Search clinical trials
 * - POST /api/search?type=papers - Search research papers
 * - POST /api/search?type=press-releases - Search press releases
 * - POST /api/search?type=ir-decks - Search IR decks via SEC EDGAR
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// Import types
interface SearchParams {
  'query.cond'?: string;
  'query.intr'?: string;
  'query.term'?: string;
  'query.locn'?: string;
  'filter.overallStatus'?: string;
  'query.patient'?: string;
  query?: string;
  condition?: string;
  sponsor?: string;
  phase?: string;
  status?: string;
  pageSize?: number;
  pageToken?: string;
  sort?: string;
}

interface PubMedSearchRequest {
  query: string;
  maxResults?: number;
  startDate?: string;
  endDate?: string;
  enhanceQuery?: boolean;
}

interface PressReleaseSearchParams {
  query: string;
  company?: string;
  maxResults?: number;
  startDate?: string;
  endDate?: string;
}

interface IRDeckSearchParams {
  query?: string;
  company?: string;
  filingTypes?: string[];
  maxResults?: number;
}

// Rate limiting
const RATE_LIMIT_DELAY_PUBMED = 350;
const RATE_LIMIT_DELAY_NEWS = 1000;
const RATE_LIMIT_DELAY_SEC = 100;
let lastRequestTimePubMed = 0;
let lastRequestTimeNews = 0;
let lastRequestTimeSEC = 0;

// ClinicalTrials.gov API v2 base URL
const BASE_URL_TRIALS = 'https://clinicaltrials.gov/api/v2';

// Helper: Parse query with LLM for trials
async function parseQueryWithLLM(userQuery: string): Promise<SearchParams> {
  const geminiApiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!geminiApiKey) {
    return { query: userQuery };
  }

  const prompt = `You are an expert at parsing natural language queries into structured ClinicalTrials.gov API v2 parameters.

USER QUERY: "${userQuery}"

Your task is to analyze this natural language query and extract structured parameters that match the ClinicalTrials.gov API v2 format.

Return ONLY a valid JSON object (no markdown) with these fields:
{
  "query.cond": "condition here" or omit if not specified,
  "query.intr": "drug name here" or omit if not specified,
  "query.term": "AREA[Phase](Phase X) and other terms" or omit if no phase/terms,
  "query.locn": "location here" or omit if not specified,
  "filter.overallStatus": "status here" or omit if not specified,
  "query.patient": "population here" or omit if not specified
}`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 500 }
      })
    });

    if (!response.ok) return { query: userQuery };
    const data = await response.json();
    const content = data.candidates[0].content.parts[0].text.trim();
    let cleanedContent = content.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) cleanedContent = jsonMatch[0];
    return JSON.parse(cleanedContent);
  } catch (error) {
    return { query: userQuery };
  }
}

// Helper: Enhance PubMed query with LLM
async function enhancePubMedQuery(userQuery: string): Promise<string> {
  const geminiApiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!geminiApiKey) return userQuery;

  const prompt = `You are an expert at constructing PubMed search queries using E-Utilities API syntax.

USER QUERY: "${userQuery}"

Construct an optimized PubMed search query. Use [Title/Abstract] tags, boolean operators, and filter by clinical trial publication types.

Return ONLY the enhanced query string (no JSON, no markdown, just the query).`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 300 }
      })
    });

    if (!response.ok) return userQuery;
    const data = await response.json();
    return data.candidates[0].content.parts[0].text.trim();
  } catch (error) {
    return userQuery;
  }
}

// Helper: Parse PubMed XML
function parseArticlesXML(xmlData: string): any[] {
  const articles: any[] = [];
  const articleMatches = xmlData.match(/<PubmedArticle>[\s\S]*?<\/PubmedArticle>/g) || [];
  
  for (const articleXml of articleMatches) {
    const extractValue = (tag: string) => {
      const regex = new RegExp(`<${tag}[^>]*>([^<]*)<\/${tag}>`, 'i');
      const match = articleXml.match(regex);
      return match ? match[1].trim() : null;
    };
    
    const extractDate = () => {
      const year = extractValue('Year') || '';
      const month = extractValue('Month') || '01';
      const day = extractValue('Day') || '01';
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    };
    
    const extractAuthors = () => {
      const authors: string[] = [];
      const authorMatches = articleXml.match(/<Author[^>]*>[\s\S]*?<\/Author>/g) || [];
      for (const authorXml of authorMatches.slice(0, 5)) {
        const lastName = extractValue('LastName') || '';
        const foreName = extractValue('ForeName') || '';
        if (lastName) authors.push(`${lastName} ${foreName}`.trim());
      }
      return authors;
    };
    
    const pmid = extractValue('PMID') || '';
    articles.push({
      pmid,
      title: extractValue('ArticleTitle') || '',
      abstract: extractValue('AbstractText') || '',
      journal: extractValue('Title') || '',
      publicationDate: extractDate(),
      doi: extractValue('ELocationID') || undefined,
      authors: extractAuthors(),
      nctNumber: articleXml.match(/NCT\d{8}/)?.[0],
      relevanceScore: 50 + (articleXml.includes('Clinical Trial, Phase III') ? 20 : 0),
      fullTextLinks: {
        pubmed: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
        ...(extractValue('ELocationID') ? { doi: `https://doi.org/${extractValue('ELocationID')}` } : {})
      }
    });
  }
  
  return articles;
}

// Helper: Transform NewsAPI article to PressRelease
function transformToPressRelease(article: any, query: string): any {
  const extractCompany = () => {
    if (article.author && article.author.trim().length > 0) {
      return article.author.replace(/^(Press Release by|By|From)\s+/i, '').trim();
    }
    const match = article.title.match(/^([A-Z][a-zA-Z0-9\s&.,'\-]+?)\s+(announces|reports|says)/i);
    return match ? match[1].trim() : article.source.name;
  };
  
  const calculateScore = () => {
    let score = 50;
    const queryLower = query.toLowerCase();
    const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 2);
    queryTerms.forEach(term => {
      if (article.title.toLowerCase().includes(term)) score += 3;
      if (article.description?.toLowerCase().includes(term)) score += 2;
    });
    const daysSince = (Date.now() - new Date(article.publishedAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince <= 7) score += 15;
    else if (daysSince <= 30) score += 10;
    return Math.min(score, 100);
  };
  
  const urlHash = Buffer.from(article.url).toString('base64').replace(/[+/=]/g, '').substring(0, 32);
  
  return {
    id: `pr-${urlHash}-${new Date(article.publishedAt).getTime()}`,
    title: article.title,
    company: extractCompany(),
    releaseDate: article.publishedAt.split('T')[0],
    summary: article.description || article.content?.substring(0, 200) || '',
    fullText: article.content,
    source: article.source.name,
    url: article.url,
    relevanceScore: calculateScore(),
    mentionedDrugs: [],
    mentionedTrials: [],
    keyAnnouncements: []
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const searchType = (req.query.type as string) || 'trials';

  try {
    if (searchType === 'trials') {
      // Clinical Trials Search
      let params: SearchParams = req.body;

      if (params.query && !params['query.cond'] && !params['query.intr'] && !params['query.term']) {
        const llmParsedParams = await parseQueryWithLLM(params.query);
        params = { ...params, ...llmParsedParams };
      }

      const queryParams = new URLSearchParams();
      if (params['query.cond']) queryParams.append('query.cond', params['query.cond']);
      if (params['query.intr']) queryParams.append('query.intr', params['query.intr']);
      if (params['query.term']) queryParams.append('query.term', params['query.term']);
      if (params['query.locn']) queryParams.append('query.locn', params['query.locn']);
      if (params['filter.overallStatus']) queryParams.append('filter.overallStatus', params['filter.overallStatus']);
      if (params['query.patient']) queryParams.append('query.patient', params['query.patient']);

      if (!queryParams.has('query.term') && (params.query || params.condition || params.phase)) {
        const parts: string[] = [];
        if (params.condition) parts.push(`AREA[Condition](${params.condition})`);
        if (params.sponsor) parts.push(`AREA[Sponsor](${params.sponsor})`);
        if (params.phase) parts.push(`AREA[Phase](${params.phase})`);
        if (params.query) parts.push(params.query);
        if (parts.length > 0) queryParams.append('query.term', parts.join(' AND '));
      }

      if (params.status && !queryParams.has('filter.overallStatus')) {
        queryParams.append('filter.overallStatus', params.status);
      }

      queryParams.append('pageSize', (params.pageSize || 50).toString());
      if (params.pageToken) queryParams.append('pageToken', params.pageToken);
      queryParams.append('sort', params.sort || 'LastUpdatePostDate:desc');
      queryParams.append('fields', 'NCTId,BriefTitle,OfficialTitle,OverallStatus,Phase,Condition,InterventionName,InterventionType,LeadSponsorName,CollaboratorName,StartDate,CompletionDate,EnrollmentCount,StudyType,LocationFacility,LocationCity,LocationCountry');

      const response = await fetch(`${BASE_URL_TRIALS}/studies?${queryParams.toString()}`);
      if (!response.ok) throw new Error(`ClinicalTrials.gov API error: ${response.statusText}`);

      const data = await response.json();
      const trials = (data.studies || []).map((study: any) => ({
        nctId: study.protocolSection?.identificationModule?.nctId || '',
        briefTitle: study.protocolSection?.identificationModule?.briefTitle || '',
        officialTitle: study.protocolSection?.identificationModule?.officialTitle,
        overallStatus: study.protocolSection?.statusModule?.overallStatus || '',
        phase: study.protocolSection?.designModule?.phases,
        conditions: study.protocolSection?.conditionsModule?.conditions,
        interventions: study.protocolSection?.armsInterventionsModule?.interventions?.map((i: any) => `${i.type}: ${i.name}`),
        sponsors: {
          lead: study.protocolSection?.sponsorCollaboratorsModule?.leadSponsor?.name,
          collaborators: study.protocolSection?.sponsorCollaboratorsModule?.collaborators?.map((c: any) => c.name)
        },
        startDate: study.protocolSection?.statusModule?.startDateStruct?.date,
        completionDate: study.protocolSection?.statusModule?.completionDateStruct?.date,
        enrollment: study.protocolSection?.designModule?.enrollmentInfo?.count,
        studyType: study.protocolSection?.designModule?.studyType,
        locations: study.protocolSection?.contactsLocationsModule?.locations?.map((loc: any) => ({
          facility: loc.facility,
          city: loc.city,
          country: loc.country
        }))
      }));

      return res.status(200).json({
        trials,
        nextPageToken: data.nextPageToken,
        totalCount: data.totalCount || trials.length
      });

    } else if (searchType === 'papers') {
      // PubMed Search
      const { query, maxResults, startDate, endDate, enhanceQuery = false }: PubMedSearchRequest = req.body;

      if (!query || query.trim().length === 0) {
        return res.status(400).json({ error: 'Query is required' });
      }

      let searchQuery = query;
      if (enhanceQuery) {
        searchQuery = await enhancePubMedQuery(query);
      }

      const now = Date.now();
      const timeSinceLastRequest = now - lastRequestTimePubMed;
      if (timeSinceLastRequest < RATE_LIMIT_DELAY_PUBMED) {
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY_PUBMED - timeSinceLastRequest));
      }
      lastRequestTimePubMed = Date.now();

      const BASE_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
      const API_KEY = process.env.PUBMED_API_KEY || '';
      const EMAIL = process.env.PUBMED_EMAIL || 'your-email@example.com';

      const searchParams = new URLSearchParams({
        db: 'pubmed',
        term: searchQuery,
        retmode: 'json',
        retmax: (maxResults || 20).toString(),
        sort: 'relevance'
      });

      if (API_KEY) searchParams.append('api_key', API_KEY);
      if (EMAIL) searchParams.append('email', EMAIL);

      const searchResponse = await fetch(`${BASE_URL}/esearch.fcgi?${searchParams.toString()}`);
      if (!searchResponse.ok) throw new Error(`PubMed API error: ${searchResponse.statusText}`);

      const searchData = await searchResponse.json();
      const pmids = searchData.esearchresult?.idlist || [];
      if (pmids.length === 0) {
        return res.status(200).json({ papers: [] });
      }

      const now2 = Date.now();
      const timeSinceLastRequest2 = now2 - lastRequestTimePubMed;
      if (timeSinceLastRequest2 < RATE_LIMIT_DELAY_PUBMED) {
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY_PUBMED - timeSinceLastRequest2));
      }
      lastRequestTimePubMed = Date.now();

      const fetchParams = new URLSearchParams({
        db: 'pubmed',
        id: pmids.join(','),
        retmode: 'xml'
      });

      if (API_KEY) fetchParams.append('api_key', API_KEY);
      if (EMAIL) fetchParams.append('email', EMAIL);

      const fetchResponse = await fetch(`${BASE_URL}/efetch.fcgi?${fetchParams.toString()}`);
      if (!fetchResponse.ok) throw new Error(`PubMed API error: ${fetchResponse.statusText}`);

      const xmlData = await fetchResponse.text();
      const papers = parseArticlesXML(xmlData);

      return res.status(200).json({ papers });

    } else if (searchType === 'press-releases') {
      // Press Releases Search
      const params: PressReleaseSearchParams = req.body;

      if (!params.query) {
        return res.status(400).json({ error: 'Query parameter is required' });
      }

      const newsApiKey = process.env.NEWS_API_KEY;
      if (!newsApiKey) {
        return res.status(500).json({ error: 'NEWS_API_KEY environment variable is required' });
      }

      const now = Date.now();
      const timeSinceLastRequest = now - lastRequestTimeNews;
      if (timeSinceLastRequest < RATE_LIMIT_DELAY_NEWS) {
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY_NEWS - timeSinceLastRequest));
      }
      lastRequestTimeNews = Date.now();

      let searchQuery = params.query;
      if (params.company) {
        searchQuery = `${params.company} ${searchQuery}`;
      }
      searchQuery += ' (press release OR announces OR reports)';

      const searchParams = new URLSearchParams({
        q: searchQuery,
        language: 'en',
        sortBy: 'relevancy',
        pageSize: Math.min(params.maxResults || 30, 100).toString()
      });

      const defaultStartDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      searchParams.append('from', params.startDate || defaultStartDate);
      searchParams.append('to', params.endDate || new Date().toISOString().split('T')[0]);

      const response = await fetch(`https://newsapi.org/v2/everything?${searchParams.toString()}`, {
        headers: { 'X-Api-Key': newsApiKey }
      });

      if (!response.ok) throw new Error(`NewsAPI error: ${response.statusText}`);

      const data = await response.json();
      if (data.status !== 'ok') throw new Error('NewsAPI returned error status');

      const pressReleases = data.articles
        .map((article: any) => transformToPressRelease(article, params.query))
        .sort((a: any, b: any) => b.relevanceScore - a.relevanceScore)
        .slice(0, params.maxResults || 30);

      return res.status(200).json({
        pressReleases,
        totalCount: data.totalResults
      });

    } else if (searchType === 'ir-decks') {
      // IR Decks Search via SEC EDGAR
      const params: IRDeckSearchParams = req.body;

      if (!params.query && !params.company) {
        return res.status(400).json({ error: 'Query or company parameter is required' });
      }

      const COMPANY_TICKER_MAP: Record<string, string> = {
        'eli lilly': '0000059478',
        'novo nordisk': '0001108134',
        'pfizer': '0000078003',
        'moderna': '0001682852',
        'biontech': '0001776985',
        'neumora therapeutics': '0001907249',
      };

      const getCIKFromCompany = (companyName: string): string | null => {
        const normalized = companyName.toLowerCase();
        if (COMPANY_TICKER_MAP[normalized]) return COMPANY_TICKER_MAP[normalized];
        for (const [key, cik] of Object.entries(COMPANY_TICKER_MAP)) {
          if (normalized.includes(key) || key.includes(normalized)) return cik;
        }
        return null;
      };

      const searchCompanyByCIK = async (cik: string): Promise<any> => {
        const now = Date.now();
        const timeSinceLastRequest = now - lastRequestTimeSEC;
        if (timeSinceLastRequest < RATE_LIMIT_DELAY_SEC) {
          await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY_SEC - timeSinceLastRequest));
        }
        lastRequestTimeSEC = Date.now();

        try {
          const paddedCik = cik.padStart(10, '0');
          const response = await fetch(`https://data.sec.gov/submissions/CIK${paddedCik}.json`, {
            headers: {
              'User-Agent': 'ABC Research abcresearch@example.com',
              'Accept': 'application/json'
            }
          });
          if (!response.ok) return null;
          return await response.json();
        } catch (error) {
          return null;
        }
      };

      const companyName = params.company || params.query;
      const cik = getCIKFromCompany(companyName);

      if (!cik) {
        return res.status(200).json({ irDecks: [], totalCount: 0 });
      }

      const companyData = await searchCompanyByCIK(cik);
      if (!companyData) {
        return res.status(200).json({ irDecks: [], totalCount: 0 });
      }

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

      const calculateScore = (filing: any): number => {
        let score = 50;
        if (filing.form === 'DEF 14A') score += 20;
        if (filing.form === '8-K') score += 15;
        if (filing.form === 'DEFA14A') score += 15;
        const daysSince = (Date.now() - new Date(filing.filingDate).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince <= 30) score += 20;
        else if (daysSince <= 90) score += 15;
        return Math.min(score, 100);
      };

      const irDecks = filings.map(filing => {
        const accessionNumber = filing.accessionNumber.replace(/-/g, '');
        return {
          id: `ir-${accessionNumber}`,
          company: companyData.name,
          ticker: companyData.tickers?.[0],
          title: `${filing.form} - ${filing.primaryDocDescription || 'SEC Filing'}`,
          filingType: filing.form,
          filingDate: filing.filingDate,
          reportDate: filing.reportDate || filing.filingDate,
          description: filing.items || filing.primaryDocDescription,
          url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=${filing.form}&dateb=&owner=exclude&count=1`,
          documentUrl: filing.primaryDocument ? `https://www.sec.gov/Archives/edgar/data/${cik}/${accessionNumber}/${filing.primaryDocument}` : undefined,
          relevanceScore: calculateScore(filing)
        };
      }).sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, maxResults);

      return res.status(200).json({ irDecks, totalCount: filings.length });

    } else {
      return res.status(400).json({ error: 'Invalid search type. Use: trials, papers, press-releases, or ir-decks' });
    }
  } catch (error) {
    console.error(`Error in ${searchType} search:`, error);
    return res.status(500).json({
      error: `Failed to search ${searchType}`,
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

