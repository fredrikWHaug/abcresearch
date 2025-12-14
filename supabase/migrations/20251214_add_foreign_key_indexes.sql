-- Migration: Add Missing Foreign Key Indexes
-- Purpose: Fix performance issues - foreign keys without covering indexes cause slow joins
-- Date: 2024-12-14
--
-- ROLLBACK: Run the rollback section at the bottom if needed

-- ============================================================================
-- PART 1: Add Missing Foreign Key Indexes on Junction Tables
-- These are critical for JOIN performance when querying through junction tables
-- ============================================================================

-- Index on project_trials.trial_id for faster joins to trials table
CREATE INDEX IF NOT EXISTS idx_project_trials_trial_id 
ON public.project_trials(trial_id);

-- Index on project_papers.paper_id for faster joins to papers table
CREATE INDEX IF NOT EXISTS idx_project_papers_paper_id 
ON public.project_papers(paper_id);

-- Index on project_drugs.drug_id for faster joins to drugs table
CREATE INDEX IF NOT EXISTS idx_project_drugs_drug_id 
ON public.project_drugs(drug_id);

-- ============================================================================
-- PART 2: Remove Duplicate Index on market_maps
-- market_maps has both market_maps_id_key and market_maps_pkey on the same column
-- ============================================================================

-- Drop the redundant unique constraint (keep the primary key)
ALTER TABLE public.market_maps DROP CONSTRAINT IF EXISTS market_maps_id_key;

-- ============================================================================
-- ROLLBACK SECTION (Run this to undo the migration if needed)
-- ============================================================================
/*
DROP INDEX IF EXISTS public.idx_project_trials_trial_id;
DROP INDEX IF EXISTS public.idx_project_papers_paper_id;
DROP INDEX IF EXISTS public.idx_project_drugs_drug_id;

-- To restore the duplicate index (not recommended):
-- CREATE UNIQUE INDEX market_maps_id_key ON public.market_maps(id);
*/

