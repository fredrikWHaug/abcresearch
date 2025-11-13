// Press Releases Data Types

export interface PressRelease {
  id: string;
  title: string;
  company: string;
  releaseDate: string;
  summary: string;
  fullText?: string;
  source: string;
  url?: string;

  // Extracted information
  mentionedDrugs?: string[];
  mentionedTrials?: string[];
  keyAnnouncements?: string[];
  financialImpact?: string;
  affectedIndication?: string;

  // Metadata
  relevanceScore: number;
}

export interface PressReleaseSearchParams {
  query: string;
  company?: string;
  startDate?: string; // Format: YYYY-MM-DD
  endDate?: string;   // Format: YYYY-MM-DD
  maxResults?: number; // Default: 30
}

export interface PressReleaseAPIResponse {
  success: boolean;
  count: number;
  results: PressRelease[];
  error?: string;
}
