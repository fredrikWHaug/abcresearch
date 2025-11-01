# Realtime Feed - Quick Start Guide

This is a simplified guide to get the Realtime Feed feature up and running quickly.

## What Does It Do?

The Realtime Feed monitors [ClinicalTrials.gov](https://clinicaltrials.gov/api/rss?intr=Orforglipron&locStr=USA&country=US&dateField=LastUpdatePostDate) for updates to clinical trials you care about. When trials are updated, it:

1. ✅ Detects what changed (enrollment, phase, criteria, etc.)
2. ✅ Generates AI summaries of the changes using Gemini
3. ✅ Displays a timeline of all updates
4. ✅ Provides direct links to view the detailed diffs

## 5-Minute Setup

### 1. Create Database Tables

In Supabase SQL Editor, run:

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

GRANT ALL ON watched_feeds TO authenticated;
GRANT ALL ON trial_updates TO authenticated;
GRANT USAGE ON SEQUENCE watched_feeds_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE trial_updates_id_seq TO authenticated;
```

### 2. Add Environment Variables in Vercel

Go to Vercel Dashboard → Your Project → Settings → Environment Variables

Add these three:

```
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_from_supabase
CRON_SECRET=any_random_string_64_chars_long
GOOGLE_GEMINI_API_KEY=your_gemini_api_key
```

**Get Supabase Service Role Key:**
- Supabase Dashboard → Settings → API → Copy "service_role" key

**Generate CRON_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Get Gemini API Key:**
- Go to https://makersuite.google.com/app/apikey
- Create new API key

### 3. Deploy

```bash
git add .
git commit -m "Add Realtime Feed feature"
git push origin main
```

Vercel will automatically deploy.

### 4. Use It!

1. Open your app → Click "Realtime Feed" tab
2. Click "Watch New Feed"
3. Enter a drug name like `Orforglipron` or `Semaglutide`
4. Click "Start Watching"

The system will:
- Monitor trials with that drug in the USA
- Check daily at midnight UTC
- Show updates in the timeline

## Example: Watching Orforglipron Trials

When you enter `Orforglipron` as the search term, the system:

1. Creates this RSS feed: `https://clinicaltrials.gov/api/rss?intr=Orforglipron&locStr=USA&country=US&dateField=LastUpdatePostDate`
2. Checks it daily for trials updated in the last 14 days
3. For each updated trial:
   - Scrapes the history page to find version numbers
   - Fetches the comparison page showing what changed
   - Uses Gemini AI to summarize the changes
   - Saves to your timeline

## What You'll See

The timeline shows cards like:

```
┌─────────────────────────────────────────────────┐
│ October 30, 2025                                │
├─────────────────────────────────────────────────┤
│ NCT06192108  v19 → v20                         │
│                                                  │
│ Study of Orforglipron Compared With...         │
│                                                  │
│ ✨ AI Summary:                                  │
│ The study status changed from Active to        │
│ Completed. Enrollment numbers increased from    │
│ 240 to 250 participants.                       │
│                                                  │
│ 🔗 View Study | History | View Diff            │
└─────────────────────────────────────────────────┘
```

## FAQ

**Q: How often does it check for updates?**
A: Daily at midnight UTC. You can change this in `vercel.json`.

**Q: Can I watch multiple drugs?**
A: Yes! Add as many as you want. Each gets its own timeline.

**Q: What if I want to monitor a condition instead of a drug?**
A: Just enter the condition name (e.g., "Type 2 Diabetes"). The system uses it as an intervention search.

**Q: Can I change the location from USA?**
A: Currently hardcoded to USA. To change, edit `api/rss-feed-watch.ts` lines 64-65.

**Q: What if no updates appear?**
A: Updates only show if trials were modified in the last 14 days. Check the [actual RSS feed](https://clinicaltrials.gov/api/rss?intr=Orforglipron&locStr=USA&country=US&dateField=LastUpdatePostDate) to see if there are any updates.

## Troubleshooting

**Module import errors:**
✅ Fixed! All utilities are now in `api/utils/rss-feed-utils.ts`

**Cron job not running:**
- Check Vercel Dashboard → Cron Jobs
- Verify `CRON_SECRET` is set

**No updates showing:**
- Check cron job logs in Vercel
- Verify the trials have actually been updated in last 14 days
- Test the RSS feed URL manually in your browser

**Gemini errors:**
- Verify `GOOGLE_GEMINI_API_KEY` is set
- Check you have API quota available

## That's It! 🎉

The feature is production-ready and will start monitoring trials as soon as you add your first search term.

For detailed documentation, see `REALTIME_FEED_SETUP.md` and `documentation/10-realtime-feed-schema.md`.

