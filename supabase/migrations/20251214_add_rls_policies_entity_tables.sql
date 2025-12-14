-- Migration: Add RLS Policies to Entity Tables
-- Purpose: Fix critical security vulnerabilities - tables exposed without access control
-- Date: 2024-12-14
-- 
-- ROLLBACK: Run the rollback section at the bottom if needed

-- ============================================================================
-- PART 1: Enable RLS on Entity Tables (trials, papers, drugs)
-- ============================================================================

-- Enable RLS on trials table
ALTER TABLE public.trials ENABLE ROW LEVEL SECURITY;

-- Enable RLS on papers table
ALTER TABLE public.papers ENABLE ROW LEVEL SECURITY;

-- Enable RLS on drugs table
ALTER TABLE public.drugs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PART 2: Enable RLS on Junction Tables (project_trials, project_papers, project_drugs)
-- ============================================================================

-- Enable RLS on project_trials table
ALTER TABLE public.project_trials ENABLE ROW LEVEL SECURITY;

-- Enable RLS on project_papers table
ALTER TABLE public.project_papers ENABLE ROW LEVEL SECURITY;

-- Enable RLS on project_drugs table
ALTER TABLE public.project_drugs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PART 3: Policies for Entity Tables (trials, papers, drugs)
-- These contain public research data from ClinicalTrials.gov and PubMed
-- All authenticated users can read/write (data is public, isolation is via junction tables)
-- Using (select auth.uid()) for performance optimization
-- ============================================================================

-- TRIALS policies
CREATE POLICY "Authenticated users can view trials"
ON public.trials FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert trials"
ON public.trials FOR INSERT TO authenticated
WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can update trials"
ON public.trials FOR UPDATE TO authenticated
USING (true)
WITH CHECK ((select auth.uid()) IS NOT NULL);

-- PAPERS policies
CREATE POLICY "Authenticated users can view papers"
ON public.papers FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert papers"
ON public.papers FOR INSERT TO authenticated
WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can update papers"
ON public.papers FOR UPDATE TO authenticated
USING (true)
WITH CHECK ((select auth.uid()) IS NOT NULL);

-- DRUGS policies
CREATE POLICY "Authenticated users can view drugs"
ON public.drugs FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert drugs"
ON public.drugs FOR INSERT TO authenticated
WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can update drugs"
ON public.drugs FOR UPDATE TO authenticated
USING (true)
WITH CHECK ((select auth.uid()) IS NOT NULL);

-- ============================================================================
-- PART 4: Policies for Junction Tables (project_trials, project_papers, project_drugs)
-- These link entities to projects - must be scoped to user's own projects
-- ============================================================================

-- PROJECT_TRIALS policies
CREATE POLICY "Users can view project_trials for their projects"
ON public.project_trials FOR SELECT TO authenticated
USING (
  project_id IN (
    SELECT id FROM public.projects WHERE user_id = (select auth.uid())
  )
);

CREATE POLICY "Users can insert project_trials for their projects"
ON public.project_trials FOR INSERT TO authenticated
WITH CHECK (
  project_id IN (
    SELECT id FROM public.projects WHERE user_id = (select auth.uid())
  )
);

CREATE POLICY "Users can delete project_trials for their projects"
ON public.project_trials FOR DELETE TO authenticated
USING (
  project_id IN (
    SELECT id FROM public.projects WHERE user_id = (select auth.uid())
  )
);

-- PROJECT_PAPERS policies
CREATE POLICY "Users can view project_papers for their projects"
ON public.project_papers FOR SELECT TO authenticated
USING (
  project_id IN (
    SELECT id FROM public.projects WHERE user_id = (select auth.uid())
  )
);

CREATE POLICY "Users can insert project_papers for their projects"
ON public.project_papers FOR INSERT TO authenticated
WITH CHECK (
  project_id IN (
    SELECT id FROM public.projects WHERE user_id = (select auth.uid())
  )
);

CREATE POLICY "Users can delete project_papers for their projects"
ON public.project_papers FOR DELETE TO authenticated
USING (
  project_id IN (
    SELECT id FROM public.projects WHERE user_id = (select auth.uid())
  )
);

