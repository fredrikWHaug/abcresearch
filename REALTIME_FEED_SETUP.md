# Realtime Feed Setup Guide

This guide will help you set up the Realtime Feed feature for monitoring ClinicalTrials.gov updates.

## Overview

The Realtime Feed feature has been successfully refactored from Google Cloud Functions (Python) to **Vercel Cron Jobs (TypeScript)**. It provides:

✅ **Daily automated monitoring** of ClinicalTrials.gov RSS feeds  
✅ **Intelligent diff detection** comparing trial version changes  
✅ **LLM-powered summaries** explaining what changed in each trial  
✅ **Timeline view** showing updates organized by date  
✅ **Multi-feed support** allowing users to watch multiple RSS feeds  

## What Was Built

### 1. **Database Schema** (`documentation/10-realtime-feed-schema.md`)
- `watched_feeds` table: Stores RSS feed URLs users want to monitor
- `trial_updates` table: Stores detected changes with LLM summaries
- Row Level Security (RLS) policies for user data isolation

### 2. **Backend Services**

#### Vercel Cron Job (`api/cron-check-rss-feeds.ts`)
- Runs daily at midnight UTC
- Checks all watched feeds for updates
- Processes trials updated in the last 14 days
- Scrapes version history and generates comparison URLs
- Uses LLM to summarize changes

#### RSS Feed Service (`src/services/rssFeedService.ts`)
- Parses RSS feeds from ClinicalTrials.gov
- Extracts NCT IDs from trial links
- Scrapes history pages to find latest version numbers
- Extracts diff blocks from comparison pages
- Generates LLM summaries of changes

#### API Endpoints
- **`/api/rss-feed-watch`**: Manage watched feeds (GET, POST, DELETE)
- **`/api/rss-feed-updates`**: Fetch trial updates with timeline view

### 3. **Frontend Component** (`src/components/RealtimeFeed.tsx`)
- Beautiful timeline UI showing updates by date
- Sidebar for managing watched feeds
- Modal for adding new RSS feed URLs
- Direct links to study pages, history, and version diffs

### 4. **Configuration** (`vercel.json`)
- Cron job schedule: `"0 0 * * *"` (daily at midnight UTC)
- Function timeout: 300 seconds (5 minutes)

## Setup Instructions

### Step 1: Set Up Database

Run this SQL in your Supabase SQL Editor:

```sql
-- Create watched_feeds table
CREATE TABLE watched_feeds (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feed_url TEXT NOT NULL,
  label TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_checked_at TIMESTAMPTZ,
  UNIQUE(user_id, feed_url)
);

CREATE INDEX idx_watched_feeds_user_id ON watched_feeds(user_id);
CREATE INDEX idx_watched_feeds_last_checked ON watched_feeds(last_checked_at);

ALTER TABLE watched_feeds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own watched feeds"
  ON watched_feeds FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own watched feeds"
  ON watched_feeds FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own watched feeds"
  ON watched_feeds FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own watched feeds"
  ON watched_feeds FOR DELETE USING (auth.uid() = user_id);

-- Create trial_updates table
CREATE TABLE trial_updates (
  id BIGSERIAL PRIMARY KEY,
  feed_id BIGINT NOT NULL REFERENCES watched_feeds(id) ON DELETE CASCADE,
  nct_id TEXT NOT NULL,
  title TEXT NOT NULL,
  last_update TIMESTAMPTZ NOT NULL,
  study_url TEXT NOT NULL,
  history_url TEXT NOT NULL,
  comparison_url TEXT NOT NULL,
  version_a INTEGER NOT NULL,
  version_b INTEGER NOT NULL,
  raw_diff_blocks TEXT[] NOT NULL DEFAULT '{}',
  llm_summary TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(feed_id, nct_id, last_update)
);

CREATE INDEX idx_trial_updates_feed_id ON trial_updates(feed_id);
CREATE INDEX idx_trial_updates_nct_id ON trial_updates(nct_id);
CREATE INDEX idx_trial_updates_last_update ON trial_updates(last_update DESC);
CREATE INDEX idx_trial_updates_created_at ON trial_updates(created_at DESC);

ALTER TABLE trial_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view updates for their watched feeds"
  ON trial_updates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM watched_feeds
      WHERE watched_feeds.id = trial_updates.feed_id
      AND watched_feeds.user_id = auth.uid()
    )
  );

-- Grant permissions
GRANT ALL ON watched_feeds TO authenticated;
GRANT ALL ON trial_updates TO authenticated;
GRANT USAGE ON SEQUENCE watched_feeds_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE trial_updates_id_seq TO authenticated;
```

