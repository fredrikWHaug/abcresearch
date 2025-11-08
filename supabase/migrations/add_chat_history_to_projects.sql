-- Add chat_history column to projects table
-- Allows persisting chat conversations per project across sessions

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS chat_history JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN projects.chat_history IS 'Array of chat messages between user and AI assistant for this project';

-- Create GIN index for efficient JSONB queries (optional, can add later if needed)
-- CREATE INDEX idx_projects_chat_history_gin ON projects USING GIN (chat_history);

