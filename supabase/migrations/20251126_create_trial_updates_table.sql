-- Create trial_updates table for RSS feed monitoring
-- This table stores parsed clinical trial updates from watched RSS feeds

CREATE TABLE IF NOT EXISTS trial_updates (
  id BIGSERIAL PRIMARY KEY,
  feed_id BIGINT NOT NULL REFERENCES watched_feeds(id) ON DELETE CASCADE,
  nct_id TEXT NOT NULL,
  title TEXT NOT NULL,
  last_update TIMESTAMPTZ NOT NULL,
  study_url TEXT NOT NULL,
  history_url TEXT NOT NULL,
  comparison_url TEXT,
  version_a INTEGER NOT NULL,
  version_b INTEGER NOT NULL,
  raw_diff_blocks TEXT[],
  llm_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(feed_id, nct_id, last_update)
);

-- Add indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_trial_updates_feed_id ON trial_updates(feed_id);
CREATE INDEX IF NOT EXISTS idx_trial_updates_nct_id ON trial_updates(nct_id);
CREATE INDEX IF NOT EXISTS idx_trial_updates_last_update ON trial_updates(last_update DESC);

-- Enable Row Level Security
ALTER TABLE trial_updates ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view updates for their watched feeds" ON trial_updates;
DROP POLICY IF EXISTS "Users can insert updates for their watched feeds" ON trial_updates;
DROP POLICY IF EXISTS "Service role can insert trial updates" ON trial_updates;
DROP POLICY IF EXISTS "Insert trial updates for watched feeds" ON trial_updates;

-- Policy 1: Users can view updates for their own watched feeds
CREATE POLICY "Users can view updates for their watched feeds"
  ON trial_updates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM watched_feeds
      WHERE watched_feeds.id = trial_updates.feed_id
      AND watched_feeds.user_id = auth.uid()
    )
  );

-- Policy 2: Users can insert updates for their own watched feeds
-- Service role (auth.uid() IS NULL) can also insert (for cron jobs)
CREATE POLICY "Users can insert updates for their watched feeds"
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

-- Comment on table
COMMENT ON TABLE trial_updates IS 'Stores parsed clinical trial updates from watched RSS feeds';
COMMENT ON COLUMN trial_updates.feed_id IS 'Foreign key to watched_feeds table';
COMMENT ON COLUMN trial_updates.nct_id IS 'ClinicalTrials.gov NCT ID (e.g., NCT12345678)';
COMMENT ON COLUMN trial_updates.last_update IS 'Timestamp of the trial update';
COMMENT ON COLUMN trial_updates.version_a IS 'Previous version number for comparison';
COMMENT ON COLUMN trial_updates.version_b IS 'Latest version number';
COMMENT ON COLUMN trial_updates.raw_diff_blocks IS 'Raw HTML diff blocks from comparison page';
COMMENT ON COLUMN trial_updates.llm_summary IS 'AI-generated summary of changes';

