// Asset Development Pipeline Types

export interface PipelineDrugCandidate {
  id: string;
  commercialName?: string; // e.g., "ADUHELM™"
  scientificName: string; // e.g., "Aducanumab" 
  sponsorCompany: string;
  stage: PipelineStage;
  technologies?: string; // e.g., "Biologics", "Small Molecule"
  mechanismOfAction?: string; // e.g., "Monotherapy", "Combination Therapy"
  indications?: string[]; // e.g., ["Alzheimer's Disease", "Dementia"]
  lastTrialStartDate?: string; // ISO date string
  sourceGroupId?: string; // Reference to original DrugGroup for modal lookup
}

export type PipelineStage = 
  | 'Marketed'
  | 'Phase III'
  | 'Phase II'
  | 'Phase I'
  | 'Pre-Clinical'
  | 'Discovery';

export interface PipelineFilters {
  stage?: PipelineStage[];
  company?: string[];
  indication?: string[];
  searchQuery?: string;
}

