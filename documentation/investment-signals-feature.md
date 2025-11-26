# Investment Signals Feature

**Date**: November 26, 2025  
**Feature**: AI-Generated Investment Signals for RSS Feed Updates

## Overview

The Investment Signals feature provides sell-side analyst-grade insights from clinical trial updates monitored via RSS feeds. It uses Claude AI to analyze recent trial updates and generate actionable investment signals.

## Components

### 1. API Endpoint: `/api/investment-signals.ts`

**Endpoint**: `POST /api/investment-signals`

**Authentication**: Requires Supabase Bearer token

**Process**:
1. Fetches all watched feeds for authenticated user
2. Retrieves recent trial updates (last 30 days, max 50)
3. Formats trial data with:
   - Sponsor name
   - NCT ID
   - Update type (NEW STUDY vs VERSION UPDATE)
   - Title and LLM summary
   - Last update date
4. Sends context to Claude 3 Haiku with analyst-focused prompt
5. Returns exactly 3 investment signals

**Response Format**:
```json
{
  "signals": [
    {
      "rating": "OUTPERFORM",
      "content": "Sponsor Name: Insight about trial progress or concerns"
    },
    {
      "rating": "UNDERPERFORM",
      "content": "Sponsor Name: Another investment-relevant signal"
    },
    {
      "rating": "HOLD",
      "content": "Sponsor Name: Third signal about material events"
    }
  ],
  "updatesAnalyzed": 25,
  "generatedAt": "2025-11-26T10:30:00Z"
}
```

**Claude Prompt Strategy**:
- Role: Senior sell-side biotech equity analyst
- Focus: Material events impacting company valuation
- Positive signals: enrollment expansion, new trials, phase progression → **OUTPERFORM**
- Negative signals: termination, enrollment issues, delays, safety concerns → **UNDERPERFORM**
- Neutral signals: minor updates, maintenance activities → **HOLD**
- Voice: Professional, direct, action-oriented
- Format: "[RATING] Sponsor Name: insight" (1-2 sentences max)

**Stock Ratings**:
- **OUTPERFORM**: Positive catalyst, expect stock to outperform sector/market
- **HOLD**: Neutral development, maintain current position
- **UNDERPERFORM**: Negative catalyst, expect stock to underperform sector/market

**Model**: Claude 3 Haiku (`claude-3-haiku-20240307`)
- Cost-effective for this use case
- Max tokens: 500 (sufficient for 3 bullet points)
- Temperature: 0.7 (balanced consistency and variety)

### 2. UI Component: `InvestmentSignals.tsx`

**Location**: Below Watched Feeds in RSS Feed page sidebar

**Features**:
- **Manual Refresh**: Only updates when user clicks "Refresh Signals" button
- **Loading State**: Shows spinner and "Analyzing..." text
- **Error Handling**: Displays error messages with retry option
- **Empty State**: Guides user to click refresh button
- **Formatted Display**: 
  - Purple gradient card with distinct branding
  - Numbered bullet points (1, 2, 3)
  - **Stock rating badges** with color coding:
    - 🟢 **Outperform** (green badge with TrendingUp icon)
    - 🔴 **Underperform** (red badge with TrendingDown icon)
    - ⚪ **Hold** (gray badge with Minus icon)
  - Bold sponsor names
  - Clean insight text
- **Metadata Footer**:
  - Generation timestamp
  - Number of updates analyzed
- **Disclaimer**: Clarifies signals are informational, not investment advice

**Visual Design**:
- Purple color scheme (differentiates from blue feed cards)
- Gradient background (`from-purple-50 to-white`)
- TrendingUp icon for investment theme
- Hover effects on signal cards
- Responsive layout

**Props**:
- `isVisible?: boolean` - Controls component visibility (follows parent visibility pattern)

### 3. Integration: `RealtimeFeed.tsx`

**Changes**:
1. Import `InvestmentSignals` component
2. Wrapped sidebar in `space-y-6` container
3. Added Investment Signals below Watched Feeds card
4. Passes `isVisible` prop to maintain lazy loading behavior

**Layout**:
```
┌─────────────────────────────────────────────────┐
│ Realtime Feed Header                            │
└─────────────────────────────────────────────────┘
┌──────────────┬──────────────────────────────────┐
│ Sidebar      │ Main Timeline                    │
│              │                                  │
│ ┌──────────┐ │ ┌──────────────────────────────┐ │
│ │ Watched  │ │ │ Date: Nov 26                 │ │
│ │ Feeds    │ │ │ ┌──────────────────────────┐ │ │
│ │          │ │ │ │ Trial Update 1           │ │ │
│ │ • Feed 1 │ │ │ └──────────────────────────┘ │ │
│ │ • Feed 2 │ │ │ ┌──────────────────────────┐ │ │
│ └──────────┘ │ │ │ Trial Update 2           │ │ │
│              │ │ └──────────────────────────┘ │ │
│ ┌──────────┐ │ └──────────────────────────────┘ │
│ │ AI       │ │                                  │
│ │ Investment│ │                                  │
│ │ Signals  │ │                                  │
│ │          │ │                                  │
│ │ 1. X: Y  │ │                                  │
│ │ 2. X: Y  │ │                                  │
│ │ 3. X: Y  │ │                                  │
│ │          │ │                                  │
│ │ [Refresh]│ │                                  │
│ └──────────┘ │                                  │
└──────────────┴──────────────────────────────────┘
```

## Example Output

**Sample Investment Signals**:

1. 🟢 **OUTPERFORM** - **Eli Lilly**: Phase 3 GLP-1 trial expanded enrollment by 40%, signaling strong efficacy trends and accelerated timeline to regulatory submission.

