export interface RefreshStatus {
  total: number;
  processed: number;
  in_progress: boolean;
  started_at?: string;
  completed_at?: string;
  new_updates?: number;
  error?: string;
}

export interface WatchedFeed {
  id: number;
  user_id: string;
  feed_url: string;
  label: string;
  created_at: string;
  last_checked_at?: string;
  refresh_status?: RefreshStatus;
}

export interface TrialUpdate {
  id: number;
  feed_id: number;
  nct_id: string;
  title: string;
  last_update: string;
  study_url: string;
  history_url: string;
  comparison_url: string;
  version_a: number;
  version_b: number;
  raw_diff_blocks: string[];
  llm_summary: string;
  sponsor?: string;
  created_at: string;
}

export interface TimelineItem {
  date: string;
  updates: TrialUpdate[];
}

