/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import * as cheerio from 'cheerio';
import puppeteerCore from 'puppeteer-core';
import puppeteerFull from 'puppeteer';
import chromium from '@sparticuz/chromium';
import axios, { AxiosRequestConfig } from 'axios';
import http from 'http';
import https from 'https';

// Detect if we're in a serverless/production environment
const isProduction = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;
const puppeteer = isProduction ? puppeteerCore : puppeteerFull;

// ============================================================================
// INTERFACES & CONSTANTS
// ============================================================================

interface RSSEntry {
  title: string;
  link: string;
  updated_dt: Date | null;
  created_dt: Date | null;
  isNew: boolean; // true if pubDate === dc:date (brand new study)
}

interface VersionPair {
  a: number;
  b: number;
}

const DEFAULT_HEADERS = {
  'User-Agent': 'ABCresearch-ctgov-monitor/1.0',
  'Accept': 'application/rss+xml, application/xml, text/xml, */*',
};

const BASE_STUDY_URL = 'https://clinicaltrials.gov/study/';
const BASE_API_URL = 'https://clinicaltrials.gov/api/v2';
const FETCH_TIMEOUT_MS = 8000; // 8 seconds (aggressive for serverless - socket level)
const MAX_RETRIES = 3; // Retry up to 3 times
const RETRY_DELAY_MS = 1000; // Start with 1 second delay

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Build RSS URL from parameters
 */
export function buildRssUrl(
  searchTerm?: string,
  locStr?: string,
  country?: string,
  dateField?: string
): string {
  const base = 'https://clinicaltrials.gov/api/rss';
  const params = new URLSearchParams();
  
  if (searchTerm) params.append('intr', searchTerm);
  if (locStr) params.append('locStr', locStr);
  if (country) params.append('country', country);
  params.append('dateField', dateField || 'LastUpdatePostDate');
  
  return `${base}?${params.toString()}`;
}

/**
 * Check if date is within the last N days
 */
export function isWithinDays(dt: Date | null, days: number): boolean {
  if (!dt) return false;
  const now = new Date();
  const diffMs = now.getTime() - dt.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays <= days;
}

/**
 * Extract NCT ID from link
 */
export function extractNctId(link: string): string | null {
  const match = link.match(/(NCT\d{8})/);
  return match ? match[1] : null;
}

/**
 * Build history URL for a study
 */
export function buildHistoryUrl(nctId: string, searchParams?: Record<string, string>): string {
  const params = new URLSearchParams(searchParams);
  params.append('tab', 'history');
  return `${BASE_STUDY_URL}${nctId}?${params.toString()}`;
}

/**
 * Build comparison URL for two versions
 */
export function buildComparisonUrl(
  nctId: string,
  a: number,
  b: number,
  searchParams?: Record<string, string>
): string {
  const params = new URLSearchParams(searchParams);
  params.append('tab', 'history');
  params.append('a', a.toString());
  params.append('b', b.toString());
  return `${BASE_STUDY_URL}${nctId}?${params.toString()}#version-content-panel`;
}

// ============================================================================
// CORE RSS FETCHING & PARSING
// ============================================================================

/**
 * Retry wrapper with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries: number = MAX_RETRIES,
  delayMs: number = RETRY_DELAY_MS,
  operationName: string = 'operation'
): Promise<T> {
  let lastError: Error | null = null;
  
  console.log(`🔄 Starting ${operationName} with up to ${retries} attempts`);
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    const attemptStartTime = Date.now();
    
    try {
      console.log(`⚡ [Attempt ${attempt}/${retries}] Starting ${operationName}...`);
      const result = await fn();
      const attemptDuration = Date.now() - attemptStartTime;
      console.log(`✅ [Attempt ${attempt}/${retries}] Succeeded in ${attemptDuration}ms`);
      return result;
    } catch (error: any) {
      const attemptDuration = Date.now() - attemptStartTime;
      lastError = error;
      
      console.error(`❌ [Attempt ${attempt}/${retries}] Failed after ${attemptDuration}ms`);
      console.error(`   Error name: ${error.name}`);
      console.error(`   Error message: ${error.message}`);
      
      if (attempt === retries) {
        console.error(`💀 All ${retries} attempts exhausted for ${operationName}`);
        throw error;
      }
      
      const delay = delayMs * Math.pow(2, attempt - 1); // Exponential backoff
      console.warn(`⏳ Waiting ${delay}ms before retry ${attempt + 1}/${retries}...`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      console.log(`🔄 Retry ${attempt + 1}/${retries} starting now...`);
    }
  }
  
  throw lastError || new Error(`Failed after ${retries} retries`);
}

/**
 * Fetch with axios + socket-level timeout (catches DNS/connection hangs)
 */
