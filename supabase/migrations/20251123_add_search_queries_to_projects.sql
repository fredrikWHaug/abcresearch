-- Migration: Add search_queries column to projects table
-- Created: 2025-11-23
-- Purpose: Store the latest search query and strategies for each project
--          This allows preserving search context when switching between projects

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS search_queries JSONB DEFAULT NULL;

COMMENT ON COLUMN projects.search_queries IS 'Latest search query and strategies for this project. Structure: { originalQuery: string, strategies: StrategyResult[] }';

-- Create GIN index for efficient JSONB queries (optional, useful for searching within queries)
CREATE INDEX IF NOT EXISTS idx_projects_search_queries_gin ON projects USING GIN (search_queries);

