-- Migration: Optimize RLS Policies
-- Purpose: Replace auth.uid() with (select auth.uid()) for performance
--          Remove duplicate policies on trial_updates
-- Date: 2024-12-14
--
-- Why this matters: auth.uid() is re-evaluated for every row when used directly.
-- Using (select auth.uid()) caches the value once per query, dramatically improving
-- performance at scale.

-- ============================================================================
-- PART 1: Fix duplicate INSERT policies on trial_updates
-- ============================================================================

-- Drop the duplicate policy (keeping "Users can insert updates for their watched feeds")
DROP POLICY IF EXISTS "Insert trial updates for watched feeds" ON public.trial_updates;

-- ============================================================================
-- PART 2: Optimize market_maps policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can manage their own market maps" ON public.market_maps;
CREATE POLICY "Users can manage their own market maps"
ON public.market_maps FOR ALL TO authenticated
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================================
-- PART 3: Optimize projects policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their own projects" ON public.projects;
CREATE POLICY "Users can view their own projects"
ON public.projects FOR SELECT
USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create their own projects" ON public.projects;
CREATE POLICY "Users can create their own projects"
ON public.projects FOR INSERT
WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own projects" ON public.projects;
CREATE POLICY "Users can update their own projects"
ON public.projects FOR UPDATE
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own projects" ON public.projects;
CREATE POLICY "Users can delete their own projects"
ON public.projects FOR DELETE
USING ((select auth.uid()) = user_id);

-- ============================================================================
-- PART 4: Optimize watched_feeds policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their own watched feeds" ON public.watched_feeds;
CREATE POLICY "Users can view their own watched feeds"
ON public.watched_feeds FOR SELECT
USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own watched feeds" ON public.watched_feeds;
CREATE POLICY "Users can insert their own watched feeds"
ON public.watched_feeds FOR INSERT
WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own watched feeds" ON public.watched_feeds;
CREATE POLICY "Users can update their own watched feeds"
ON public.watched_feeds FOR UPDATE
USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own watched feeds" ON public.watched_feeds;
CREATE POLICY "Users can delete their own watched feeds"
ON public.watched_feeds FOR DELETE
USING ((select auth.uid()) = user_id);

-- ============================================================================
-- PART 5: Optimize trial_updates policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view updates for their watched feeds" ON public.trial_updates;
CREATE POLICY "Users can view updates for their watched feeds"
ON public.trial_updates FOR SELECT
USING (EXISTS (
  SELECT 1 FROM watched_feeds
  WHERE watched_feeds.id = trial_updates.feed_id
  AND watched_feeds.user_id = (select auth.uid())
));

DROP POLICY IF EXISTS "Users can insert updates for their watched feeds" ON public.trial_updates;
CREATE POLICY "Users can insert updates for their watched feeds"
ON public.trial_updates FOR INSERT
WITH CHECK (
  (select auth.uid()) IS NULL 
  OR EXISTS (
    SELECT 1 FROM watched_feeds
    WHERE watched_feeds.id = trial_updates.feed_id
    AND watched_feeds.user_id = (select auth.uid())
  )
);

-- ============================================================================
-- PART 6: Optimize pdf_extraction_jobs policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their own extraction jobs" ON public.pdf_extraction_jobs;
CREATE POLICY "Users can view their own extraction jobs"
ON public.pdf_extraction_jobs FOR SELECT
USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create extraction jobs" ON public.pdf_extraction_jobs;
CREATE POLICY "Users can create extraction jobs"
ON public.pdf_extraction_jobs FOR INSERT
WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own extraction jobs" ON public.pdf_extraction_jobs;
CREATE POLICY "Users can update their own extraction jobs"
ON public.pdf_extraction_jobs FOR UPDATE
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own extraction jobs" ON public.pdf_extraction_jobs;
CREATE POLICY "Users can delete their own extraction jobs"
ON public.pdf_extraction_jobs FOR DELETE
USING ((select auth.uid()) = user_id);

-- ============================================================================
-- PART 7: Optimize pdf_extraction_results policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their own extraction results" ON public.pdf_extraction_results;
CREATE POLICY "Users can view their own extraction results"
ON public.pdf_extraction_results FOR SELECT
USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create extraction results" ON public.pdf_extraction_results;
CREATE POLICY "Users can create extraction results"
ON public.pdf_extraction_results FOR INSERT
WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own extraction results" ON public.pdf_extraction_results;
CREATE POLICY "Users can update their own extraction results"
ON public.pdf_extraction_results FOR UPDATE
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own extraction results" ON public.pdf_extraction_results;
CREATE POLICY "Users can delete their own extraction results"
ON public.pdf_extraction_results FOR DELETE
USING ((select auth.uid()) = user_id);