async function fetchWithAxios(
  url: string,
  headers: Record<string, string>,
  timeoutMs: number
): Promise<string> {
  console.log(`🏁 Starting axios request with socket timeout (${timeoutMs}ms)`);
  
  try {
    // Create HTTP/HTTPS agents with socket-level timeout
    const httpAgent = new http.Agent({
      timeout: timeoutMs, // Socket timeout
      keepAlive: false,
    });
    
    const httpsAgent = new https.Agent({
      timeout: timeoutMs, // Socket timeout
      keepAlive: false,
    });
    
    // Set up socket timeout handler
    const setupSocketTimeout = (agent: http.Agent | https.Agent) => {
      agent.on('socket', (socket) => {
        console.log(`🔌 Socket created, setting ${timeoutMs}ms timeout`);
        socket.setTimeout(timeoutMs);
        socket.on('timeout', () => {
          console.error(`⏰ SOCKET TIMEOUT after ${timeoutMs}ms`);
          socket.destroy();
        });
      });
    };
    
    setupSocketTimeout(httpAgent);
    setupSocketTimeout(httpsAgent);
    
    const config: AxiosRequestConfig = {
      method: 'GET',
      url: url,
      headers: {
        ...headers,
        'Connection': 'close', // Don't reuse connections
      },
      timeout: timeoutMs, // Request timeout (backup)
      validateStatus: (status) => status >= 200 && status < 300,
      maxRedirects: 5,
      responseType: 'text',
      httpAgent: httpAgent,
      httpsAgent: httpsAgent,
    };
    
    const startTime = Date.now();
    const response = await axios(config);
    const duration = Date.now() - startTime;
    
    console.log(`✅ Axios request completed in ${duration}ms, status: ${response.status}`);
    console.log(`   Content-Type: ${response.headers['content-type'] || 'N/A'}`);
    console.log(`   Content length: ${response.data?.length || 0} bytes`);
    
    if (!response.data || response.data.length === 0) {
      throw new Error('Response body is empty');
    }
    
    return response.data;
  } catch (error: any) {
    if (error.code === 'ECONNABORTED') {
      console.error(`⏰ Axios request timeout after ${timeoutMs}ms`);
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    if (error.code === 'ETIMEDOUT' || error.code === 'ESOCKETTIMEDOUT') {
      console.error(`⏰ Socket/Connection timeout: ${error.code}`);
      throw new Error(`Socket timeout after ${timeoutMs}ms`);
    }
    if (error.code === 'ECONNRESET') {
      console.error(`🔌 Connection reset by peer`);
      throw new Error(`Connection reset`);
    }
    if (error.response) {
      console.error(`❌ HTTP error: ${error.response.status} ${error.response.statusText}`);
      throw new Error(`HTTP ${error.response.status}: ${error.response.statusText}`);
    }
    console.error(`💥 Axios error: ${error.code || 'UNKNOWN'} - ${error.message}`);
    throw error;
  }
}

/**
 * Fetch sponsor information from ClinicalTrials.gov API (with retry + axios)
 */
export async function fetchSponsorInfo(nctId: string): Promise<string | null> {
  try {
    return await retryWithBackoff(async () => {
      const url = `${BASE_API_URL}/studies/${nctId}?fields=LeadSponsorName`;
      
      const response = await axios.get(url, {
        headers: DEFAULT_HEADERS,
        timeout: 10000, // 10 second timeout
        validateStatus: (status) => status >= 200 && status < 300,
      });
      
      const sponsor = response.data?.protocolSection?.sponsorCollaboratorsModule?.leadSponsor?.name;
      
      if (!sponsor) {
        console.warn(`⚠️  No sponsor found for ${nctId}`);
        return null;
      }
      
      return sponsor;
    }, 2, 500, `sponsor fetch for ${nctId}`); // 2 retries, 500ms delay
  } catch (error: any) {
    console.error(`❌ Failed to fetch sponsor for ${nctId}:`, error.message);
    return null;
  }
}

/**
 * Parse RSS feed and return entries (with retry logic + axios)
 */
export async function parseRssFeed(rssUrl: string): Promise<RSSEntry[]> {
  console.log(`📡 Starting RSS feed fetch with axios: ${rssUrl}`);
  
  return retryWithBackoff(async () => {
    const startTime = Date.now();
    
    console.log(`🌐 Initiating axios request...`);
    
    // Fetch with axios (has proven timeout handling)
    const xmlText = await fetchWithAxios(
      rssUrl,
      DEFAULT_HEADERS,
      FETCH_TIMEOUT_MS
    );
    
    const fetchDuration = Date.now() - startTime;
    console.log(`✅ Axios fetch completed in ${fetchDuration}ms`);
    console.log(`   Response size: ${(xmlText.length / 1024).toFixed(2)} KB`);
    
    // Parse XML with cheerio
    console.log(`🔍 Parsing XML...`);
    const parseStartTime = Date.now();
    
    const $ = cheerio.load(xmlText, { xmlMode: true });
    
    // Detect RSS format
    const isRss2 = $('rss').length > 0;
    const isAtom = $('feed').length > 0;
    
    if (!isRss2 && !isAtom) {
      console.warn('⚠️  Unknown RSS/Atom format, attempting to parse anyway');
    }
    
    const entries: RSSEntry[] = [];
    const itemSelector = isRss2 ? 'item' : isAtom ? 'entry' : 'item, entry';
    
    $(itemSelector).each((_, item) => {
      const title = $(item).find('title').text();
      const link = $(item).find('link').text() || $(item).find('link').attr('href') || '';
      const pubDate = $(item).find('pubDate').text() || $(item).find('updated').text();
      const dcDate = $(item).find('dc\\:date').text(); // dc:date namespace
      
      let updated_dt: Date | null = null;
      let created_dt: Date | null = null;
      
      if (pubDate) {
        try {
          updated_dt = new Date(pubDate);
        } catch (e) {
          console.error('Failed to parse pubDate:', pubDate);
        }
      }
      
      if (dcDate) {
        try {
          created_dt = new Date(dcDate);
        } catch (e) {
          console.error('Failed to parse dc:date:', dcDate);
        }
      }
      
      // Study is brand new if pubDate === dc:date (same timestamp within 1 second)
      const isNew = !!(updated_dt && created_dt && 
        Math.abs(updated_dt.getTime() - created_dt.getTime()) < 1000);
      
      entries.push({ title, link, updated_dt, created_dt, isNew });
    });
    
    const parseDuration = Date.now() - parseStartTime;
    const totalDuration = Date.now() - startTime;
    
    const newCount = entries.filter(e => e.isNew).length;
    const updatedCount = entries.length - newCount;
    
    console.log(`✅ Parsed ${entries.length} entries (${newCount} new, ${updatedCount} updated) in ${parseDuration}ms`);
    console.log(`📊 Total time: ${totalDuration}ms (fetch+read: ${fetchDuration}ms, parse: ${parseDuration}ms)`);
    
    if (entries.length === 0) {
      console.warn('⚠️  RSS feed contains 0 entries - feed may be empty or format unrecognized');
    }
    
    return entries;
  }, MAX_RETRIES, RETRY_DELAY_MS, 'RSS feed fetch');
}

// ============================================================================
// PUPPETEER OPERATIONS (Version Scraping & Diff Extraction)
// ============================================================================

/**
 * Launch Puppeteer browser with appropriate configuration for environment
 */
async function launchBrowser() {
  if (isProduction) {
    return await puppeteer.launch({
      args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: { width: 1280, height: 720 },
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  } else {
    return await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: { width: 1280, height: 720 },
    });
  }
}

/**
 * Parse latest two versions using Playwright and LLM
 */
export async function parseLatestTwoVersions(
  historyUrl: string,
  geminiApiKey?: string
): Promise<VersionPair | null> {
  let browser;
  try {
    console.log(`🎭 Scraping version history: ${historyUrl}`);
    
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setUserAgent(DEFAULT_HEADERS['User-Agent']);
    
    // Navigate and wait for content
    await page.goto(historyUrl, { waitUntil: 'networkidle0', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const pageText = await page.evaluate(() => document.body.innerText);
    await browser.close();
    browser = undefined;
    
    console.log(`✅ Extracted ${pageText.length} characters from history page`);
    
    // If no Gemini API key, fall back to simple regex parsing
    if (!geminiApiKey) {
      console.log('Using fallback regex parsing (no Gemini API key)');
      const versionMatches = pageText.match(/\b(\d+)\b/g);
      if (!versionMatches || versionMatches.length < 2) {
        return null;
      }
      const versions = versionMatches.map(v => parseInt(v, 10)).filter(v => v > 0 && v < 1000);
      const lastTwo = versions.slice(-2);
      return { a: lastTwo[0], b: lastTwo[1] };
    }
    
    // Use Gemini to extract version numbers
    console.log('🤖 Using Gemini to extract version numbers');
    
    const prompt = `You are analyzing a ClinicalTrials.gov study history page. Find ALL version numbers and return ONLY the last two (most recent).

Page text:
${pageText.substring(0, 20000)}

Instructions:
1. Look for version numbers (sequential integers like 1, 2, 3, etc.)
2. Identify the COMPLETE list of version numbers
3. Return ONLY the last two in this EXACT format:
   PREVIOUS: X
   LATEST: Y

Example: If versions are [1, 2, 3, 4, 5], respond with:
PREVIOUS: 4
LATEST: 5

Respond now with ONLY those two lines.`;

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${geminiApiKey}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 100 },
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000,
        validateStatus: (status) => status >= 200 && status < 300,
      }
    );

    const data = response.data;
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    const prevMatch = content.match(/PREVIOUS:\s*(\d+)/i);
    const latestMatch = content.match(/LATEST:\s*(\d+)/i);
    
    if (!prevMatch || !latestMatch) {
      console.log('Could not parse version numbers from LLM response');
      return null;
    }
    
    const result = {
      a: parseInt(prevMatch[1], 10),
      b: parseInt(latestMatch[1], 10),
    };
    
    console.log(`✅ Versions found: ${result.a} → ${result.b}`);
    return result;
  } catch (error) {
    console.error('Failed to parse versions:', error);
    if (browser) {
      await browser.close();
    }
    return null;
  }
}

