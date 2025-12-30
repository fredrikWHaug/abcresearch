/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import * as cheerio from 'cheerio';
import puppeteerCore from 'puppeteer-core';
import puppeteerFull from 'puppeteer';
import chromium from '@sparticuz/chromium';
import axios, { AxiosRequestConfig } from 'axios';
import http from 'http';
import https from 'https';
import { promises as fs } from 'fs';
import path from 'path';

// Detect if we're in a serverless/production environment
const isProduction = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;
const puppeteer = isProduction ? puppeteerCore : puppeteerFull;

// ============================================================================
// INTERFACES & CONSTANTS
// ============================================================================

// Global map to track active feed processing operations for cancellation
const activeFeedProcessing = new Map<number, AbortController>();

/**
 * Register a feed processing operation so it can be cancelled
 */
export function registerFeedProcessing(feedId: number): AbortController {
  const controller = new AbortController();
  activeFeedProcessing.set(feedId, controller);
  console.log(`[CANCELLATION] Registered feed ${feedId} for processing`);
  return controller;
}

/**
 * Cancel an active feed processing operation
 */
export function cancelFeedProcessing(feedId: number): boolean {
  const controller = activeFeedProcessing.get(feedId);
  if (controller) {
    console.log(`[CANCELLATION] Aborting processing for feed ${feedId}`);
    controller.abort();
    activeFeedProcessing.delete(feedId);
    return true;
  }
  console.log(`[CANCELLATION] No active processing found for feed ${feedId}`);
  return false;
}

/**
 * Unregister a feed processing operation (called when complete or error)
 * This only removes it from the active processing tracking map - the feed itself remains in the database
 */
export function unregisterFeedProcessing(feedId: number): void {
  activeFeedProcessing.delete(feedId);
  console.log(`[CANCELLATION] Processing complete for feed ${feedId} - removed from active tracking`);
}

/**
 * Get all currently active feed processing operations
 */
export function getActiveFeedProcessing(): number[] {
  return Array.from(activeFeedProcessing.keys());
}

/**
 * Cancel all active feed processing operations
 */
export function cancelAllFeedProcessing(): { cancelled: number[]; count: number } {
  const feedIds = Array.from(activeFeedProcessing.keys());
  console.log(`[CANCELLATION] Cancelling all active processing: ${feedIds.length} feeds`);
  
  feedIds.forEach((feedId) => {
    const controller = activeFeedProcessing.get(feedId);
    if (controller) {
      console.log(`[CANCELLATION] Aborting feed ${feedId}`);
      controller.abort();
    }
  });
  
  activeFeedProcessing.clear();
  
  return {
    cancelled: feedIds,
    count: feedIds.length,
  };
}

/**
 * Check if processing should be cancelled
 */
function checkCancellation(signal?: AbortSignal, feedId?: number): void {
  if (signal?.aborted) {
    const message = `Processing cancelled for feed ${feedId || 'unknown'}`;
    console.log(`[CANCELLATION] ${message}`);
    throw new Error(message);
  }
}

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
const FETCH_TIMEOUT_MS = 20000; // 20 seconds (government servers can be slow)
const MAX_RETRIES = 2; // Retry twice (3 total attempts)
const RETRY_DELAY_MS = 2000; // Start with 2 second delay between retries

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
 * Fetch with axios + AbortController for reliable timeout handling
 * Uses Promise.race to ensure absolute timeout even if all other mechanisms fail
 */
