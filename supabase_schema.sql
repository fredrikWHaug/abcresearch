-- Supabase schema for search sessions table
-- This should be run in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS search_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_query TEXT NOT NULL,
  enhanced_queries JSONB NOT NULL,
  results JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_search_sessions_user_id ON search_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_search_sessions_created_at ON search_sessions(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE search_sessions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own search sessions" ON search_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own search sessions" ON search_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own search sessions" ON search_sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own search sessions" ON search_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- Allow anonymous users to create search sessions (for guest mode)
CREATE POLICY "Anonymous users can create search sessions" ON search_sessions
  FOR INSERT WITH CHECK (user_id IS NULL);

CREATE POLICY "Anonymous users can view their own search sessions" ON search_sessions
  FOR SELECT USING (user_id IS NULL);
