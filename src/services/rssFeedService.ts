import * as cheerio from 'cheerio';

interface RSSEntry {
  title: string;
  link: string;
  updated_dt: Date | null;
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
 * Build RSS URL from parameters or use provided URL
 */
export function buildRssUrl(
  raw?: string,
  intr?: string,
  locStr?: string,
  country?: string,
  dateField?: string
): string {
  if (raw) return raw;
  
  const base = 'https://clinicaltrials.gov/api/rss';
  const params = new URLSearchParams();
  
  if (intr) params.append('intr', intr);
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
    
    $('item').each((_, item) => {
      const title = $(item).find('title').text();
      const link = $(item).find('link').text();
      const pubDate = $(item).find('pubDate').text() || $(item).find('updated').text();
      
      let updated_dt: Date | null = null;
      if (pubDate) {
        try {
          updated_dt = new Date(pubDate);
        } catch (e) {
          console.error('Failed to parse date:', pubDate);
        }
      }
      
      entries.push({ title, link, updated_dt });
    });
    
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
 * Parse latest two versions from history page HTML
 */
export async function parseLatestTwoVersions(historyUrl: string): Promise<VersionPair | null> {
  try {
    const response = await fetch(historyUrl, { headers: DEFAULT_HEADERS });
    const html = await response.text();
    const $ = cheerio.load(html);
    
    const candidates = new Set<number>();
    
    // Find version IDs from links
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const url = new URL(href, historyUrl);
      const params = url.searchParams;
      
      for (const key of ['a', 'b']) {
        const value = params.get(key);
        if (value && /^\d+$/.test(value)) {
          candidates.add(parseInt(value, 10));
        }
      }
    });
    
    // Find version numbers in data attributes and text
    $('[data-version], [data-version-id]').each((_, el) => {
      const version = $(el).attr('data-version') || $(el).attr('data-version-id');
      if (version && /^\d+$/.test(version)) {
        candidates.add(parseInt(version, 10));
      }
    });
    
    // Find "Version X" text patterns
    const versionPattern = /Version\s+(\d+)/gi;
    $('*').each((_, el) => {
      const text = $(el).text();
      let match;
      while ((match = versionPattern.exec(text)) !== null) {
        candidates.add(parseInt(match[1], 10));
      }
    });
    
    if (candidates.size < 2) {
      return null;
    }
    
    const versions = Array.from(candidates).sort((a, b) => b - a);
    return {
      b: versions[0],
      a: versions[1],
    };
  } catch (error) {
    console.error('Failed to parse versions from history page:', error);
    return null;
  }
}

/**
 * Extract diff blocks from comparison page
 */
export async function extractDiffBlocks(comparisonUrl: string): Promise<string[]> {
  try {
    const response = await fetch(comparisonUrl, { headers: DEFAULT_HEADERS });
    const html = await response.text();
    const $ = cheerio.load(html);
    
    const snippets: string[] = [];
    const seen = new Set<string>();
    
    // Find <ins> and <del> tags
    $('ins, del').each((_, el) => {
      const text = $(el).text().trim();
      if (text) {
        const kind = el.tagName === 'ins' ? 'ADDED' : 'REMOVED';
        const snippet = `[${kind}] ${text}`;
        if (!seen.has(snippet)) {
          snippets.push(snippet);
          seen.add(snippet);
        }
      }
    });
    
    // Find elements with diff-related classes
    $('[class*="diff"], [class*="added"], [class*="removed"], [class*="strike"]').each((_, el) => {
      const text = $(el).text().trim();
      if (text && !seen.has(text)) {
        snippets.push(text);
        seen.add(text);
      }
    });
    
    return snippets.slice(0, 200); // Limit to 200 snippets
  } catch (error) {
    console.error('Failed to extract diff blocks:', error);
    return [];
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
    const joined = diffs.slice(0, 20).join('\n\n');
    const prompt = `You are a clinical-trial change summarizer. Given raw diff snippets extracted from ClinicalTrials.gov's version comparison, write a concise summary of WHAT changed.

Focus on substantive changes (enrollment, arms, outcomes, phase, criteria, locations, status).

TRIAL: ${nctId} – ${title}
DIFF SNIPPETS:
${joined}

Provide a brief, clear summary (2-3 sentences max). Focus on the most important changes.`;

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

    return `Changes detected for ${nctId}`;
  } catch (error) {
    console.error('Failed to generate LLM summary:', error);
    return `Changes detected for ${nctId}. View comparison URL for details.`;
  }
}