-- PROJECT_DRUGS policies
CREATE POLICY "Users can view project_drugs for their projects"
ON public.project_drugs FOR SELECT TO authenticated
USING (
  project_id IN (
    SELECT id FROM public.projects WHERE user_id = (select auth.uid())
  )
);

CREATE POLICY "Users can insert project_drugs for their projects"
ON public.project_drugs FOR INSERT TO authenticated
WITH CHECK (
  project_id IN (
    SELECT id FROM public.projects WHERE user_id = (select auth.uid())
  )
);

CREATE POLICY "Users can delete project_drugs for their projects"
ON public.project_drugs FOR DELETE TO authenticated
USING (
  project_id IN (
    SELECT id FROM public.projects WHERE user_id = (select auth.uid())
  )
);

-- ============================================================================
-- PART 5: Fix search_sessions table (RLS enabled but no policies)
-- ============================================================================

CREATE POLICY "Users can view their own search sessions"
ON public.search_sessions FOR SELECT TO authenticated
USING ("userID" = (select auth.uid()));

CREATE POLICY "Users can insert their own search sessions"
ON public.search_sessions FOR INSERT TO authenticated
WITH CHECK ("userID" = (select auth.uid()));

CREATE POLICY "Users can update their own search sessions"
ON public.search_sessions FOR UPDATE TO authenticated
USING ("userID" = (select auth.uid()))
WITH CHECK ("userID" = (select auth.uid()));

CREATE POLICY "Users can delete their own search sessions"
ON public.search_sessions FOR DELETE TO authenticated
USING ("userID" = (select auth.uid()));

-- ============================================================================
-- PART 6: Fix function search_path security
-- ============================================================================

-- Set immutable search_path on update_updated_at_column function
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;

-- ============================================================================
-- ROLLBACK SECTION (Run this to undo the migration if needed)
-- ============================================================================
/*
-- Remove policies from trials
DROP POLICY IF EXISTS "Authenticated users can view trials" ON public.trials;
DROP POLICY IF EXISTS "Authenticated users can insert trials" ON public.trials;
DROP POLICY IF EXISTS "Authenticated users can update trials" ON public.trials;

-- Remove policies from papers
DROP POLICY IF EXISTS "Authenticated users can view papers" ON public.papers;
DROP POLICY IF EXISTS "Authenticated users can insert papers" ON public.papers;
DROP POLICY IF EXISTS "Authenticated users can update papers" ON public.papers;

-- Remove policies from drugs
DROP POLICY IF EXISTS "Authenticated users can view drugs" ON public.drugs;
DROP POLICY IF EXISTS "Authenticated users can insert drugs" ON public.drugs;
DROP POLICY IF EXISTS "Authenticated users can update drugs" ON public.drugs;

-- Remove policies from project_trials
DROP POLICY IF EXISTS "Users can view project_trials for their projects" ON public.project_trials;
DROP POLICY IF EXISTS "Users can insert project_trials for their projects" ON public.project_trials;
DROP POLICY IF EXISTS "Users can delete project_trials for their projects" ON public.project_trials;

-- Remove policies from project_papers
DROP POLICY IF EXISTS "Users can view project_papers for their projects" ON public.project_papers;
DROP POLICY IF EXISTS "Users can insert project_papers for their projects" ON public.project_papers;
DROP POLICY IF EXISTS "Users can delete project_papers for their projects" ON public.project_papers;

-- Remove policies from project_drugs
DROP POLICY IF EXISTS "Users can view project_drugs for their projects" ON public.project_drugs;
DROP POLICY IF EXISTS "Users can insert project_drugs for their projects" ON public.project_drugs;
DROP POLICY IF EXISTS "Users can delete project_drugs for their projects" ON public.project_drugs;

-- Remove policies from search_sessions
DROP POLICY IF EXISTS "Users can view their own search sessions" ON public.search_sessions;
DROP POLICY IF EXISTS "Users can insert their own search sessions" ON public.search_sessions;
DROP POLICY IF EXISTS "Users can update their own search sessions" ON public.search_sessions;
DROP POLICY IF EXISTS "Users can delete their own search sessions" ON public.search_sessions;

-- Disable RLS
ALTER TABLE public.trials DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.papers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.drugs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_trials DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_papers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_drugs DISABLE ROW LEVEL SECURITY;

-- Reset function search_path
ALTER FUNCTION public.update_updated_at_column() RESET search_path;
*/