/**
 * Extract comparison content using Playwright (renders JavaScript)
 */
export async function extractDiffBlocks(comparisonUrl: string): Promise<string[]> {
  let browser;
  try {
    console.log(`🎭 Scraping comparison page: ${comparisonUrl}`);
    
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setUserAgent(DEFAULT_HEADERS['User-Agent']);
    
    // Navigate and wait for content
    await page.goto(comparisonUrl, { waitUntil: 'networkidle0', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const fullHtml = await page.content();
    await browser.close();
    browser = undefined;
    
    console.log(`✅ Extracted ${fullHtml.length} characters of comparison HTML`);
    
    const hasInsertions = fullHtml.includes('<ins>');
    const hasDeletions = fullHtml.includes('<del>');
    
    if (!hasInsertions && !hasDeletions) {
      console.warn('Warning: No diff markers found in comparison HTML');
    }
    
    return [fullHtml];
  } catch (error) {
    console.error('Failed to extract comparison:', error);
    if (browser) {
      await browser.close();
    }
    return ['Error extracting comparison content'];
  }
}

// ============================================================================
// LLM SUMMARIES
// ============================================================================

/**
 * Generate LLM summary for a new study (no version comparison)
 */
export async function generateNewStudySummary(
  nctId: string,
  title: string,
  geminiApiKey: string
): Promise<string> {
  try {
    const prompt = `You are a clinical trial summarizer. Provide a brief 2-3 sentence summary of this new clinical trial.

Focus on:
- What condition/disease is being studied
- What intervention/treatment is being tested
- Any other key details from the title

TRIAL: ${nctId} – ${title}

Provide a clear, concise summary (2-3 sentences max).`;

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${geminiApiKey}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 200 },
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000,
        validateStatus: (status) => status >= 200 && status < 300,
      }
    );

    const content = response.data.candidates?.[0]?.content?.parts?.[0]?.text;

    return content?.trim() || `New clinical trial: ${title}`;
  } catch (error) {
    console.error('Failed to generate new study summary:', error);
    return `New clinical trial ${nctId}. View study URL for details.`;
  }
}