async function fetchWithAxios(
  url: string,
  headers: Record<string, string>,
  timeoutMs: number
): Promise<string> {
  console.log(`🏁 Using native HTTPS with ${timeoutMs}ms timeout`);
  console.log(`📡 [${new Date().toISOString()}] URL: ${url}`);
  
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    let completed = false;
    let timeoutHandle: NodeJS.Timeout | null = null;
    
    // Absolute master timeout that WILL fire
    timeoutHandle = setTimeout(() => {
      if (completed) return;
      completed = true;
      
      const elapsed = Date.now() - startTime;
      console.error(`⏰ MASTER TIMEOUT fired after ${elapsed}ms`);
      reject(new Error(`Request timeout after ${timeoutMs}ms`));
    }, timeoutMs);
    
    try {
      const urlObj = new URL(url);
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: {
          ...headers,
          'Connection': 'close',
        },
        timeout: Math.floor(timeoutMs * 0.8), // Socket timeout at 80%
      };
      
      console.log(`🔌 Connecting to ${options.hostname}:${options.port}${options.path}`);
      
      const req = https.request(options, (res) => {
        if (completed) {
          console.log(`⚠️  Response received after completion flag set`);
          return;
        }
        
        console.log(`📥 HTTP ${res.statusCode} - receiving data...`);
        
        if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
          if (timeoutHandle) clearTimeout(timeoutHandle);
          completed = true;
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          return;
        }
        
        const chunks: Buffer[] = [];
        
        res.on('data', (chunk) => {
          if (completed) return;
          chunks.push(chunk);
        });
        
        res.on('end', () => {
          if (completed) return;
          if (timeoutHandle) clearTimeout(timeoutHandle);
          completed = true;
          
          const data = Buffer.concat(chunks).toString('utf8');
          const elapsed = Date.now() - startTime;
          
          console.log(`✅ Success in ${elapsed}ms (${(data.length / 1024).toFixed(2)} KB)`);
          
          if (!data || data.length === 0) {
            reject(new Error('Empty response body'));
          } else {
            resolve(data);
          }
        });
        
        res.on('error', (err) => {
          if (completed) return;
          if (timeoutHandle) clearTimeout(timeoutHandle);
          completed = true;
          console.error(`❌ Response error: ${err.message}`);
          reject(err);
        });
      });
      
      req.on('timeout', () => {
        if (completed) return;
        if (timeoutHandle) clearTimeout(timeoutHandle);
        completed = true;
        
        console.error(`⏰ Socket timeout`);
        req.destroy();
        reject(new Error(`Socket timeout after ${timeoutMs}ms`));
      });
      
      req.on('error', (err: any) => {
        if (completed) return;
        if (timeoutHandle) clearTimeout(timeoutHandle);
        completed = true;
        
        const elapsed = Date.now() - startTime;
        console.error(`❌ Request error after ${elapsed}ms: ${err.code} - ${err.message}`);
        
        if (err.code === 'ETIMEDOUT' || err.code === 'ESOCKETTIMEDOUT') {
          reject(new Error(`Timeout after ${timeoutMs}ms`));
        } else if (err.code === 'ECONNRESET') {
          reject(new Error('Connection reset'));
        } else if (err.code === 'ENOTFOUND') {
          reject(new Error('DNS lookup failed'));
        } else {
          reject(err);
        }
      });
      
      req.end();
      
    } catch (error: any) {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      if (completed) return;
      completed = true;
      
      console.error(`❌ Setup error: ${error.message}`);
      reject(error);
    }
  });
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
 * Parse RSS feed and return entries (with retry logic + timeout)
 */
