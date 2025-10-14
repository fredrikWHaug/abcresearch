// ClinicalTrials.gov Data Types

export interface ClinicalTrial {
  nctId: string;
  briefTitle: string;
  officialTitle?: string;
  overallStatus: string;
  phase?: string[];
  conditions?: string[];
  interventions?: string[];
  sponsors?: {
    lead?: string;
    collaborators?: string[];
  };
  startDate?: string;
  completionDate?: string;
  enrollment?: number;
  studyType?: string;
  locations?: {
    facility?: string;
    city?: string;
    country?: string;
  }[];
}

export interface SearchParams {
  query?: string;
  condition?: string;
  sponsor?: string;
  phase?: string;
  status?: string;
  pageSize?: number;
  pageToken?: string;
}

