-- Migration: Add junction tables for drug-entity associations
-- Created: 2025-11-23
-- Purpose: Store explicit relationships between drugs and trials/papers/press_releases/ir_decks
--          This replaces text-based matching with proper database relationships

-- ============================================================================
-- 1. Drug-Trial Junction Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS drug_trials (
  drug_id INTEGER NOT NULL REFERENCES drugs(id) ON DELETE CASCADE,
  trial_id INTEGER NOT NULL REFERENCES trials(id) ON DELETE CASCADE,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (drug_id, trial_id, project_id)
);

-- Indexes for efficient queries
CREATE INDEX idx_drug_trials_drug_project ON drug_trials(drug_id, project_id);
CREATE INDEX idx_drug_trials_trial_project ON drug_trials(trial_id, project_id);
CREATE INDEX idx_drug_trials_project ON drug_trials(project_id);

COMMENT ON TABLE drug_trials IS 'Junction table linking drugs to trials within a project context';
COMMENT ON COLUMN drug_trials.drug_id IS 'Foreign key to drugs table';
COMMENT ON COLUMN drug_trials.trial_id IS 'Foreign key to trials table';
COMMENT ON COLUMN drug_trials.project_id IS 'Foreign key to projects table - scopes the association to a specific project';
COMMENT ON COLUMN drug_trials.added_at IS 'Timestamp when this association was created';

-- ============================================================================
-- 2. Drug-Paper Junction Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS drug_papers (
  drug_id INTEGER NOT NULL REFERENCES drugs(id) ON DELETE CASCADE,
  paper_id INTEGER NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (drug_id, paper_id, project_id)
);

-- Indexes for efficient queries
CREATE INDEX idx_drug_papers_drug_project ON drug_papers(drug_id, project_id);
CREATE INDEX idx_drug_papers_paper_project ON drug_papers(paper_id, project_id);
CREATE INDEX idx_drug_papers_project ON drug_papers(project_id);

COMMENT ON TABLE drug_papers IS 'Junction table linking drugs to papers within a project context';
COMMENT ON COLUMN drug_papers.drug_id IS 'Foreign key to drugs table';
COMMENT ON COLUMN drug_papers.paper_id IS 'Foreign key to papers table';
COMMENT ON COLUMN drug_papers.project_id IS 'Foreign key to projects table - scopes the association to a specific project';
COMMENT ON COLUMN drug_papers.added_at IS 'Timestamp when this association was created';

-- ============================================================================
-- 3. Press Releases Table (if not exists)
-- ============================================================================
CREATE TABLE IF NOT EXISTS press_releases (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT,
  company TEXT,
  release_date TEXT,
  url TEXT,
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_press_releases_company ON press_releases(company);
CREATE INDEX IF NOT EXISTS idx_press_releases_release_date ON press_releases(release_date);

COMMENT ON TABLE press_releases IS 'Stores press release data from company announcements';

-- ============================================================================
-- 4. Drug-Press Release Junction Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS drug_press_releases (
  drug_id INTEGER NOT NULL REFERENCES drugs(id) ON DELETE CASCADE,
  press_release_id INTEGER NOT NULL REFERENCES press_releases(id) ON DELETE CASCADE,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (drug_id, press_release_id, project_id)
);

-- Indexes for efficient queries
CREATE INDEX idx_drug_press_releases_drug_project ON drug_press_releases(drug_id, project_id);
CREATE INDEX idx_drug_press_releases_pr_project ON drug_press_releases(press_release_id, project_id);
CREATE INDEX idx_drug_press_releases_project ON drug_press_releases(project_id);

COMMENT ON TABLE drug_press_releases IS 'Junction table linking drugs to press releases within a project context';
COMMENT ON COLUMN drug_press_releases.drug_id IS 'Foreign key to drugs table';
COMMENT ON COLUMN drug_press_releases.press_release_id IS 'Foreign key to press_releases table';
COMMENT ON COLUMN drug_press_releases.project_id IS 'Foreign key to projects table - scopes the association to a specific project';
COMMENT ON COLUMN drug_press_releases.added_at IS 'Timestamp when this association was created';

-- ============================================================================
-- 5. IR Decks Table (if not exists)
-- ============================================================================
CREATE TABLE IF NOT EXISTS ir_decks (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  company TEXT,
  description TEXT,
  url TEXT,
  deck_date TEXT,
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ir_decks_company ON ir_decks(company);
CREATE INDEX IF NOT EXISTS idx_ir_decks_deck_date ON ir_decks(deck_date);

COMMENT ON TABLE ir_decks IS 'Stores investor relations deck data from companies';

-- ============================================================================
-- 6. Drug-IR Deck Junction Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS drug_ir_decks (
  drug_id INTEGER NOT NULL REFERENCES drugs(id) ON DELETE CASCADE,
  ir_deck_id INTEGER NOT NULL REFERENCES ir_decks(id) ON DELETE CASCADE,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (drug_id, ir_deck_id, project_id)
);

-- Indexes for efficient queries
CREATE INDEX idx_drug_ir_decks_drug_project ON drug_ir_decks(drug_id, project_id);
CREATE INDEX idx_drug_ir_decks_ir_project ON drug_ir_decks(ir_deck_id, project_id);
CREATE INDEX idx_drug_ir_decks_project ON drug_ir_decks(project_id);

COMMENT ON TABLE drug_ir_decks IS 'Junction table linking drugs to IR decks within a project context';
COMMENT ON COLUMN drug_ir_decks.drug_id IS 'Foreign key to drugs table';
COMMENT ON COLUMN drug_ir_decks.ir_deck_id IS 'Foreign key to ir_decks table';
COMMENT ON COLUMN drug_ir_decks.project_id IS 'Foreign key to projects table - scopes the association to a specific project';
COMMENT ON COLUMN drug_ir_decks.added_at IS 'Timestamp when this association was created';

-- ============================================================================
-- 7. Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on all junction tables
ALTER TABLE drug_trials ENABLE ROW LEVEL SECURITY;
ALTER TABLE drug_papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE drug_press_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE drug_ir_decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE press_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE ir_decks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for drug_trials
CREATE POLICY "Users can view drug_trials for their projects"
  ON drug_trials FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert drug_trials for their projects"
  ON drug_trials FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete drug_trials for their projects"
  ON drug_trials FOR DELETE
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for drug_papers
CREATE POLICY "Users can view drug_papers for their projects"
  ON drug_papers FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert drug_papers for their projects"
  ON drug_papers FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete drug_papers for their projects"
  ON drug_papers FOR DELETE
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for drug_press_releases
CREATE POLICY "Users can view drug_press_releases for their projects"
  ON drug_press_releases FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert drug_press_releases for their projects"
  ON drug_press_releases FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete drug_press_releases for their projects"
  ON drug_press_releases FOR DELETE
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for drug_ir_decks
CREATE POLICY "Users can view drug_ir_decks for their projects"
  ON drug_ir_decks FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert drug_ir_decks for their projects"
  ON drug_ir_decks FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete drug_ir_decks for their projects"
  ON drug_ir_decks FOR DELETE
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for press_releases (public read, authenticated write)
CREATE POLICY "Anyone can view press_releases"
  ON press_releases FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert press_releases"
  ON press_releases FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- RLS Policies for ir_decks (public read, authenticated write)
CREATE POLICY "Anyone can view ir_decks"
  ON ir_decks FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert ir_decks"
  ON ir_decks FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