export async function parseRssFeed(rssUrl: string): Promise<RSSEntry[]> {
  console.log(`📡 Starting RSS feed fetch: ${rssUrl}`);
  console.log(`   Timeout: ${FETCH_TIMEOUT_MS}ms per attempt, Retries: ${MAX_RETRIES}`);
  console.log(`   Maximum total time: ${FETCH_TIMEOUT_MS * MAX_RETRIES}ms`);
  
  // Absolute timeout for the entire operation (all retries)
  const absoluteTimeoutMs = FETCH_TIMEOUT_MS * MAX_RETRIES + 5000; // Extra 5s buffer
  
  const fetchPromise = retryWithBackoff(async () => {
    const startTime = Date.now();
    
    console.log(`🌐 [${new Date().toISOString()}] Initiating fetch request...`);
    
    // Fetch with axios (has proven timeout handling)
    const xmlText = await fetchWithAxios(
      rssUrl,
      DEFAULT_HEADERS,
      FETCH_TIMEOUT_MS
    );
    
    const fetchDuration = Date.now() - startTime;
    console.log(`✅ Fetch completed in ${fetchDuration}ms (${(fetchDuration / 1000).toFixed(1)}s)`);
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
  
  // Absolute timeout wrapper - if retries hang, this will kill it
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      console.error(`⏰ ABSOLUTE TIMEOUT for parseRssFeed after ${absoluteTimeoutMs}ms`);
      console.error(`   This means all ${MAX_RETRIES} retry attempts failed to complete`);
      reject(new Error(`RSS feed fetch timeout after ${absoluteTimeoutMs}ms (${MAX_RETRIES} retries)`));
    }, absoluteTimeoutMs);
  });
  
  // Race between fetch+retries and absolute timeout
  return Promise.race([fetchPromise, timeoutPromise]);
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
    const response = await page.goto(historyUrl, { waitUntil: 'networkidle0', timeout: 30000 });
    
    // Check if page loaded successfully
    if (!response || response.status() !== 200) {
      console.error(`❌ Failed to load history page: HTTP ${response?.status()}`);
      await browser.close();
      return null;
    }
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    
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

    const geminiResponse = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${geminiApiKey}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 100 },
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000,
        validateStatus: (status) => status >= 200 && status < 300,
      }
    );

    const data = geminiResponse.data;
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    console.log(`🤖 Gemini response: ${content}`);
    
    const prevMatch = content.match(/PREVIOUS:\s*(\d+)/i);
    const latestMatch = content.match(/LATEST:\s*(\d+)/i);
    
    if (!prevMatch || !latestMatch) {
      console.error(`❌ Could not parse version numbers from Gemini response: "${content}"`);
      console.log('⚠️  Attempting regex fallback...');
      
      // Fallback to regex parsing
      const versionMatches = pageText.match(/\b(\d+)\b/g);
      if (!versionMatches || versionMatches.length < 2) {
        console.error('❌ Regex fallback also failed - no version numbers found');
        return null;
      }
      const versions = versionMatches.map(v => parseInt(v, 10)).filter(v => v > 0 && v < 1000);
      if (versions.length < 2) {
        console.error(`❌ Only found ${versions.length} valid version numbers`);
        return null;
      }
      const lastTwo = versions.slice(-2);
      console.log(`✅ Regex fallback found versions: ${lastTwo[0]} → ${lastTwo[1]}`);
      return { a: lastTwo[0], b: lastTwo[1] };
    }
    
    const result = {
      a: parseInt(prevMatch[1], 10),
      b: parseInt(latestMatch[1], 10),
    };
    
    console.log(`✅ Versions found: ${result.a} → ${result.b}`);
    return result;
  } catch (error: any) {
    console.error(`❌ Failed to parse versions: ${error.message}`);
    console.error(`   Stack: ${error.stack}`);
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
    const response = await page.goto(comparisonUrl, { waitUntil: 'networkidle0', timeout: 30000 });
    
    // Check if page loaded successfully
    if (!response || response.status() !== 200) {
      console.error(`❌ Failed to load comparison page: HTTP ${response?.status()}`);
      await browser.close();
      return [`Error: HTTP ${response?.status()} when loading comparison page`];
    }
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Extract comparison content starting from Study Details section
    const extractionResult = await page.evaluate(() => {
      // Find the Study Details section
      const studyDetailsCard = document.querySelector('#study-details-card, ctg-section-title-card[title="Study Details"]');
      
      let comparisonDiv: Element | null = null;
      let selectorUsed = '';
      
      if (studyDetailsCard && studyDetailsCard.nextElementSibling) {
        // Get the parent container that holds all sections after Study Details
        const parent = studyDetailsCard.parentElement;
        if (parent) {
          // Clone the parent to manipulate it
          const clonedParent = parent.cloneNode(true) as Element;
          
          // Remove everything before Study Details section
          const clonedStudyDetails = clonedParent.querySelector('#study-details-card, ctg-section-title-card[title="Study Details"]');
          if (clonedStudyDetails) {
            let sibling = clonedParent.firstChild;
            while (sibling && sibling !== clonedStudyDetails) {
              const nextSibling = sibling.nextSibling;
              clonedParent.removeChild(sibling);
              sibling = nextSibling;
            }
          }
          
          comparisonDiv = clonedParent;
          selectorUsed = 'Study Details section onwards';
        }
      }
      
      // Fallback: try to find the version comparison container
      if (!comparisonDiv) {
        comparisonDiv = document.querySelector('ctg-study-versions-compare');
        if (comparisonDiv) {
          selectorUsed = 'ctg-study-versions-compare';
        }
      }
      
      // Final fallback: use entire body
      if (!comparisonDiv) {
        comparisonDiv = document.body;
        selectorUsed = 'body (fallback)';
      }
      
      const html = comparisonDiv.outerHTML;
      const text = (comparisonDiv as HTMLElement).innerText || comparisonDiv.textContent || '';
      
      return {
        html,
        text,
        selectorUsed,
        foundDiv: selectorUsed.includes('Study Details')
      };
    });
    
    await browser.close();
    browser = undefined;
    
    console.log(`✅ Extracted comparison content using selector: "${extractionResult.selectorUsed}"`);
    console.log(`   HTML length: ${extractionResult.html.length} characters`);
    
    const fullHtml = extractionResult.html;
    const hasRemovals = fullHtml.includes('ctg-diff-removed');
    const hasAdditions = fullHtml.includes('ctg-diff-added');
    
    console.log(`🔍 Diff markers found: ctg-diff-removed=${hasRemovals}, ctg-diff-added=${hasAdditions}`);
    
    if (!hasRemovals && !hasAdditions) {
      console.warn('⚠️  Warning: No diff markers (ctg-diff-removed/ctg-diff-added) found in comparison HTML');
      console.log(`📄 Full text content (first 2000 chars for debugging):`);
      console.log(extractionResult.text.substring(0, 2000));
    } else {
      // Log sample of diff content
      const firstRemoved = fullHtml.indexOf('ctg-diff-removed');
      const firstAdded = fullHtml.indexOf('ctg-diff-added');
      if (firstRemoved > -1) {
        console.log(`📝 Sample removal: ${fullHtml.substring(firstRemoved, firstRemoved + 300)}`);
      }
      if (firstAdded > -1) {
        console.log(`📝 Sample addition: ${fullHtml.substring(firstAdded, firstAdded + 300)}`);
      }
    }
    
    return [fullHtml];
  } catch (error: any) {
    console.error(`❌ Failed to extract comparison: ${error.message}`);
    console.error(`   Stack: ${error.stack}`);
    if (browser) {
      await browser.close();
    }
    return ['Error extracting comparison content'];
  }
}

