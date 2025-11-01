-- Add INSERT policy for trial_updates table
-- This allows the cron job (service role) and authenticated users to insert updates

-- Policy 1: Allow service role to insert (used by cron job)
-- Note: Service role bypasses RLS, but this is for clarity

-- Policy 2: Allow authenticated users to insert updates for their own watched feeds
CREATE POLICY "Users can insert updates for their watched feeds"
  ON trial_updates FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM watched_feeds
      WHERE watched_feeds.id = trial_updates.feed_id
      AND watched_feeds.user_id = auth.uid()
    )
  );

-- Policy 3: Allow system/cron to insert updates (using service role)
-- This policy allows inserts when there's no auth.uid() (service role context)
CREATE POLICY "Service role can insert trial updates"
  ON trial_updates FOR INSERT
  WITH CHECK (true);

-- Drop and recreate the policy to handle both cases properly
DROP POLICY IF EXISTS "Users can insert updates for their watched feeds" ON trial_updates;
DROP POLICY IF EXISTS "Service role can insert trial updates" ON trial_updates;

-- Create a combined policy that works for both authenticated users and service role
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