/**
 * Generate LLM summary of changes using Gemini API
 */
export async function generateChangeSummary(
  nctId: string,
  title: string,
  diffs: string[],
  geminiApiKey: string
): Promise<string> {
  try {
    const comparisonHtml = diffs[0] || '';
    
    const prompt = `You are a clinical trial change summarizer. Analyze the HTML from ClinicalTrials.gov's version comparison page.

Diff markers:
- <ins> tags or underlined text = ADDED content (new in latest version)
- <del> tags or strikethrough text = REMOVED content (deleted from previous version)

ALWAYS include original and updated values. Example: "Enrollment increased from 100 to 200."

Focus on substantive changes:
- Enrollment numbers
- Study status (recruiting, active, completed, terminated)
- Study phase
- Primary/secondary outcomes
- Inclusion/exclusion criteria
- Study locations
- Intervention details (drugs, dosages)
- Study dates

TRIAL: ${nctId} – ${title}

VERSION COMPARISON HTML:
${comparisonHtml.substring(0, 15000)}

Provide a brief, clear summary (2-3 sentences max). Ignore minor formatting changes.`;

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${geminiApiKey}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 250 },
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000,
        validateStatus: (status) => status >= 200 && status < 300,
      }
    );

    const content = response.data.candidates?.[0]?.content?.parts?.[0]?.text;

    return content?.trim() || `Changes detected for ${nctId}`;
  } catch (error) {
    console.error('Failed to generate change summary:', error);
    return `Changes detected for ${nctId}. View comparison URL for details.`;
  }
}