// ============================================================================
// FEED PROCESSING - SHARED LOGIC
// ============================================================================

interface ProcessedEntry {
  nctId: string;
  entry: RSSEntry;
  studyUrl: string;
  historyUrl: string;
  comparisonUrl: string;
  versionA: number;
  versionB: number;
  diffBlocks: string[];
  summary: string;
  sponsor: string | null;
}

/**
 * Process a single RSS entry - fetch sponsor, generate summary, etc.
 */
export async function processSingleEntry(
  entry: RSSEntry,
  geminiApiKey: string
): Promise<ProcessedEntry> {
  const nctId = extractNctId(entry.link);
  if (!nctId) throw new Error('No NCT ID found');

  const studyUrl = `https://clinicaltrials.gov/study/${nctId}`;
  let summary: string;
  let historyUrl: string;
  let comparisonUrl: string;
  let versionA: number;
  let versionB: number;
  let diffBlocks: string[];
  let sponsor: string | null;

  // Handle brand new studies differently
  if (entry.isNew) {
    console.log(`${nctId} is a NEW study - generating summary`);
    // Parallelize sponsor fetch and summary generation
    [sponsor, summary] = await Promise.all([
      fetchSponsorInfo(nctId),
      generateNewStudySummary(nctId, entry.title, geminiApiKey),
    ]);
    historyUrl = buildHistoryUrl(nctId);
    comparisonUrl = '';
    versionA = 1;
    versionB = 1;
    diffBlocks = ['NEW_STUDY'];
  } else {
    console.log(`${nctId} is an UPDATED study - comparing versions`);
    historyUrl = buildHistoryUrl(nctId);
    
    // Start sponsor fetch in parallel with version parsing
    const sponsorPromise = fetchSponsorInfo(nctId);
    const versionPair = await parseLatestTwoVersions(historyUrl, geminiApiKey);

    if (!versionPair) {
      console.error(`❌ ${nctId}: Failed to extract version numbers from history page`);
      console.error(`   History URL: ${historyUrl}`);
      console.error(`   This could mean:`);
      console.error(`   - Study is too new and history page isn't populated yet`);
      console.error(`   - Page structure has changed`);
      console.error(`   - Network/Puppeteer error occurred`);
      throw new Error(`No version pair found for ${nctId} - check logs for details`);
    }

    comparisonUrl = buildComparisonUrl(nctId, versionPair.a, versionPair.b);
    
    // Parallelize diff extraction and sponsor fetch completion
    [diffBlocks, sponsor] = await Promise.all([
      extractDiffBlocks(comparisonUrl),
      sponsorPromise,
    ]);
    
    summary = await generateChangeSummary(nctId, entry.title, diffBlocks, geminiApiKey);
    versionA = versionPair.a;
    versionB = versionPair.b;
  }

  return {
    nctId,
    entry,
    studyUrl,
    historyUrl,
    comparisonUrl,
    versionA,
    versionB,
    diffBlocks,
    summary,
    sponsor,
  };
}

/**
 * Process entries in batches with parallel execution
 */
