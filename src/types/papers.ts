// PubMed / Research Papers Data Types

export interface PubMedArticle {
  pmid: string;
  title: string;
  abstract: string;
  authors: string[];
  journal: string;
  publicationDate: string;
  doi?: string;
  nctNumber?: string;
  relevanceScore: number;
  fullTextLinks: {
    pubmed: string;
    doi?: string;
    pmc?: string;
  };
}

export interface PubMedSearchParams {
  query: string;
  maxResults?: number;
  startDate?: string;
  endDate?: string;
}

