// Vercel API Route for ClinicalTrials.gov API
// Proxy to external ClinicalTrials.gov API

const BASE_URL = 'https://clinicaltrials.gov/api/v2';

interface SearchParams {
  query?: string;
  condition?: string;
  sponsor?: string;
  phase?: string;
  status?: string;
  pageSize?: number;
  pageToken?: string;
}

export default async function handler(req: any, res: any) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const params: SearchParams = req.body;

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

    console.log(`Searching ClinicalTrials.gov with params:`, params);
    
    const response = await fetch(`${BASE_URL}/studies?${queryParams.toString()}`);
    
    if (!response.ok) {
      throw new Error(`ClinicalTrials.gov API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Transform the API response to our format
    const trials = (data.studies || []).map((study: any) => ({
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
    
    return res.status(200).json({
      trials,
      nextPageToken: data.nextPageToken,
      totalCount: data.totalCount || trials.length
    });
  } catch (error) {
    console.error('Error fetching clinical trials:', error);
    return res.status(500).json({ 
      error: 'Failed to search clinical trials',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

