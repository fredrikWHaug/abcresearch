-- Allow NULL values in comparison_url column
-- This is needed because new trials don't have a comparison URL (only one version exists)

ALTER TABLE trial_updates
ALTER COLUMN comparison_url DROP NOT NULL;

