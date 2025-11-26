-- Create watched_feeds table for RSS feed monitoring
-- This table stores user's subscribed RSS feeds for clinical trial monitoring

CREATE TABLE IF NOT EXISTS watched_feeds (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feed_url TEXT NOT NULL,
  label TEXT NOT NULL,
  last_checked_at TIMESTAMPTZ,
  refresh_status JSONB DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_watched_feeds_user_id ON watched_feeds(user_id);
CREATE INDEX IF NOT EXISTS idx_watched_feeds_feed_url ON watched_feeds(feed_url);
CREATE INDEX IF NOT EXISTS idx_watched_feeds_last_checked ON watched_feeds(last_checked_at DESC);

-- GIN index for efficient JSONB queries on refresh_status
CREATE INDEX IF NOT EXISTS idx_watched_feeds_refresh_status ON watched_feeds USING GIN (refresh_status);

-- Enable Row Level Security
ALTER TABLE watched_feeds ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own watched feeds" ON watched_feeds;
DROP POLICY IF EXISTS "Users can insert their own watched feeds" ON watched_feeds;
DROP POLICY IF EXISTS "Users can update their own watched feeds" ON watched_feeds;
DROP POLICY IF EXISTS "Users can delete their own watched feeds" ON watched_feeds;
DROP POLICY IF EXISTS "Service role can access all watched feeds" ON watched_feeds;

-- Policy 1: Users can view their own watched feeds
CREATE POLICY "Users can view their own watched feeds"
  ON watched_feeds FOR SELECT
  USING (auth.uid() = user_id);

-- Policy 2: Users can insert their own watched feeds
CREATE POLICY "Users can insert their own watched feeds"
  ON watched_feeds FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy 3: Users can update their own watched feeds
CREATE POLICY "Users can update their own watched feeds"
  ON watched_feeds FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy 4: Users can delete their own watched feeds
CREATE POLICY "Users can delete their own watched feeds"
  ON watched_feeds FOR DELETE
  USING (auth.uid() = user_id);

-- Policy 5: Service role can access all feeds (for cron jobs)
CREATE POLICY "Service role can access all watched feeds"
  ON watched_feeds FOR ALL
  USING (auth.uid() IS NULL);

-- Comment on table and columns
COMMENT ON TABLE watched_feeds IS 'Stores user subscriptions to clinical trial RSS feeds';
COMMENT ON COLUMN watched_feeds.user_id IS 'Foreign key to auth.users';
COMMENT ON COLUMN watched_feeds.feed_url IS 'URL of the RSS feed (ClinicalTrials.gov RSS endpoint)';
COMMENT ON COLUMN watched_feeds.label IS 'User-friendly label for the feed';
COMMENT ON COLUMN watched_feeds.last_checked_at IS 'Timestamp of last successful check';
COMMENT ON COLUMN watched_feeds.refresh_status IS 'Tracks refresh progress: {total, processed, in_progress, started_at, completed_at, new_updates, error}';

