-- Mark JSONB columns as deprecated (Nov 8, 2025)
-- These columns remain for backwards compatibility during transition period
-- New data writes to both JSONB (legacy) and normalized tables (trials, papers, drugs)
-- Planned removal: 2-4 weeks after full transition verified

-- Deprecate trials_data JSONB column
COMMENT ON COLUMN market_maps.trials_data IS 'DEPRECATED: Use trials table + project_trials junction instead. Maintained for backwards compatibility during migration period. Will be removed after transition verified.';

-- Deprecate papers_data JSONB column
COMMENT ON COLUMN market_maps.papers_data IS 'DEPRECATED: Use papers table + project_papers junction instead. Maintained for backwards compatibility during migration period. Will be removed after transition verified.';

-- Note: drugs_data column does not exist yet, will be deprecated when implemented
-- COMMENT ON COLUMN market_maps.drugs_data IS 'DEPRECATED: Use drugs table + project_drugs junction instead.';

-- Log deprecation
DO $$
BEGIN
  RAISE NOTICE 'JSONB columns marked as deprecated. Transition period: 2-4 weeks.';
  RAISE NOTICE 'System now uses dual-write: JSONB (legacy) + normalized tables (new).';
  RAISE NOTICE 'UI reads from normalized tables with automatic JSONB fallback.';
END $$;

