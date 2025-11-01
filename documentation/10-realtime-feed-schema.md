# Realtime Feed Database Schema

This document describes the database schema required for the Realtime Feed feature, which monitors ClinicalTrials.gov RSS feeds and tracks trial updates.

## Overview

The Realtime Feed system consists of two main tables:
1. `watched_feeds` - Stores RSS feed URLs that users want to monitor
2. `trial_updates` - Stores detected changes in clinical trials

## Tables

### watched_feeds

Stores RSS feed URLs that users are monitoring for updates.

```sql
CREATE TABLE watched_feeds (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feed_url TEXT NOT NULL,
  label TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_checked_at TIMESTAMPTZ,
  UNIQUE(user_id, feed_url)
);

-- Index for faster queries
CREATE INDEX idx_watched_feeds_user_id ON watched_feeds(user_id);
CREATE INDEX idx_watched_feeds_last_checked ON watched_feeds(last_checked_at);

-- Enable RLS
ALTER TABLE watched_feeds ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own watched feeds"
  ON watched_feeds FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own watched feeds"
  ON watched_feeds FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own watched feeds"
  ON watched_feeds FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own watched feeds"
  ON watched_feeds FOR DELETE
  USING (auth.uid() = user_id);
```

**Columns:**
- `id`: Primary key
- `user_id`: Reference to the user who created this watch
- `feed_url`: The RSS feed URL from ClinicalTrials.gov
- `label`: User-friendly name for the feed
- `created_at`: When the feed was added
- `last_checked_at`: Last time the cron job checked this feed for updates

### trial_updates

Stores detected changes in clinical trials, including LLM-generated summaries of what changed.

```sql
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

-- Indexes for faster queries
CREATE INDEX idx_trial_updates_feed_id ON trial_updates(feed_id);
CREATE INDEX idx_trial_updates_nct_id ON trial_updates(nct_id);
CREATE INDEX idx_trial_updates_last_update ON trial_updates(last_update DESC);
CREATE INDEX idx_trial_updates_created_at ON trial_updates(created_at DESC);

-- Enable RLS
ALTER TABLE trial_updates ENABLE ROW LEVEL SECURITY;

-- RLS Policy - users can only see updates for their own feeds
CREATE POLICY "Users can view updates for their watched feeds"
  ON trial_updates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM watched_feeds
      WHERE watched_feeds.id = trial_updates.feed_id
      AND watched_feeds.user_id = auth.uid()
    )
  );

-- RLS Policy - allow inserting updates (for cron job and manual refresh)
CREATE POLICY "Insert trial updates for watched feeds"
  ON trial_updates FOR INSERT
  WITH CHECK (
    -- Either user owns the feed, or it's a service role insert (no user context)
    auth.uid() IS NULL OR
    EXISTS (
      SELECT 1 FROM watched_feeds
      WHERE watched_feeds.id = trial_updates.feed_id
      AND watched_feeds.user_id = auth.uid()
    )
  );
```

**Columns:**
- `id`: Primary key
- `feed_id`: Reference to the watched feed
- `nct_id`: ClinicalTrials.gov identifier (e.g., NCT06192108)
- `title`: Study title
- `last_update`: When the trial was last updated on ClinicalTrials.gov
- `study_url`: Direct link to the study page
- `history_url`: Link to the study's history page
- `comparison_url`: Link to the version comparison page
- `version_a`: Earlier version number
- `version_b`: Later version number (current)
- `raw_diff_blocks`: Array of text snippets showing what changed
- `llm_summary`: AI-generated summary of the changes
- `created_at`: When this update was detected by our system

## Usage

### 1. Adding a Watched Feed

Users can add feeds by entering a search term through the UI or API:

```typescript
POST /api/rss-feed-watch
{
  "searchTerm": "Orforglipron",
  "label": "Orforglipron trials",
  "locStr": "USA",
  "country": "US",
  "dateField": "LastUpdatePostDate"
}
```

The system automatically constructs the RSS URL from the search term.

### 2. Automated Monitoring

The Vercel Cron Job (`/api/cron-check-rss-feeds`) runs daily at midnight (UTC) and:
1. Fetches all `watched_feeds` from the database
2. For each feed, parses the RSS and finds trials updated in the last 14 days
3. For each trial, scrapes the history page to get version numbers
4. Creates comparison URLs and extracts diff blocks
5. Uses LLM to generate a summary of changes
6. Saves new updates to `trial_updates` table

### 3. Viewing Updates

Users can view updates through the Realtime Feed tab:

```typescript
GET /api/rss-feed-updates?days=30
// Returns all updates from the last 30 days

GET /api/rss-feed-updates?feedId=123
// Returns updates for a specific feed
```

## Environment Variables

Required environment variables for the cron job:

```bash
# Supabase
VITE_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Cron security
CRON_SECRET=random_secret_string

# Google Gemini (for LLM summaries)
GOOGLE_GEMINI_API_KEY=your_gemini_api_key
```

## Vercel Cron Configuration

In `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron-check-rss-feeds",
      "schedule": "0 0 * * *"
    }
  ]
}
```

This runs daily at midnight UTC. The schedule can be adjusted:
- `"0 */6 * * *"` - Every 6 hours
- `"0 12 * * *"` - Once per day at noon UTC
- `"0 0 * * 1"` - Once per week on Mondays

## Migration Script

To set up the database, run this migration in Supabase SQL Editor:

```sql
-- Create tables
-- (Copy the CREATE TABLE statements from above)

-- Grant necessary permissions
GRANT ALL ON watched_feeds TO authenticated;
GRANT ALL ON trial_updates TO authenticated;
GRANT USAGE ON SEQUENCE watched_feeds_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE trial_updates_id_seq TO authenticated;
```

## Data Flow

```
User adds RSS feed
       ↓
   [watched_feeds table]
       ↓
Daily cron job runs
       ↓
Fetch and parse RSS
       ↓
Check for new/updated trials (last 14 days)
       ↓
For each trial:
  1. Get history page
  2. Extract version numbers (a, b)
  3. Fetch comparison page
  4. Extract diff blocks
  5. Generate LLM summary
       ↓
   [trial_updates table]
       ↓
User views in Realtime Feed UI
```

## Future Enhancements

1. **Email Notifications**: Send email alerts when new updates are found
2. **Webhook Support**: Allow users to configure webhooks for updates
3. **Custom Filters**: Let users filter by specific criteria (phase, status, etc.)
4. **Smart Summaries**: Enhance LLM prompts to categorize changes (enrollment, endpoints, criteria, etc.)
5. **Export**: Allow users to export updates as CSV/PDF
6. **RSS Feed Builder**: Help users construct RSS URLs with a visual builder

## Troubleshooting

### No updates appearing
- Check that the cron job is running (Vercel dashboard → Cron Jobs)
- Verify `CRON_SECRET` is set correctly
- Check cron job logs for errors
- Ensure RSS feed URL is valid

### LLM summaries are generic
- Check that `GOOGLE_GEMINI_API_KEY` is set
- Verify API credits/quota are available
- Improve prompt in `rssFeedService.ts`

### Database errors
- Verify tables exist in Supabase
- Check RLS policies are enabled
- Ensure user is authenticated

