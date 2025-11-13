// Types for Investor Relations Decks (SEC EDGAR filings)

export interface IRDeck {
  id: string;
  company: string;
  ticker?: string;
  title: string;
  filingType: string; // 8-K, 10-K, DEF 14A, etc.
  filingDate: string;
  reportDate?: string;
  description?: string;
  url: string;
  documentUrl?: string;
  relevanceScore: number;
}

export interface IRDeckSearchParams {
  query: string;
  company?: string;
  ticker?: string;
  filingTypes?: string[]; // e.g., ['8-K', 'DEF 14A']
  startDate?: string;
  endDate?: string;
  maxResults?: number;
}

export interface IRDeckSearchResponse {
  irDecks: IRDeck[];
  totalCount: number;
}
