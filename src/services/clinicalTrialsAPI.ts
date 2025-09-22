// ClinicalTrials.gov API Service
// API Documentation: https://clinicaltrials.gov/api/v2/

const BASE_URL = 'https://clinicaltrials.gov/api/v2';

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

export class ClinicalTrialsAPI {
  /**
   * Search for clinical trials based on parameters
   */
  static async searchTrials(params: SearchParams): Promise<{
    trials: ClinicalTrial[];
    nextPageToken?: string;
    totalCount: number;
  }> {
    try {
      const queryParams = new URLSearchParams();
      
      // Build query string
      const queryParts: string[] = [];
      if (params.condition) queryParts.push(`AREA[Condition]${params.condition}`);
      if (params.sponsor) queryParts.push(`AREA[Sponsor]${params.sponsor}`);
      if (params.phase) queryParts.push(`AREA[Phase]${params.phase}`);
      if (params.query) queryParts.push(params.query);
      
      if (queryParts.length > 0) {
        queryParams.append('query.term', queryParts.join(' AND '));
      }
      
      // Add other parameters
      if (params.status) {
        queryParams.append('filter.overallStatus', params.status);
      }
      
      queryParams.append('pageSize', (params.pageSize || 20).toString());
      
      if (params.pageToken) {
        queryParams.append('pageToken', params.pageToken);
      }
      
      // Request specific fields to reduce payload
      queryParams.append('fields', [
        'NCTId',
        'BriefTitle',
        'OfficialTitle',
        'OverallStatus',
        'Phase',
        'Condition',
        'InterventionName',
        'InterventionType',
        'LeadSponsorName',
        'CollaboratorName',
        'StartDate',
        'CompletionDate',
        'EnrollmentCount',
        'StudyType',
        'LocationFacility',
        'LocationCity',
        'LocationCountry'
      ].join(','));
      
      const response = await fetch(`${BASE_URL}/studies?${queryParams.toString()}`);
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Transform the API response to our format
      const trials: ClinicalTrial[] = (data.studies || []).map((study: any) => ({
        nctId: study.protocolSection?.identificationModule?.nctId || '',
        briefTitle: study.protocolSection?.identificationModule?.briefTitle || '',
        officialTitle: study.protocolSection?.identificationModule?.officialTitle,
        overallStatus: study.protocolSection?.statusModule?.overallStatus || '',
        phase: study.protocolSection?.designModule?.phases,
        conditions: study.protocolSection?.conditionsModule?.conditions,
        interventions: study.protocolSection?.armsInterventionsModule?.interventions?.map(
          (i: any) => `${i.type}: ${i.name}`
        ),
        sponsors: {
          lead: study.protocolSection?.sponsorCollaboratorsModule?.leadSponsor?.name,
          collaborators: study.protocolSection?.sponsorCollaboratorsModule?.collaborators?.map(
            (c: any) => c.name
          )
        },
        startDate: study.protocolSection?.statusModule?.startDateStruct?.date,
        completionDate: study.protocolSection?.statusModule?.completionDateStruct?.date,
        enrollment: study.protocolSection?.designModule?.enrollmentInfo?.count,
        studyType: study.protocolSection?.designModule?.studyType,
        locations: study.protocolSection?.contactsLocationsModule?.locations?.map((loc: any) => ({
          facility: loc.facility,
          city: loc.city,
          country: loc.country
        }))
      }));
      
      return {
        trials,
        nextPageToken: data.nextPageToken,
        totalCount: data.totalCount || trials.length
      };
    } catch (error) {
      console.error('Error fetching clinical trials:', error);
      throw error;
    }
  }
  
  /**
   * Parse natural language query into search parameters
   */
  static parseQuery(naturalLanguageQuery: string): SearchParams {
    const query = naturalLanguageQuery.toLowerCase();
    const params: SearchParams = {};
    
    // Extract phase
    if (query.includes('phase 3') || query.includes('phase iii')) {
      params.phase = 'PHASE3';
    } else if (query.includes('phase 2') || query.includes('phase ii')) {
      params.phase = 'PHASE2';
    } else if (query.includes('phase 1') || query.includes('phase i')) {
      params.phase = 'PHASE1';
    }
    
    // Extract common conditions
    const conditions = [
      { keywords: ['cancer', 'oncology', 'tumor', 'carcinoma'], value: 'cancer' },
      { keywords: ['diabetes', 'diabetic'], value: 'diabetes' },
      { keywords: ['alzheimer', 'dementia'], value: 'alzheimer' },
      { keywords: ['covid', 'coronavirus', 'sars-cov-2'], value: 'COVID-19' },
      { keywords: ['heart', 'cardiac', 'cardiovascular'], value: 'cardiovascular' },
    ];
    
    for (const condition of conditions) {
      if (condition.keywords.some(keyword => query.includes(keyword))) {
        params.condition = condition.value;
        break;
      }
    }
    
    // Extract common sponsors
    const sponsors = [
      { keywords: ['pfizer'], value: 'Pfizer' },
      { keywords: ['moderna'], value: 'Moderna' },
      { keywords: ['j&j', 'johnson', 'janssen'], value: 'Johnson' },
      { keywords: ['merck'], value: 'Merck' },
      { keywords: ['novartis'], value: 'Novartis' },
      { keywords: ['roche'], value: 'Roche' },
      { keywords: ['lilly', 'eli lilly'], value: 'Eli Lilly' },
      { keywords: ['astrazeneca', 'astra zeneca'], value: 'AstraZeneca' },
    ];
    
    for (const sponsor of sponsors) {
      if (sponsor.keywords.some(keyword => query.includes(keyword))) {
        params.sponsor = sponsor.value;
        break;
      }
    }
    
    // Extract status
    if (query.includes('recruiting')) {
      params.status = 'RECRUITING';
    } else if (query.includes('completed')) {
      params.status = 'COMPLETED';
    } else if (query.includes('active')) {
      params.status = 'ACTIVE_NOT_RECRUITING';
    }
    
    // If no specific parameters were extracted, use the whole query
    if (Object.keys(params).length === 0) {
      params.query = naturalLanguageQuery;
    }
    
    return params;
  }
}