-- ============================================================================
-- PART 8: Optimize drug_trials policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view drug_trials for their projects" ON public.drug_trials;
CREATE POLICY "Users can view drug_trials for their projects"
ON public.drug_trials FOR SELECT
USING (project_id IN (
  SELECT id FROM projects WHERE user_id = (select auth.uid())
));

DROP POLICY IF EXISTS "Users can insert drug_trials for their projects" ON public.drug_trials;
CREATE POLICY "Users can insert drug_trials for their projects"
ON public.drug_trials FOR INSERT
WITH CHECK (project_id IN (
  SELECT id FROM projects WHERE user_id = (select auth.uid())
));

DROP POLICY IF EXISTS "Users can delete drug_trials for their projects" ON public.drug_trials;
CREATE POLICY "Users can delete drug_trials for their projects"
ON public.drug_trials FOR DELETE
USING (project_id IN (
  SELECT id FROM projects WHERE user_id = (select auth.uid())
));

-- ============================================================================
-- PART 9: Optimize drug_papers policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view drug_papers for their projects" ON public.drug_papers;
CREATE POLICY "Users can view drug_papers for their projects"
ON public.drug_papers FOR SELECT
USING (project_id IN (
  SELECT id FROM projects WHERE user_id = (select auth.uid())
));

DROP POLICY IF EXISTS "Users can insert drug_papers for their projects" ON public.drug_papers;
CREATE POLICY "Users can insert drug_papers for their projects"
ON public.drug_papers FOR INSERT
WITH CHECK (project_id IN (
  SELECT id FROM projects WHERE user_id = (select auth.uid())
));

DROP POLICY IF EXISTS "Users can delete drug_papers for their projects" ON public.drug_papers;
CREATE POLICY "Users can delete drug_papers for their projects"
ON public.drug_papers FOR DELETE
USING (project_id IN (
  SELECT id FROM projects WHERE user_id = (select auth.uid())
));

-- ============================================================================
-- PART 10: Optimize drug_press_releases policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view drug_press_releases for their projects" ON public.drug_press_releases;
CREATE POLICY "Users can view drug_press_releases for their projects"
ON public.drug_press_releases FOR SELECT
USING (project_id IN (
  SELECT id FROM projects WHERE user_id = (select auth.uid())
));

DROP POLICY IF EXISTS "Users can insert drug_press_releases for their projects" ON public.drug_press_releases;
CREATE POLICY "Users can insert drug_press_releases for their projects"
ON public.drug_press_releases FOR INSERT
WITH CHECK (project_id IN (
  SELECT id FROM projects WHERE user_id = (select auth.uid())
));

DROP POLICY IF EXISTS "Users can delete drug_press_releases for their projects" ON public.drug_press_releases;
CREATE POLICY "Users can delete drug_press_releases for their projects"
ON public.drug_press_releases FOR DELETE
USING (project_id IN (
  SELECT id FROM projects WHERE user_id = (select auth.uid())
));

-- ============================================================================
-- PART 11: Optimize drug_ir_decks policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view drug_ir_decks for their projects" ON public.drug_ir_decks;
CREATE POLICY "Users can view drug_ir_decks for their projects"
ON public.drug_ir_decks FOR SELECT
USING (project_id IN (
  SELECT id FROM projects WHERE user_id = (select auth.uid())
));

DROP POLICY IF EXISTS "Users can insert drug_ir_decks for their projects" ON public.drug_ir_decks;
CREATE POLICY "Users can insert drug_ir_decks for their projects"
ON public.drug_ir_decks FOR INSERT
WITH CHECK (project_id IN (
  SELECT id FROM projects WHERE user_id = (select auth.uid())
));

DROP POLICY IF EXISTS "Users can delete drug_ir_decks for their projects" ON public.drug_ir_decks;
CREATE POLICY "Users can delete drug_ir_decks for their projects"
ON public.drug_ir_decks FOR DELETE
USING (project_id IN (
  SELECT id FROM projects WHERE user_id = (select auth.uid())
));

-- ============================================================================
-- PART 12: Optimize press_releases policies
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated users can insert press_releases" ON public.press_releases;
CREATE POLICY "Authenticated users can insert press_releases"
ON public.press_releases FOR INSERT
WITH CHECK ((select auth.role()) = 'authenticated');

-- ============================================================================
-- PART 13: Optimize ir_decks policies
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated users can insert ir_decks" ON public.ir_decks;
CREATE POLICY "Authenticated users can insert ir_decks"
ON public.ir_decks FOR INSERT
WITH CHECK ((select auth.role()) = 'authenticated');

