-- Add refresh_status JSONB column to watched_feeds table
-- This column tracks progress of background feed refresh operations

ALTER TABLE watched_feeds
ADD COLUMN IF NOT EXISTS refresh_status JSONB DEFAULT NULL;

COMMENT ON COLUMN watched_feeds.refresh_status IS 'Tracks refresh progress: {total: number, processed: number, in_progress: boolean, started_at: string, completed_at: string, new_updates: number, error: string}';

-- Create GIN index for efficient JSONB queries
CREATE INDEX IF NOT EXISTS idx_watched_feeds_refresh_status ON watched_feeds USING GIN (refresh_status);