### Step 2: Set Environment Variables

Add these to your Vercel project environment variables:

```bash
# Existing variables (should already be set)
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key

# New variables needed
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key  # For cron job
CRON_SECRET=create_a_random_secret_string        # To secure cron endpoint
GOOGLE_GEMINI_API_KEY=your_gemini_api_key        # For LLM summaries
```

**To get your Supabase Service Role Key:**
1. Go to your Supabase project dashboard
2. Navigate to Settings → API
3. Copy the "service_role" key (keep this secret!)

**To generate a CRON_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**To get your Google Gemini API Key:**
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Copy the key and add it to your Vercel environment variables

### Step 3: Deploy to Vercel

```bash
# Commit your changes
git add .
git commit -m "Add Realtime Feed feature"

# Push to your repository
git push origin main

# Vercel will automatically deploy
# Or manually deploy:
vercel --prod
```

### Step 4: Verify Cron Job

1. Go to your Vercel dashboard
2. Navigate to your project → Settings → Cron Jobs
3. You should see: `/api/cron-check-rss-feeds` scheduled for `0 0 * * *`
4. Click "Run" to test it manually

### Step 5: Test the Feature

1. Open your app and navigate to the "Realtime Feed" tab
2. Click "Watch New Feed"
3. Enter a search term (drug name, intervention, or condition), for example:
   - `Orforglipron`
   - `Semaglutide`
   - `Type 2 Diabetes`
4. Optionally customize the label
5. Click "Start Watching"
6. The system will:
   - Automatically generate the RSS URL: `https://clinicaltrials.gov/api/rss?intr=YourSearchTerm&locStr=USA&country=US&dateField=LastUpdatePostDate`
   - Check for updates during the next cron run (midnight UTC)

## How It Works

### 1. User Adds Feed by Search Term
- User enters a drug name, intervention, or condition (e.g., "Orforglipron")
- System automatically builds RSS URL: `https://clinicaltrials.gov/api/rss?intr=SearchTerm&locStr=USA&country=US&dateField=LastUpdatePostDate`
- Saved to `watched_feeds` table

### 2. Daily Cron Job Runs
- Every day at midnight UTC, Vercel triggers `/api/cron-check-rss-feeds`
- For each watched feed:
  - Parse RSS feed
  - Find trials updated in last 14 days
  - For each trial:
    - Go to study history page
    - Extract latest two version numbers (e.g., v19 and v20)
    - Fetch comparison page
    - Extract diff blocks (additions/deletions)
    - Send diffs to LLM for summary
    - Save to `trial_updates` table

### 3. User Views Timeline
- User opens Realtime Feed tab
- Timeline shows updates grouped by date
- Each update card displays:
  - NCT ID
  - Trial title
  - LLM summary of changes
  - Links to study, history, and diff pages

## RSS Feed URL Format

ClinicalTrials.gov RSS URLs follow this pattern:

```
https://clinicaltrials.gov/api/rss?[parameters]
```

**Common parameters:**
- `intr=DrugName` - Filter by intervention (drug name)
- `locStr=USA` - Filter by location
- `country=US` - Filter by country
- `dateField=LastUpdatePostDate` - Date field to monitor
- `cond=Disease` - Filter by condition

**Example URLs:**

