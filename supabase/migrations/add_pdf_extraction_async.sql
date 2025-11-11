-- Migration: Add PDF Extraction Async Job Queue System
-- Created: November 10, 2025
-- Purpose: Enable asynchronous PDF extraction with job tracking, progress monitoring, and result persistence

-- 1. PDF Extraction Jobs Table
-- Tracks all PDF extraction job submissions with status and progress
CREATE TABLE pdf_extraction_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id BIGINT REFERENCES projects(id) ON DELETE SET NULL,
  
  -- File information
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  
  -- Job configuration
  enable_graphify BOOLEAN DEFAULT true,
  force_ocr BOOLEAN DEFAULT false,
  max_graphify_images INTEGER DEFAULT 10,
  
  -- Job status and progress
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  current_stage TEXT,  -- e.g., 'uploading', 'analyzing', 'extracting_tables', 'extracting_graphs'
  
  -- Processing details
  datalab_job_id TEXT,  -- External Datalab API job ID
  datalab_check_url TEXT,  -- Polling URL for Datalab job
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. PDF Extraction Results Table
-- Stores completed extraction results linked to jobs
CREATE TABLE pdf_extraction_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES pdf_extraction_jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Extracted content
  markdown_content TEXT,
  
  -- JSON results (stored as JSONB for queryability)
  response_json JSONB,  -- Full Datalab API response
  original_images JSONB,  -- Extracted images with base64 data
  graphify_results JSONB,  -- GPT Vision analysis results
  tables_data JSONB,  -- Parsed table data
  
  -- Statistics
  images_found INTEGER DEFAULT 0,
  graphs_detected INTEGER DEFAULT 0,
  tables_found INTEGER DEFAULT 0,
  processing_time_ms INTEGER,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Indexes for performance
CREATE INDEX idx_pdf_jobs_user_id ON pdf_extraction_jobs(user_id);
CREATE INDEX idx_pdf_jobs_project_id ON pdf_extraction_jobs(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX idx_pdf_jobs_status ON pdf_extraction_jobs(status);
CREATE INDEX idx_pdf_jobs_created_at ON pdf_extraction_jobs(created_at DESC);
CREATE INDEX idx_pdf_jobs_user_status ON pdf_extraction_jobs(user_id, status, created_at DESC);

CREATE INDEX idx_pdf_results_job_id ON pdf_extraction_results(job_id);
CREATE INDEX idx_pdf_results_user_id ON pdf_extraction_results(user_id);
CREATE INDEX idx_pdf_results_created_at ON pdf_extraction_results(created_at DESC);

-- 4. Row Level Security (RLS) Policies
ALTER TABLE pdf_extraction_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pdf_extraction_results ENABLE ROW LEVEL SECURITY;

-- Jobs: Users can only access their own jobs
CREATE POLICY "Users can view their own extraction jobs"
  ON pdf_extraction_jobs
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create extraction jobs"
  ON pdf_extraction_jobs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own extraction jobs"
  ON pdf_extraction_jobs
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own extraction jobs"
  ON pdf_extraction_jobs
  FOR DELETE
  USING (auth.uid() = user_id);

-- Results: Users can only access their own results
CREATE POLICY "Users can view their own extraction results"
  ON pdf_extraction_results
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create extraction results"
  ON pdf_extraction_results
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own extraction results"
  ON pdf_extraction_results
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own extraction results"
  ON pdf_extraction_results
  FOR DELETE
  USING (auth.uid() = user_id);

-- 5. Auto-update timestamp trigger for jobs
CREATE TRIGGER update_pdf_jobs_updated_at
  BEFORE UPDATE ON pdf_extraction_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 6. Auto-update timestamp trigger for results
CREATE TRIGGER update_pdf_results_updated_at
  BEFORE UPDATE ON pdf_extraction_results
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 7. Comments for documentation
COMMENT ON TABLE pdf_extraction_jobs IS 'Tracks PDF extraction job queue with status, progress, and configuration';
COMMENT ON TABLE pdf_extraction_results IS 'Stores completed PDF extraction results including markdown, images, and GPT analysis';

COMMENT ON COLUMN pdf_extraction_jobs.status IS 'Job status: pending, processing, completed, failed, cancelled';
COMMENT ON COLUMN pdf_extraction_jobs.progress IS 'Percentage completion (0-100)';
COMMENT ON COLUMN pdf_extraction_jobs.current_stage IS 'Current processing stage for UI progress display';
COMMENT ON COLUMN pdf_extraction_jobs.retry_count IS 'Number of retry attempts';

COMMENT ON COLUMN pdf_extraction_results.markdown_content IS 'Extracted markdown text from PDF';
COMMENT ON COLUMN pdf_extraction_results.response_json IS 'Full Datalab API response (JSONB)';
COMMENT ON COLUMN pdf_extraction_results.original_images IS 'Extracted images with base64 data (JSONB)';
COMMENT ON COLUMN pdf_extraction_results.graphify_results IS 'GPT Vision analysis results for graphs (JSONB)';
COMMENT ON COLUMN pdf_extraction_results.tables_data IS 'Parsed table data (JSONB)';

