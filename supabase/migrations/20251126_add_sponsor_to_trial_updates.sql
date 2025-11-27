-- Add sponsor field to trial_updates table
-- This will store the lead sponsor name from ClinicalTrials.gov

ALTER TABLE trial_updates
ADD COLUMN IF NOT EXISTS sponsor TEXT;

-- Comment on new column
COMMENT ON COLUMN trial_updates.sponsor IS 'Lead sponsor name from ClinicalTrials.gov';

