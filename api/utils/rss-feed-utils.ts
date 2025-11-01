import * as cheerio from 'cheerio';
import puppeteerCore from 'puppeteer-core';
import puppeteerFull from 'puppeteer';
import chromium from '@sparticuz/chromium';

// Detect if we're in a serverless/production environment
const isProduction = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;
const puppeteer = isProduction ? puppeteerCore : puppeteerFull;

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
};

const BASE_STUDY_URL = 'https://clinicaltrials.gov/study/';
const HISTORY_TAB = 'history';

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
 * Parse RSS feed and return entries
 */
export async function parseRssFeed(rssUrl: string): Promise<RSSEntry[]> {
  try {
    const response = await fetch(rssUrl, { headers: DEFAULT_HEADERS });
    const xmlText = await response.text();
    
    const $ = cheerio.load(xmlText, { xmlMode: true });
    const entries: RSSEntry[] = [];
    
    console.log(`\n📡 Parsing RSS feed...`);
    
    $('item').each((_, item) => {
      const title = $(item).find('title').text();
      const link = $(item).find('link').text();
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
      
      // Study is brand new if pubDate === dc:date (same timestamp)
      const isNew = !!(updated_dt && created_dt && 
        Math.abs(updated_dt.getTime() - created_dt.getTime()) < 1000); // Within 1 second
      
      if (isNew) {
        console.log(`   ✨ NEW study detected: ${title.substring(0, 60)}...`);
      }
      
      entries.push({ title, link, updated_dt, created_dt, isNew });
    });
    
    const newCount = entries.filter(e => e.isNew).length;
    const updatedCount = entries.length - newCount;
    console.log(`\n📊 RSS Feed Summary:`);
    console.log(`   Total entries: ${entries.length}`);
    console.log(`   New studies: ${newCount}`);
    console.log(`   Updated studies: ${updatedCount}`);
    
    return entries;
  } catch (error) {
    console.error('Failed to parse RSS feed:', error);
    return [];
  }
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
  params.append('tab', HISTORY_TAB);
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
  params.append('tab', HISTORY_TAB);
  params.append('a', a.toString());
  params.append('b', b.toString());
  return `${BASE_STUDY_URL}${nctId}?${params.toString()}#version-content-panel`;
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
    console.log(`\n🎭 Launching Puppeteer to render: ${historyUrl}`);
    console.log(`   Environment: ${isProduction ? 'Production (serverless)' : 'Local development'}`);
    
    // Launch browser with appropriate configuration
    if (isProduction) {
      // Use @sparticuz/chromium for serverless environments
      browser = await puppeteer.launch({
        args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox'],
        defaultViewport: { width: 1280, height: 720 },
        executablePath: await chromium.executablePath(),
        headless: true,
      });
    } else {
      // Use bundled Chromium for local development
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        defaultViewport: { width: 1280, height: 720 },
      });
    }
    
    const page = await browser.newPage();
    
    // Set user agent
    await page.setUserAgent('ABCresearch-ctgov-monitor/1.0');
    
    // Navigate to the history page
    console.log('📡 Loading page...');
    await page.goto(historyUrl, { waitUntil: 'networkidle0', timeout: 30000 });
    
    // Wait for content to be rendered
    console.log('⏳ Waiting for JavaScript to render...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Get all text content from the page
    const pageText = await page.evaluate(() => document.body.innerText);
    
    console.log(`✅ Page rendered, extracted ${pageText.length} characters of text`);
    
    await browser.close();
    browser = undefined;
    
    // If no Gemini API key, fall back to simple regex parsing
    if (!geminiApiKey) {
      console.log('⚠️  No Gemini API key, using fallback regex parsing');
      const versionMatches = pageText.match(/\b(\d+)\b/g);
      if (!versionMatches || versionMatches.length < 2) {
        console.log('❌ Could not find version numbers');
        return null;
      }
      const versions = versionMatches.map(v => parseInt(v, 10)).filter(v => v > 0 && v < 1000);
      const lastTwo = versions.slice(-2);
      return { a: lastTwo[0], b: lastTwo[1] };
    }
    
    // Use LLM to extract version numbers
    console.log('🤖 Using Gemini to extract version numbers...');
    
    const prompt = `You are analyzing a ClinicalTrials.gov study history page. The page contains a list of study versions.

Your task: Find ALL version numbers and return ONLY the last two (most recent) version numbers.

Page text:
${pageText.substring(0, 20000)}

Instructions:
1. Look for version numbers (usually sequential integers like 1, 2, 3, etc.)
2. Identify the COMPLETE list of version numbers
3. Return ONLY the last two version numbers in this EXACT format:
   PREVIOUS: X
   LATEST: Y

Example:
If you find versions [1, 2, 3, 4, 5], respond with:
PREVIOUS: 4
LATEST: 5

Respond now with ONLY those two lines, no other text.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 100,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error('Gemini API request failed');
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    console.log('🤖 LLM response:', content);
    
    // Parse the LLM response
    const prevMatch = content.match(/PREVIOUS:\s*(\d+)/i);
    const latestMatch = content.match(/LATEST:\s*(\d+)/i);
    
    if (!prevMatch || !latestMatch) {
      console.log('❌ Could not parse version numbers from LLM response');
      return null;
    }
    
    const result = {
      a: parseInt(prevMatch[1], 10),
      b: parseInt(latestMatch[1], 10),
    };
    
    console.log(`\n✅ Selected for comparison:`);
    console.log(`   Version A (previous): ${result.a}`);
    console.log(`   Version B (latest):   ${result.b}`);
    
    return result;
  } catch (error) {
    console.error('Failed to parse versions from history page:', error);
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
    console.log(`\n🎭 Launching Puppeteer to render comparison: ${comparisonUrl}`);
    console.log(`   Environment: ${isProduction ? 'Production (serverless)' : 'Local development'}`);
    
    // Launch browser with appropriate configuration
    if (isProduction) {
      // Use @sparticuz/chromium for serverless environments
      browser = await puppeteer.launch({
        args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox'],
        defaultViewport: { width: 1280, height: 720 },
        executablePath: await chromium.executablePath(),
        headless: true,
      });
    } else {
      // Use bundled Chromium for local development
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        defaultViewport: { width: 1280, height: 720 },
      });
    }
    
    const page = await browser.newPage();
    
    // Set user agent
    await page.setUserAgent('ABCresearch-ctgov-monitor/1.0');
    
    // Navigate to the comparison page
    console.log('📡 Loading comparison page...');
    await page.goto(comparisonUrl, { waitUntil: 'networkidle0', timeout: 30000 });
    
    // Wait for content to be rendered
    console.log('⏳ Waiting for JavaScript to render...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Get the full HTML after JavaScript has rendered
    const fullHtml = await page.content();
    
    console.log(`✅ Page rendered, extracted ${fullHtml.length} characters of HTML`);
    
    await browser.close();
    browser = undefined;
    
    // Check if HTML contains diff markers
    const hasInsertions = fullHtml.includes('<ins>');
    const hasDeletions = fullHtml.includes('<del>');
    console.log(`📄 HTML analysis:`);
    console.log(`   Contains insertions (<ins>): ${hasInsertions ? '✓' : '✗'}`);
    console.log(`   Contains deletions (<del>): ${hasDeletions ? '✓' : '✗'}`);
    
    if (!hasInsertions && !hasDeletions) {
      console.log('⚠️  No diff markers found, returning full HTML anyway');
    }
    
    // Return the full HTML - LLM will analyze it
    return [fullHtml];
  } catch (error) {
    console.error('Failed to extract comparison content:', error);
    if (browser) {
      await browser.close();
    }
    return ['Error extracting comparison content from page.'];
  }
}

/**
 * Generate LLM summary for a new study (no version comparison)
 */
export async function generateNewStudySummary(
  nctId: string,
  title: string,
  geminiApiKey: string
): Promise<string> {
  try {
    const prompt = `You are a clinical trial summarizer. Provide a brief 2-3 sentence summary of this new clinical trial based on its title and NCT ID.

Focus on:
- What condition/disease is being studied
- What intervention/treatment is being tested (if identifiable from title)
- Any other key details from the title

TRIAL: ${nctId} – ${title}

Provide a clear, concise summary (2-3 sentences max) suitable for researchers monitoring new trials.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 200,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', errorText);
      throw new Error('Gemini API request failed');
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (content) {
      return content.trim();
    }

    return `New clinical trial: ${title}`;
  } catch (error) {
    console.error('Failed to generate new study summary:', error);
    return `New clinical trial for ${nctId}. View study URL for details.`;
  }
}