export async function processEntriesInBatches(
  entries: RSSEntry[],
  geminiApiKey: string,
  batchSize: number = 5,
  signal?: AbortSignal,
  feedId?: number
): Promise<ProcessedEntry[]> {
  const results: ProcessedEntry[] = [];
  
  for (let i = 0; i < entries.length; i += batchSize) {
    // Check for cancellation before each batch
    checkCancellation(signal, feedId);
    
    const batch = entries.slice(i, i + batchSize);
    console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(entries.length / batchSize)} (${batch.length} studies)`);

    // Process batch in parallel
    const batchResults = await Promise.allSettled(
      batch.map((entry) => processSingleEntry(entry, geminiApiKey))
    );

    // Check for cancellation after batch completes
    checkCancellation(signal, feedId);

    // Collect successful results
    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
        console.log(`✅ Processed ${result.value.entry.isNew ? 'NEW' : 'updated'} study ${result.value.nctId}`);
      } else {
        console.error(`❌ Failed to process study:`, result.reason);
      }
    }

    // Small delay between batches (with cancellation check)
    if (i + batchSize < entries.length) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      checkCancellation(signal, feedId);
    }
  }

  return results;
}

/**
 * Process all updates for a feed (high-level orchestration)
 */
export async function processFeedUpdates(
  feedId: number,
  feedUrl: string,
  geminiApiKey: string,
  supabaseClient: any,
  enableProgressTracking: boolean = false,
  signal?: AbortSignal
): Promise<{
  newUpdates: number;
  processedItems: number;
  totalItems: number;
  updates: Array<{
    nctId: string;
    title: string;
    isNew: boolean;
    summary: string;
    studyUrl: string;
    historyUrl: string;
    comparisonUrl: string | null;
    versionA: number;
    versionB: number;
    lastUpdate: string;
  }>;
  hasMoreEntries: boolean;
  remainingEntries: number;
}> {
  console.log(`[PROCESS_FEED] Starting for feed ${feedId}: ${feedUrl}`);
  
  try {
    // Check if cancelled before starting
    checkCancellation(signal, feedId);
    
    // Step 1: Parse RSS feed
    console.log(`[PROCESS_FEED] Step 1: Parsing RSS feed...`);
    const entries = await parseRssFeed(feedUrl);
    
    // Check if cancelled after RSS parse (can take a while)
    checkCancellation(signal, feedId);
    
    const recentEntries = entries.filter((e) => isWithinDays(e.updated_dt, 14));
    
    // Process only 3 entries per API call to stay well within 30s timeout
    // Each API call gets its own 30s window - frontend chains multiple calls automatically
    const ENTRIES_PER_BATCH = 3;
    const MAX_ENTRIES_TO_CHECK = 10; // Only check the 10 most recent entries
    
    // First, filter out already-processed entries from the top 10 recent entries
    console.log(`[PROCESS_FEED] Step 2: Checking which of the ${Math.min(recentEntries.length, MAX_ENTRIES_TO_CHECK)} most recent entries need processing...`);
    const unprocessedEntries: typeof recentEntries = [];
    let alreadyProcessedCount = 0;
    
    for (const entry of recentEntries.slice(0, MAX_ENTRIES_TO_CHECK)) {
      // Check for cancellation periodically
      checkCancellation(signal, feedId);
      
      const nctId = extractNctId(entry.link);
      if (!nctId) {
        alreadyProcessedCount++;
        continue;
      }

      // Check if we already have this update
      const { data: existing } = await supabaseClient
        .from('trial_updates')
        .select('id')
        .eq('feed_id', feedId)
        .eq('nct_id', nctId)
        .gte('last_update', entry.updated_dt?.toISOString() || new Date().toISOString())
        .single();

      if (existing) {
        console.log(`Skipping ${nctId} - already processed`);
        alreadyProcessedCount++;
      } else {
        unprocessedEntries.push(entry);
      }
    }
    
    // Now take only the first ENTRIES_PER_BATCH unprocessed entries for this API call
    const entriesToProcess = unprocessedEntries.slice(0, ENTRIES_PER_BATCH);
    const hasMoreEntries = unprocessedEntries.length > ENTRIES_PER_BATCH;
    const remainingAfterThisBatch = unprocessedEntries.length - ENTRIES_PER_BATCH;
    
    console.log(`[PROCESS_FEED] Found ${unprocessedEntries.length} unprocessed entries, processing ${entriesToProcess.length} in this batch`);
    if (hasMoreEntries) {
      console.log(`[PROCESS_FEED] ⚠️  ${remainingAfterThisBatch} more unprocessed entries - will process in next API call`);
    }

    let processedItems = 0;  // Will be incremented as we save each entry
    const totalItemsToProcess = entriesToProcess.length;
    
    // Initialize progress tracking now that we know the total
    if (enableProgressTracking) {
      try {
        await supabaseClient
          .from('watched_feeds')
          .update({
            refresh_status: {
              total: totalItemsToProcess,
              processed: processedItems,
              in_progress: true,
              started_at: new Date().toISOString(),
            },
          })
          .eq('id', feedId);
        console.log(`[PROCESS_FEED] Progress tracking initialized: ${totalItemsToProcess} items to process`);
      } catch (error: any) {
        if (error?.message?.includes('does not exist') || error?.code === '42703') {
          console.warn('[PROCESS_FEED] refresh_status column not found, skipping progress tracking');
        } else {
          throw error;
        }
      }
    }
    
    // Check for cancellation before heavy processing
    checkCancellation(signal, feedId);

    // Step 4: Process entries in batches (smaller batches to avoid timeout)
    console.log(`[PROCESS_FEED] Step 3: Processing entries in batches...`);
    const processedEntries = await processEntriesInBatches(entriesToProcess, geminiApiKey, 3, signal, feedId);
    
    // Step 5: Save results to database
    console.log(`[PROCESS_FEED] Step 4: Saving ${processedEntries.length} results to database...`);
    let newUpdates = 0;
    const updates: Array<{
      nctId: string;
      title: string;
      isNew: boolean;
      summary: string;
      studyUrl: string;
      historyUrl: string;
      comparisonUrl: string | null;
      versionA: number;
      versionB: number;
      lastUpdate: string;
    }> = [];
    
    for (const data of processedEntries) {
      // Check for cancellation before each database write
      checkCancellation(signal, feedId);
      
      const { error: insertError } = await supabaseClient.from('trial_updates').insert({
        feed_id: feedId,
        nct_id: data.nctId,
        title: data.entry.title,
        last_update: data.entry.updated_dt?.toISOString() || new Date().toISOString(),
        study_url: data.studyUrl,
        history_url: data.historyUrl,
        comparison_url: data.comparisonUrl || null,
        version_a: data.versionA,
        version_b: data.versionB,
        raw_diff_blocks: data.diffBlocks,
        llm_summary: data.summary,
        sponsor: data.sponsor || null,
      });

      if (insertError) {
        console.error(`Failed to insert update for ${data.nctId}:`, insertError);
      } else {
        newUpdates++;
        console.log(`✅ Saved ${data.entry.isNew ? 'NEW' : 'updated'} study ${data.nctId}`);
        
        // Add to updates array for email notifications
        updates.push({
          nctId: data.nctId,
          title: data.entry.title,
          isNew: data.entry.isNew,
          summary: data.summary,
          studyUrl: data.studyUrl,
          historyUrl: data.historyUrl,
          comparisonUrl: data.comparisonUrl || null,
          versionA: data.versionA,
          versionB: data.versionB,
          lastUpdate: data.entry.updated_dt?.toISOString() || new Date().toISOString(),
        });
      }
      
      processedItems++;
      
      // Update progress after each save (if enabled)
      if (enableProgressTracking) {
        try {
          await supabaseClient
            .from('watched_feeds')
            .update({
              refresh_status: {
                total: totalItemsToProcess,
                processed: processedItems,
                in_progress: true,
                new_updates: newUpdates,
              },
            })
            .eq('id', feedId);
        } catch (err: any) {
          if (!err?.message?.includes('does not exist') && err?.code !== '42703') {
            console.error('[PROCESS_FEED] Failed to update progress:', err);
          }
        }
      }
    }

    // Step 6: Mark refresh as complete
    console.log(`[PROCESS_FEED] Step 5: Marking feed as complete...`);
    if (enableProgressTracking) {
      try {
        await supabaseClient
          .from('watched_feeds')
          .update({
            last_checked_at: new Date().toISOString(),
            refresh_status: {
              total: totalItemsToProcess,
              processed: processedItems,
              in_progress: false,
              completed_at: new Date().toISOString(),
              new_updates: newUpdates,
              has_more: hasMoreEntries,
              remaining: hasMoreEntries ? remainingAfterThisBatch : 0,
            },
          })
          .eq('id', feedId);
      } catch (err: any) {
        // Fallback: update last_checked_at only
        if (err?.message?.includes('does not exist') || err?.code === '42703') {
          await supabaseClient
            .from('watched_feeds')
            .update({ last_checked_at: new Date().toISOString() })
            .eq('id', feedId);
        } else {
          throw err;
        }
      }
    } else {
      // Just update last_checked_at without progress tracking
      await supabaseClient
        .from('watched_feeds')
        .update({ last_checked_at: new Date().toISOString() })
        .eq('id', feedId);
    }

    console.log(`[PROCESS_FEED] ✅ Complete: ${newUpdates} new updates found`);
    if (hasMoreEntries) {
      console.log(`[PROCESS_FEED] 🔄 ${remainingAfterThisBatch} more unprocessed entries - frontend will chain another API call`);
    }
    return { 
      newUpdates, 
      processedItems, 
      totalItems: totalItemsToProcess, 
      updates,
      hasMoreEntries,
      remainingEntries: hasMoreEntries ? remainingAfterThisBatch : 0,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isCancelled = errorMessage.includes('Processing cancelled');
    
    if (isCancelled) {
      console.log(`[PROCESS_FEED] 🛑 Processing cancelled for feed ${feedId}`);
    } else {
      console.error(`[PROCESS_FEED] ❌ Error processing feed ${feedId}:`, error);
    }
    
    // ALWAYS update last_checked_at even on error (but not if cancelled - feed might be deleted)
    if (!isCancelled) {
      try {
        if (enableProgressTracking) {
          await supabaseClient
            .from('watched_feeds')
            .update({
              last_checked_at: new Date().toISOString(),
              refresh_status: {
                in_progress: false,
                error: errorMessage,
                completed_at: new Date().toISOString(),
              },
            })
            .eq('id', feedId);
        } else {
          await supabaseClient
            .from('watched_feeds')
            .update({ last_checked_at: new Date().toISOString() })
            .eq('id', feedId);
        }
      } catch (updateError: any) {
        // Last resort: try to update last_checked_at only
        if (updateError?.message?.includes('does not exist') || updateError?.code === '42703') {
          try {
            await supabaseClient
              .from('watched_feeds')
              .update({ last_checked_at: new Date().toISOString() })
              .eq('id', feedId);
          } catch (finalError) {
            console.error('[PROCESS_FEED] Failed to update last_checked_at:', finalError);
          }
        }
      }
    }
    
    throw error;
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
        generationConfig: { 
          temperature: 0.3, 
          maxOutputTokens: 300,
          thinkingConfig: { thinkingBudget: 0 },
        },
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000,
        validateStatus: (status) => status >= 200 && status < 300,
      }
    );

    const content = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
    const trimmedContent = content?.trim() || '';
    
    console.log(`✅ New study summary (${trimmedContent.length} chars):`);
    console.log(trimmedContent);

    return trimmedContent || `New clinical trial: ${title}`;
  } catch (error) {
    console.error('Failed to generate new study summary:', error);
    return `New clinical trial ${nctId}. View study URL for details.`;
  }
}

/**
 * Extract meaningful diff content from HTML, removing all markup except diff indicators
 */
function sanitizeComparisonHtml(html: string): string {
  const $ = cheerio.load(html);
  
  // Find all elements with diff markers
  const diffElements: string[] = [];
  
  // Process each cell in the comparison table
  $('.cell.content-cell').each((_, cell) => {
    const $cell = $(cell);
    
    // Find the corresponding title cell (field name)
    const $titleCell = $cell.prev('.cell.title-cell');
    const fieldName = $titleCell.text().trim();
    
    // Check if this cell contains diff markers
    const hasRemoved = $cell.find('.ctg-diff-removed').length > 0;
    const hasAdded = $cell.find('.ctg-diff-added').length > 0;
    
    if (hasRemoved || hasAdded) {
      // Extract the full text with markers
      let cellContent = '';
      
      // Get the text content while preserving diff markers
      $cell.find('.text-cell').each((_, textCell) => {
        const $textCell = $(textCell);
        
        // Process each child element
        $textCell.contents().each((_, node) => {
          if (node.type === 'text') {
            cellContent += $(node).text();
          } else if (node.type === 'tag') {
            const $node = $(node);
            if ($node.hasClass('ctg-diff-removed')) {
              cellContent += `[REMOVED: ${$node.text()}]`;
            } else if ($node.hasClass('ctg-diff-added')) {
              cellContent += `[ADDED: ${$node.text()}]`;
            } else {
              // For nested structures, recursively process
              $node.find('.ctg-diff-removed').each((_, removed) => {
                const text = $(removed).text();
                if (text) cellContent += `[REMOVED: ${text}]`;
              });
              $node.find('.ctg-diff-added').each((_, added) => {
                const text = $(added).text();
                if (text) cellContent += `[ADDED: ${text}]`;
              });
              // Add other text content
              const otherText = $node.clone().find('.ctg-diff-removed, .ctg-diff-added').remove().end().text();
              if (otherText.trim()) cellContent += otherText;
            }
          }
        });
      });
      
      if (cellContent.trim() && (cellContent.includes('[REMOVED:') || cellContent.includes('[ADDED:'))) {
        diffElements.push(`${fieldName}: ${cellContent.trim()}`);
      }
    }
  });
  
  if (diffElements.length === 0) {
    return 'No changes with diff markers found';
  }
  
  return diffElements.join('\n\n');
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
    
    // Write full comparison HTML to file for debugging
    try {
      const debugDir = path.join(process.cwd(), 'debug-comparisons');
      await fs.mkdir(debugDir, { recursive: true });
      const debugFile = path.join(debugDir, `${nctId}_comparison.html`);
      await fs.writeFile(debugFile, comparisonHtml, 'utf-8');
      console.log(`📁 Debug: Wrote full comparison HTML to ${debugFile}`);
      console.log(`   HTML length: ${comparisonHtml.length} characters`);
    } catch (debugError) {
      console.error('Failed to write debug file:', debugError);
      // Continue processing even if debug file write fails
    }
    
    // Sanitize HTML to extract only diff content
    console.log(`🧹 Sanitizing HTML to extract diff markers...`);
    const sanitizedContent = sanitizeComparisonHtml(comparisonHtml);
    console.log(`✅ Sanitized content length: ${sanitizedContent.length} characters (reduced from ${comparisonHtml.length})`);
    console.log(`   Fields with changes: ${sanitizedContent.split('\n\n').length}`);
    
    // Write sanitized content to debug file too
    try {
      const debugDir = path.join(process.cwd(), 'debug-comparisons');
      const sanitizedFile = path.join(debugDir, `${nctId}_sanitized.txt`);
      await fs.writeFile(sanitizedFile, sanitizedContent, 'utf-8');
      console.log(`📁 Debug: Wrote sanitized content to ${sanitizedFile}`);
    } catch (debugError) {
      console.error('Failed to write sanitized debug file:', debugError);
    }
    
    const prompt = `You are a clinical trial change summarizer. Analyze changes from ClinicalTrials.gov.
TRIAL: ${nctId} – ${title}

CHANGES DETECTED:
${sanitizedContent}

Note: [REMOVED: text] indicates content deleted from previous version
      [ADDED: text] indicates content added in latest version

ALWAYS include BOTH the original value (removed) and the new value (added) for each change.

Only report on substantive changes:
- Primary/secondary outcomes modifications
- Primary completion date or study completion date changes
- Enrollment numbers (show change from X to Y)
- Study status changes (e.g., "Active, not recruiting" to "Completed"). We only care about the Overall Status - not for each location.
- Inclusion/exclusion criteria
- Study locations (added or removed sites - if more than 5 sites were changed,report only the total number of sites changed, do not list all of them)
- Intervention details (drugs, dosages)

Do NOT mention Record Verification Date, Last Update Submitted that Met QC Criteria or Last Update Posted since those are always present.

Format: If there are no substantive changes, return "Only minor changes found.". Do not add any preamble. Provide a brief, clear summary of up to 3 most significant changes in plain text NO MARKDOWN.`;

    console.log(`🤖 Sending prompt to Gemini (total length: ${prompt.length} characters)`);

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${geminiApiKey}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { 
          temperature: 0.7, 
          maxOutputTokens: 1500,
          thinkingConfig: { thinkingBudget: 0 },
        },
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000,
        validateStatus: (status) => status >= 200 && status < 300,
      }
    );

    const content = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    // Log full response (with length indicator)
    const trimmedContent = content?.trim() || '';
    console.log(`✅ Gemini response (${trimmedContent.length} chars):`);
    console.log(trimmedContent);

    return trimmedContent || `Changes detected for ${nctId}`;
  } catch (error: any) {
    console.error(`❌ Failed to generate change summary for ${nctId}:`, error.message);
    if (error.response) {
      console.error(`   API Response: ${JSON.stringify(error.response.data)}`);
    }
    return `Changes detected for ${nctId}. View comparison URL for details.`;
  }
}

