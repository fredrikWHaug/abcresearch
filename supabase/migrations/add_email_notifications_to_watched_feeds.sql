-- Add email notification support to watched_feeds table
-- Created: November 27, 2025
-- Purpose: Enable email notifications for clinical trial updates

-- Add notification_email column to store user's email for updates
ALTER TABLE watched_feeds
ADD COLUMN IF NOT EXISTS notification_email TEXT DEFAULT NULL;

-- Add index for efficient email notification queries
CREATE INDEX IF NOT EXISTS idx_watched_feeds_notification_email 
  ON watched_feeds(notification_email) 
  WHERE notification_email IS NOT NULL;

COMMENT ON COLUMN watched_feeds.notification_email IS 'Email address to send daily update notifications. NULL means no notifications.';

-- Add last_email_sent_at to track when we last sent an email for this feed
ALTER TABLE watched_feeds
ADD COLUMN IF NOT EXISTS last_email_sent_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN watched_feeds.last_email_sent_at IS 'Timestamp of last email notification sent for this feed';

-- Add email_sent flag to trial_updates to track which updates have been emailed
ALTER TABLE trial_updates
ADD COLUMN IF NOT EXISTS email_sent BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_trial_updates_email_sent 
  ON trial_updates(feed_id, email_sent, created_at) 
  WHERE email_sent = FALSE;

COMMENT ON COLUMN trial_updates.email_sent IS 'Tracks whether this update has been included in an email notification';

-- Add sponsor column to trial_updates to store lead sponsor name
ALTER TABLE trial_updates
ADD COLUMN IF NOT EXISTS sponsor TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_trial_updates_sponsor 
  ON trial_updates(sponsor) 
  WHERE sponsor IS NOT NULL;

COMMENT ON COLUMN trial_updates.sponsor IS 'Lead sponsor name from ClinicalTrials.gov';

