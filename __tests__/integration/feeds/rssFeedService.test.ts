/**
 * Integration Tests: Real-time Feed Subscription
 *
 * These tests verify the RSS feed monitoring workflow:
 * - Building RSS feed URLs
 * - Parsing RSS feed entries
 * - Extracting NCT IDs from links
 * - Date filtering (within N days)
 * - Building history and comparison URLs
 * - Parsing version numbers from history pages
 * - Extracting diff blocks from comparison pages
 * - Generating LLM summaries of changes
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  buildRssUrl,
  parseRssFeed,
  isWithinDays,
  extractNctId,
  buildHistoryUrl,
  buildComparisonUrl,
  parseLatestTwoVersions,
  extractDiffBlocks,
  generateChangeSummary,
} from '@/services/rssFeedService'

// Mock fetch globally
global.fetch = vi.fn()

describe('RSS Feed - URL Building', () => {
  it('should use raw URL when provided', () => {
    // Given: Raw URL
    const rawUrl = 'https://example.com/custom-feed.rss'

    // When: Building URL with raw parameter
    const result = buildRssUrl(rawUrl)

    // Then: Should return raw URL unchanged
    expect(result).toBe(rawUrl)
  })

  it('should build RSS URL with intervention parameter', () => {
    // Given: Intervention search
    const intervention = 'semaglutide'

    // When: Building URL
    const result = buildRssUrl(undefined, intervention)

    // Then: Should construct proper URL
    expect(result).toContain('https://clinicaltrials.gov/api/rss')
    expect(result).toContain('intr=semaglutide')
    expect(result).toContain('dateField=LastUpdatePostDate')
  })

  it('should build RSS URL with location and country parameters', () => {
    // Given: Location and country filters
    const location = 'California'
    const country = 'United States'

    // When: Building URL
    const result = buildRssUrl(undefined, undefined, location, country)

    // Then: Should include all parameters
    expect(result).toContain('locStr=California')
    expect(result).toContain('country=United+States')
  })

  it('should use custom date field when provided', () => {
    // Given: Custom date field
    const dateField = 'StartDate'

    // When: Building URL
    const result = buildRssUrl(undefined, 'test', undefined, undefined, dateField)

    // Then: Should use custom date field
    expect(result).toContain('dateField=StartDate')
  })
})

describe('RSS Feed - Parsing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should parse RSS feed with entries', async () => {
    // Given: Valid RSS feed XML
    const mockRssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>ClinicalTrials.gov RSS</title>
    <item>
      <title>Study of Semaglutide in Type 2 Diabetes</title>
      <link>https://clinicaltrials.gov/study/NCT12345678</link>
      <pubDate>Mon, 15 Jan 2024 10:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Tirzepatide for Obesity</title>
      <link>https://clinicaltrials.gov/study/NCT87654321</link>
      <pubDate>Tue, 16 Jan 2024 14:30:00 GMT</pubDate>
    </item>
  </channel>
</rss>`

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      text: async () => mockRssXml,
    } as Response)

    // When: Parsing RSS feed
    const result = await parseRssFeed('https://example.com/feed.rss')

    // Then: Should return parsed entries
    expect(result).toHaveLength(2)
    expect(result[0].title).toBe('Study of Semaglutide in Type 2 Diabetes')
    expect(result[0].link).toBe('https://clinicaltrials.gov/study/NCT12345678')
    expect(result[0].updated_dt).toBeInstanceOf(Date)
    expect(result[1].title).toBe('Tirzepatide for Obesity')
  })

  it('should handle empty RSS feed', async () => {
    // Given: Empty RSS feed
    const mockEmptyRss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Empty Feed</title>
  </channel>
</rss>`

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      text: async () => mockEmptyRss,
    } as Response)

    // When: Parsing empty feed
    const result = await parseRssFeed('https://example.com/empty.rss')

    // Then: Should return empty array
    expect(result).toEqual([])
  })

  it('should handle feed parsing errors gracefully', async () => {
    // Given: Fetch error
    vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'))

    // When: Parsing fails
    const result = await parseRssFeed('https://example.com/bad-feed.rss')

    // Then: Should return empty array
    expect(result).toEqual([])
  })

  it('should handle entries with missing dates', async () => {
    // Given: RSS entry without date
    const mockRssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>Test Study</title>
      <link>https://clinicaltrials.gov/study/NCT11111111</link>
    </item>
  </channel>
</rss>`

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      text: async () => mockRssXml,
    } as Response)

    // When: Parsing feed
    const result = await parseRssFeed('https://example.com/feed.rss')

    // Then: Should handle missing date
    expect(result).toHaveLength(1)
    expect(result[0].updated_dt).toBeNull()
  })
})

describe('RSS Feed - Date Filtering', () => {
  it('should identify dates within specified days', () => {
    // Given: Recent date (2 days ago)
    const recentDate = new Date()
    recentDate.setDate(recentDate.getDate() - 2)

    // When: Checking if within 7 days
    const result = isWithinDays(recentDate, 7)

    // Then: Should be true
    expect(result).toBe(true)
  })

  it('should reject dates outside specified days', () => {
    // Given: Old date (10 days ago)
    const oldDate = new Date()
    oldDate.setDate(oldDate.getDate() - 10)

    // When: Checking if within 7 days
    const result = isWithinDays(oldDate, 7)

    // Then: Should be false
    expect(result).toBe(false)
  })

  it('should handle null dates', () => {
    // Given: Null date
    const nullDate = null

    // When: Checking if within days
    const result = isWithinDays(nullDate, 7)

    // Then: Should be false
    expect(result).toBe(false)
  })

  it('should handle edge case (exactly N days ago)', () => {
    // Given: Date exactly 7 days ago (subtract 1 second to avoid millisecond timing issues)
    const exactDate = new Date()
    exactDate.setDate(exactDate.getDate() - 7)
    exactDate.setSeconds(exactDate.getSeconds() - 1)

    // When: Checking if within 7 days
    const result = isWithinDays(exactDate, 7)

    // Then: Should be true (inclusive)
    expect(result).toBe(true)
  })
})

describe('RSS Feed - NCT ID Extraction', () => {
  it('should extract NCT ID from ClinicalTrials.gov URL', () => {
    // Given: Study URL
    const url = 'https://clinicaltrials.gov/study/NCT12345678'

    // When: Extracting NCT ID
    const result = extractNctId(url)

    // Then: Should return NCT ID
    expect(result).toBe('NCT12345678')
  })

  it('should extract NCT ID from URL with query parameters', () => {
    // Given: URL with params
    const url = 'https://clinicaltrials.gov/study/NCT87654321?tab=history'

    // When: Extracting NCT ID
    const result = extractNctId(url)

    // Then: Should return NCT ID
    expect(result).toBe('NCT87654321')
  })

  it('should extract NCT ID from text containing NCT number', () => {
    // Given: Text with NCT ID
    const text = 'See trial NCT99999999 for more information'

    // When: Extracting NCT ID
    const result = extractNctId(text)

    // Then: Should return NCT ID
    expect(result).toBe('NCT99999999')
  })

  it('should return null when no NCT ID present', () => {
    // Given: URL without NCT ID
    const url = 'https://example.com/study/123'

    // When: Extracting NCT ID
    const result = extractNctId(url)

    // Then: Should return null
    expect(result).toBeNull()
  })
})

describe('RSS Feed - URL Construction for History and Comparison', () => {
  it('should build history URL for study', () => {
    // Given: NCT ID
    const nctId = 'NCT12345678'

    // When: Building history URL
    const result = buildHistoryUrl(nctId)

    // Then: Should include tab parameter
    expect(result).toBe('https://clinicaltrials.gov/study/NCT12345678?tab=history')
  })

  it('should build history URL with additional search params', () => {
    // Given: NCT ID and params
    const nctId = 'NCT12345678'
    const params = { foo: 'bar' }

    // When: Building history URL
    const result = buildHistoryUrl(nctId, params)

    // Then: Should include all parameters
    expect(result).toContain('tab=history')
    expect(result).toContain('foo=bar')
  })

  it('should build comparison URL for two versions', () => {
    // Given: NCT ID and version numbers
    const nctId = 'NCT12345678'
    const versionA = 5
    const versionB = 6

    // When: Building comparison URL
    const result = buildComparisonUrl(nctId, versionA, versionB)

    // Then: Should include version parameters and anchor
    expect(result).toContain('tab=history')
    expect(result).toContain('a=5')
    expect(result).toContain('b=6')
    expect(result).toContain('#version-content-panel')
  })

  it('should build comparison URL with additional search params', () => {
    // Given: NCT ID, versions, and params
    const nctId = 'NCT12345678'
    const params = { source: 'rss' }

    // When: Building comparison URL
    const result = buildComparisonUrl(nctId, 3, 4, params)

    // Then: Should include all parameters
    expect(result).toContain('source=rss')
    expect(result).toContain('a=3')
    expect(result).toContain('b=4')
  })
})

describe('RSS Feed - Version Parsing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should parse version numbers from history page HTML', async () => {
    // Given: History page HTML with version links
    const mockHistoryHtml = `
      <html>
        <body>
          <a href="?tab=history&a=5&b=6">Compare versions 5 and 6</a>
          <div data-version="5">Version 5</div>
          <div data-version="6">Version 6</div>
        </body>
      </html>
    `

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      text: async () => mockHistoryHtml,
    } as Response)

    // When: Parsing versions
    const result = await parseLatestTwoVersions('https://example.com/history')

    // Then: Should return latest two versions
    expect(result).not.toBeNull()
    expect(result?.b).toBe(6) // Latest version
    expect(result?.a).toBe(5) // Previous version
  })

  it('should return null when insufficient versions found', async () => {
    // Given: History page with only one version
    const mockHistoryHtml = `
      <html>
        <body>
          <div>Version 1</div>
        </body>
      </html>
    `

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      text: async () => mockHistoryHtml,
    } as Response)

    // When: Parsing versions
    const result = await parseLatestTwoVersions('https://example.com/history')

    // Then: Should return null
    expect(result).toBeNull()
  })

  it('should handle parsing errors gracefully', async () => {
    // Given: Fetch error
    vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'))

    // When: Parsing fails
    const result = await parseLatestTwoVersions('https://example.com/history')

    // Then: Should return null
    expect(result).toBeNull()
  })
})

describe('RSS Feed - Diff Extraction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should extract diff blocks from comparison page', async () => {
    // Given: Comparison page with ins/del tags
    const mockComparisonHtml = `
      <html>
        <body>
          <div>
            <ins>Added: 50 participants</ins>
            <del>Removed: Phase 2</del>
            <ins>Added: Phase 3</ins>
          </div>
        </body>
      </html>
    `

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      text: async () => mockComparisonHtml,
    } as Response)

    // When: Extracting diffs
    const result = await extractDiffBlocks('https://example.com/compare')

    // Then: Should return diff snippets
    expect(result.length).toBeGreaterThan(0)
    expect(result.some(s => s.includes('ADDED'))).toBe(true)
    expect(result.some(s => s.includes('REMOVED'))).toBe(true)
  })

  it('should handle pages with no diffs', async () => {
    // Given: Comparison page without diff markers
    const mockHtml = '<html><body><p>No changes detected</p></body></html>'

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      text: async () => mockHtml,
    } as Response)

    // When: Extracting diffs
    const result = await extractDiffBlocks('https://example.com/compare')

    // Then: Should return empty array
    expect(result).toEqual([])
  })

  it('should handle extraction errors gracefully', async () => {
    // Given: Fetch error
    vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'))

    // When: Extracting diffs
    const result = await extractDiffBlocks('https://example.com/compare')

    // Then: Should return empty array
    expect(result).toEqual([])
  })
})

describe('RSS Feed - LLM Summary Generation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should generate change summary using Gemini API', async () => {
    // Given: Trial info and diffs
    const nctId = 'NCT12345678'
    const title = 'Study of Semaglutide'
    const diffs = ['[ADDED] Enrollment increased to 1000', '[REMOVED] Phase 2', '[ADDED] Phase 3']
    const apiKey = 'test-api-key'

    const mockGeminiResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: 'The study has advanced to Phase 3 and increased enrollment to 1000 participants.',
              },
            ],
          },
        },
      ],
    }

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => mockGeminiResponse,
    } as Response)

    // When: Generating summary
    const result = await generateChangeSummary(nctId, title, diffs, apiKey)

    // Then: Should return LLM-generated summary
    expect(result).toContain('Phase 3')
    expect(result).toContain('1000 participants')
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('generativelanguage.googleapis.com'),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    )
  })

  it('should handle Gemini API errors gracefully', async () => {
    // Given: API error
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      text: async () => 'API Error',
    } as Response)

    // When: Generating summary
    const result = await generateChangeSummary(
      'NCT123',
      'Test Study',
      ['diff1', 'diff2'],
      'test-key'
    )

    // Then: Should return fallback message
    expect(result).toContain('Changes detected for NCT123')
  })

  it('should handle network errors during summary generation', async () => {
    // Given: Network error
    vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'))

    // When: Generating summary
    const result = await generateChangeSummary(
      'NCT456',
      'Test Study',
      ['diff1'],
      'test-key'
    )

    // Then: Should return fallback message
    expect(result).toContain('Changes detected for NCT456')
    expect(result).toContain('View comparison URL for details')
  })
})