/**
 * Generate LLM summary of changes using Gemini API
 * Analyzes HTML from version comparison page directly
 */
export async function generateChangeSummary(
  nctId: string,
  title: string,
  diffs: string[],
  geminiApiKey: string
): Promise<string> {
  try {
    // diffs[0] contains the comparison HTML from ctg-study-versions-compare div
    const comparisonHtml = diffs[0] || '';
    
    const prompt = `You are a clinical-trial change summarizer. Analyze the HTML from ClinicalTrials.gov's version comparison page.

The HTML contains diff markers showing what changed between two versions:
- <ins> tags or underlined text = ADDED content (new in latest version)
- <del> tags or strikethrough/line-through text = REMOVED content (deleted from previous version)

Your task: Identify and summarize the MOST IMPORTANT changes in 2-3 clear sentences.

Focus on substantive changes:
- Enrollment numbers
- Study status (recruiting, active, completed, terminated, etc.)
- Study phase (Phase 1, 2, 3, 4)
- Primary/secondary outcomes
- Inclusion/exclusion criteria changes
- Study locations or sites
- Intervention details (drugs, dosages, arms)
- Study dates (start date, completion date)

TRIAL: ${nctId} – ${title}

VERSION COMPARISON HTML:
${comparisonHtml.substring(0, 15000)}

Provide a brief, clear summary (2-3 sentences max). Ignore minor formatting changes. Focus ONLY on meaningful clinical changes that would matter to researchers or patients.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 250,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', errorText);
      throw new Error('Gemini API request failed');
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (content) {
      return content.trim();
    }

    return `Changes detected for ${nctId}`;
  } catch (error) {
    console.error('Failed to generate LLM summary:', error);
    return `Changes detected for ${nctId}. View comparison URL for details.`;
  }
}

