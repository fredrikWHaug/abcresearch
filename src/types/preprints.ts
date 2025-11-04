// bioRxiv / medRxiv Preprints Data Types

export interface BioRxivPreprint {
  doi: string;
  title: string;
  abstract: string;
  authors: string[];
  authorCorresponding: string;
  date: string; // Publication date
  version: string;
  category: string; // e.g., "bioinformatics", "neuroscience"
  server: 'biorxiv' | 'medrxiv'; // Which server the preprint is from
  relevanceScore: number;
  fullTextLinks: {
    biorxiv?: string;
    medrxiv?: string;
    doi: string;
  };
}

export interface BioRxivSearchParams {
  query: string;
  server?: 'biorxiv' | 'medrxiv' | 'both'; // Default: both
  startDate?: string; // Format: YYYY-MM-DD
  endDate?: string;   // Format: YYYY-MM-DD
  maxResults?: number; // Default: 30
}

export interface BioRxivAPIResponse {
  collection: Array<{
    doi: string;
    title: string;
    authors: string;
    author_corresponding: string;
    author_corresponding_institution: string;
    date: string;
    version: string;
    type: string;
    license: string;
    category: string;
    jatsxml: string;
    abstract: string;
    published?: string;
    server: string;
  }>;
  messages: Array<{
    status: string;
    interval: string;
    count: string;
    total: string;
  }>;
}
