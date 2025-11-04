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
  extractedDrugs?: string[]; // Drug names extracted by Gemini from this trial
}

export interface SearchParams {
  // ClinicalTrials.gov API v2 structured parameters
  'query.cond'?: string;        // Condition (e.g., "obesity", "diabetes")
  'query.intr'?: string;        // Intervention/drug name (e.g., "semaglutide")
  'query.term'?: string;        // General search terms, including phase with AREA syntax
  'query.locn'?: string;        // Location (e.g., "United States")
  'filter.overallStatus'?: string;  // Status (e.g., "RECRUITING,ACTIVE_NOT_RECRUITING")
  'query.patient'?: string;     // Patient population (e.g., "adult", "child")
  
  // Legacy support (backward compatibility)
  query?: string;
  condition?: string;
  sponsor?: string;
  phase?: string;
  status?: string;
  
  // Pagination
  pageSize?: number;
  pageToken?: string;
  sort?: string;
}