2. 🔴 **UNDERPERFORM** - **Pfizer**: Early termination of oncology asset due to futility at interim analysis; potential $2B+ write-down and pipeline gap for 2026-2027.

3. 🟢 **OUTPERFORM** - **Moderna**: New RSV vaccine trial initiated in elderly population following promising Phase 2 data; positions company to compete in $5B+ market.

## User Workflow

1. User navigates to "Realtime Feed" page
2. User adds RSS feeds for clinical trials of interest
3. System monitors feeds and collects trial updates
4. User clicks "Refresh Signals" button in Investment Signals card
5. API analyzes recent updates (last 30 days)
6. Claude generates 3 investment-relevant insights
7. Signals display in formatted list with sponsor names
8. User can refresh signals anytime for updated analysis

## Technical Considerations

### Performance
- API call takes ~2-3 seconds (Claude Haiku is fast)
- Fetches max 50 most recent updates to keep context manageable
- No automatic refresh to avoid unnecessary API costs

### Cost Management
- **Manual trigger only**: User controls when to generate signals
- **Claude Haiku**: Most cost-effective model (~$0.001 per request)
- **Cached responses**: Could add caching layer in future (1-hour TTL)

### Data Requirements
- Requires user to have active watched feeds
- Requires trial updates in database (from RSS refresh)
- Works with 1+ updates (but 10+ recommended for meaningful analysis)

### Error Scenarios Handled
1. **No authentication**: Returns 401 Unauthorized
2. **No watched feeds**: Returns friendly message prompting user to add feeds
3. **No recent updates**: Returns message prompting user to refresh feeds
4. **Claude API failure**: Displays error with retry option
5. **Network timeout**: Standard fetch error handling

## Future Enhancements

### Potential Improvements
1. **Email Digest**: Send daily/weekly signal summaries via email
2. **Signal History**: Store past signals for trend analysis
3. **Sponsor Filtering**: Generate signals for specific sponsors only
4. **Severity Scores**: Add +/- sentiment scores to signals
5. **Alert Thresholds**: Notify user of high-priority signals
6. **Export to PDF**: Generate analyst-style reports
7. **Integration with Projects**: Link signals to research projects

### Advanced Features
1. **Multi-Model Comparison**: Compare Claude vs GPT-4 insights
2. **Confidence Scores**: Rate signal confidence based on data quality
3. **Historical Validation**: Track signal accuracy over time
4. **Custom Prompts**: Allow users to customize analysis focus
5. **Comparative Analysis**: Compare signals across time periods

## Testing Recommendations

### Manual Testing Checklist
- [ ] Navigate to Realtime Feed page
- [ ] Verify Investment Signals card appears below Watched Feeds
- [ ] Click "Refresh Signals" without feeds → see empty state message
- [ ] Add a watched feed and refresh it
- [ ] Click "Refresh Signals" → see loading spinner
- [ ] Verify 3 signals appear with sponsor names
- [ ] Check metadata footer shows timestamp and update count
- [ ] Verify disclaimer appears at bottom
- [ ] Test error handling (simulate API failure)
- [ ] Verify responsive layout on mobile/tablet

### Integration Testing
- [ ] Verify API endpoint is accessible at `/api/investment-signals`
- [ ] Test authentication with valid/invalid tokens
- [ ] Verify proper CORS headers
- [ ] Test with 0, 1, 10, 50 trial updates
- [ ] Verify Claude response parsing
- [ ] Check signal format consistency

### Performance Testing
- [ ] Measure API response time (should be <5 seconds)
- [ ] Test with max updates (50) → verify still fast
- [ ] Monitor Claude API costs
- [ ] Verify no memory leaks in component

## Dependencies

### API Dependencies
- `@vercel/node` - Vercel serverless function types
- `@supabase/supabase-js` - Database access and authentication
- Anthropic API - Claude AI model access

### Component Dependencies
- `@/components/ui/card` - Card layout component
- `@/components/ui/button` - Button component
- `lucide-react` - Icons (RefreshCw, TrendingUp, AlertCircle)
- `@/lib/supabase` - Supabase client instance

### Environment Variables Required
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key
- `ANTHROPIC_API_KEY` - Claude API key

## Architecture Decisions

### Why Manual Refresh?
- **Cost Control**: Avoids unnecessary API calls
- **User Intent**: User decides when analysis is needed
- **Fresh Analysis**: Ensures signals reflect current data
- **Rate Limiting**: Prevents abuse through excessive requests

### Why Claude Haiku?
- **Cost-Effective**: 74% cheaper than Sonnet
- **Fast Response**: ~1-2s vs 3-5s for Sonnet
- **Sufficient Quality**: Haiku excels at structured summarization tasks
- **Proven Success**: Already used in other features (generate-response.ts)

### Why 3 Signals?
- **Digestible**: Easy to scan quickly
- **Actionable**: Forces prioritization of most material events
- **Executive Format**: Mimics sell-side research note structure
- **Token Efficient**: Keeps response focused and cost-effective

### Why 30-Day Window?
- **Recency Bias**: Most relevant for investment decisions
- **Context Size**: Manageable for Claude (50 updates max)
- **Signal Quality**: Recent events more predictive
- **Database Performance**: Smaller query scope

## Changelog

**v1.1.0** - November 26, 2025
- Added stock rating determinations (OUTPERFORM, HOLD, UNDERPERFORM)
- Color-coded rating badges with icons
- Updated Claude prompt to generate ratings based on signal sentiment
- Enhanced visual hierarchy with rating badges

**v1.0.0** - November 26, 2025
- Initial implementation
- Added `/api/investment-signals` endpoint
- Created `InvestmentSignals` component
- Integrated into `RealtimeFeed` page
- Manual refresh trigger only
- Claude 3 Haiku model
- 3-signal format with sponsor names
- Purple branding for differentiation