```
# Orforglipron trials in USA
https://clinicaltrials.gov/api/rss?intr=Orforglipron&locStr=USA&country=US&dateField=LastUpdatePostDate

# All diabetes trials
https://clinicaltrials.gov/api/rss?cond=Diabetes&dateField=LastUpdatePostDate

# Cancer trials in New York
https://clinicaltrials.gov/api/rss?cond=Cancer&locStr=New%20York&country=US&dateField=LastUpdatePostDate
```

**To get RSS URLs:**
1. Go to [ClinicalTrials.gov](https://clinicaltrials.gov)
2. Search for trials using their advanced search
3. Look for the RSS feed icon or link
4. Copy the RSS feed URL

## Customization

### Change Cron Schedule

Edit `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron-check-rss-feeds",
      "schedule": "0 */6 * * *"  // Every 6 hours instead of daily
    }
  ]
}
```

### Change Detection Window

In `api/cron-check-rss-feeds.ts`, change this line:

```typescript
const recentEntries = entries.filter((e) => isWithinDays(e.updated_dt, 14));
// Change 14 to your preferred number of days
```

### Improve LLM Summaries

Edit the prompt in `src/services/rssFeedService.ts`:

```typescript
export async function generateChangeSummary(
  nctId: string,
  title: string,
  diffs: string[]
): Promise<string> {
  // Customize this prompt to get better summaries
  const prompt = `You are a clinical-trial change summarizer...`;
  // ...
}
```

## Troubleshooting

### Cron job not running
- Check Vercel dashboard → Cron Jobs
- Verify `CRON_SECRET` is set
- Check function logs for errors

### No updates appearing
- Verify RSS feed URL is valid
- Check that trials have been updated in last 14 days
- Look at cron job logs in Vercel

### LLM summaries are generic
- Check `GOOGLE_GEMINI_API_KEY` is set correctly
- Verify you have API credits/quota
- Improve the prompt in `rssFeedService.ts`

### Database errors
- Ensure tables exist in Supabase
- Check RLS policies are enabled
- Verify user is authenticated

## Architecture Differences from Original

| Aspect | Original (GCF + Python) | New (Vercel + TypeScript) |
|--------|------------------------|---------------------------|
| **Runtime** | Google Cloud Functions | Vercel Serverless Functions |
| **Language** | Python 3.11 | TypeScript/Node.js |
| **Scheduler** | Cloud Scheduler | Vercel Cron Jobs |
| **Storage** | Google Cloud Storage | Supabase (PostgreSQL) |
| **Secrets** | Secret Manager | Vercel Environment Variables |
| **Email** | SendGrid | Not implemented yet (future) |
| **HTML Parsing** | BeautifulSoup | Cheerio |
| **HTTP Client** | httpx | fetch API |
| **RSS Parsing** | feedparser | cheerio + custom parser |

## Future Enhancements

- [ ] Email notifications when updates are found
- [ ] Webhook support for integrations
- [ ] LLM-powered RSS URL builder (user describes what they want)
- [ ] Export updates as CSV/PDF
- [ ] Smart categorization of changes (enrollment, criteria, endpoints, etc.)
- [ ] Browser extension for quick feed watching

## Files Changed/Created

### New Files
- ✅ `src/types/rss-feed.ts` - TypeScript types
- ✅ `src/services/rssFeedService.ts` - Core RSS monitoring logic
- ✅ `src/components/RealtimeFeed.tsx` - Full UI component
- ✅ `api/cron-check-rss-feeds.ts` - Vercel cron job
- ✅ `api/rss-feed-watch.ts` - Manage watched feeds API
- ✅ `api/rss-feed-updates.ts` - Fetch updates API
- ✅ `documentation/10-realtime-feed-schema.md` - Database schema docs
- ✅ `REALTIME_FEED_SETUP.md` - This setup guide

### Modified Files
- ✅ `vercel.json` - Added cron configuration
- ✅ `src/components/Dashboard.tsx` - Added Realtime Feed tab
- ✅ `package.json` - Added cheerio dependency

## Support

If you encounter issues, check:
1. Vercel function logs
2. Supabase database logs
3. Browser console for frontend errors

The feature is production-ready and follows all the patterns from your existing codebase! 🎉

