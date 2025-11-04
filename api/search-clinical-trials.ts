// Vercel API Route for ClinicalTrials.gov API
// Proxy to external ClinicalTrials.gov API with LLM-based query parsing

const BASE_URL = 'https://clinicaltrials.gov/api/v2';

interface SearchParams {
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

/**
 * Parse natural language query using Gemini LLM to construct structured API parameters
 */
async function parseQueryWithLLM(userQuery: string): Promise<SearchParams> {
  const geminiApiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!geminiApiKey) {
    console.warn('No Gemini API key - falling back to direct query');
    return { query: userQuery };
  }

  const prompt = `You are an expert at parsing natural language queries into structured ClinicalTrials.gov API v2 parameters.

USER QUERY: "${userQuery}"

Your task is to analyze this natural language query and extract structured parameters that match the ClinicalTrials.gov API v2 format.

EXAMPLE WELL-FORMED QUERY:
https://clinicaltrials.gov/api/v2/studies?query.cond=obesity&query.intr=semaglutide&query.term=AREA[Phase](Phase%203)&query.locn=United%20States&filter.overallStatus=RECRUITING,ACTIVE_NOT_RECRUITING&query.patient=adult&pageSize=20

AVAILABLE PARAMETERS:

1. **query.cond** - Medical condition
   - Extract the main disease/condition being studied
   - Examples: "obesity", "diabetes", "cancer", "Alzheimer's disease"

2. **query.intr** - Intervention/Drug name
   - Extract specific drug or treatment names
   - Examples: "semaglutide", "tirzepatide", "pembrolizumab"
   - Leave empty if no specific drug is mentioned

3. **query.term** - General search terms and phase specification
   - Use AREA[Phase](Phase X) syntax for phase: "AREA[Phase](Phase 3)" or "AREA[Phase](Phase 2)"
   - Can include other search terms combined with phase
   - Examples: "AREA[Phase](Phase 3)", "AREA[Phase](Phase 1|Phase 2)", "immunotherapy AREA[Phase](Phase 2)"

4. **query.locn** - Geographic location
   - Extract country or region if specified
   - Examples: "United States", "Europe", "China"

5. **filter.overallStatus** - Trial status (comma-separated)
   - Common values: "RECRUITING", "ACTIVE_NOT_RECRUITING", "COMPLETED", "ENROLLING_BY_INVITATION"
   - Default to "RECRUITING,ACTIVE_NOT_RECRUITING" for active trials if "recruiting" or "active" is mentioned
   - Leave empty if not specified

6. **query.patient** - Patient population
   - Examples: "adult", "child", "elderly"
   - Leave empty if not specified

PARSING RULES:
- Only include parameters that are explicitly mentioned or strongly implied in the query
- For phase, ALWAYS use the AREA[Phase] syntax in query.term: "AREA[Phase](Phase X)"
- Be conservative - don't add parameters that aren't clearly indicated
- If multiple phases are mentioned, use pipe separator: "AREA[Phase](Phase 1|Phase 2)"
- If "recruiting" or "active" is mentioned, set filter.overallStatus to "RECRUITING,ACTIVE_NOT_RECRUITING"

Return ONLY a valid JSON object (no markdown) with these fields:

{
  "query.cond": "condition here" or omit if not specified,
  "query.intr": "drug name here" or omit if not specified,
  "query.term": "AREA[Phase](Phase X) and other terms" or omit if no phase/terms,
  "query.locn": "location here" or omit if not specified,
  "filter.overallStatus": "status here" or omit if not specified,
  "query.patient": "population here" or omit if not specified
}

EXAMPLES:

Query: "Show me Phase 3 trials for semaglutide in obesity that are recruiting"
Response:
{
  "query.cond": "obesity",
  "query.intr": "semaglutide",
  "query.term": "AREA[Phase](Phase 3)",
  "filter.overallStatus": "RECRUITING,ACTIVE_NOT_RECRUITING"
}

Query: "Phase 2 GLP-1 receptor agonist trials"
Response:
{
  "query.term": "GLP-1 receptor agonist AREA[Phase](Phase 2)"
}

Query: "Active Alzheimer's trials in the United States"
Response:
{
  "query.cond": "Alzheimer's disease",
  "query.locn": "United States",
  "filter.overallStatus": "RECRUITING,ACTIVE_NOT_RECRUITING"
}

Now parse the user query and return ONLY the JSON object.`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 500,
        }
      })
    });

    if (!response.ok) {
      console.warn('Gemini API error - falling back to direct query');
      return { query: userQuery };
    }

    const data = await response.json();
    const content = data.candidates[0].content.parts[0].text;

    // Clean and parse JSON
    let cleanedContent = content.trim();
    if (cleanedContent.startsWith('```json')) {
      cleanedContent = cleanedContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanedContent.startsWith('```')) {
      cleanedContent = cleanedContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanedContent = jsonMatch[0];
    }

    const parsedParams = JSON.parse(cleanedContent);
    console.log('✅ LLM parsed query into:', parsedParams);
    return parsedParams;
  } catch (error) {
    console.error('Error parsing query with LLM:', error);
    return { query: userQuery };
  }
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
    let params: SearchParams = req.body;

    // If a simple query string is provided, use LLM to parse it into structured parameters
    if (params.query && !params['query.cond'] && !params['query.intr'] && !params['query.term']) {
      console.log(`🤖 Using LLM to parse query: "${params.query}"`);
      const llmParsedParams = await parseQueryWithLLM(params.query);
      params = { ...params, ...llmParsedParams };
    }

    const queryParams = new URLSearchParams();
    
    // Build query using ClinicalTrials.gov API v2 structure
    if (params['query.cond']) {
      queryParams.append('query.cond', params['query.cond']);
    }
    
    if (params['query.intr']) {
      queryParams.append('query.intr', params['query.intr']);
    }
    
    if (params['query.term']) {
      queryParams.append('query.term', params['query.term']);
    }
    
    if (params['query.locn']) {
      queryParams.append('query.locn', params['query.locn']);
    }
    
    if (params['filter.overallStatus']) {
      queryParams.append('filter.overallStatus', params['filter.overallStatus']);
    }
    
    if (params['query.patient']) {
      queryParams.append('query.patient', params['query.patient']);
    }
    
    // Legacy support - convert old format to new format
    if (!queryParams.has('query.term') && (params.query || params.condition || params.phase || params.sponsor)) {
      const queryParts: string[] = [];
      if (params.condition) queryParts.push(`AREA[Condition](${params.condition})`);
      if (params.sponsor) queryParts.push(`AREA[Sponsor](${params.sponsor})`);
      if (params.phase) queryParts.push(`AREA[Phase](${params.phase})`);
      if (params.query) queryParts.push(params.query);
      
      if (queryParts.length > 0) {
        queryParams.append('query.term', queryParts.join(' AND '));
      }
    }
    
    // Legacy status support
    if (!queryParams.has('filter.overallStatus') && params.status) {
      queryParams.append('filter.overallStatus', params.status);
    }
    
    queryParams.append('pageSize', (params.pageSize || 50).toString());
    
    if (params.pageToken) {
      queryParams.append('pageToken', params.pageToken);
    }
    
    if (params.sort) {
      queryParams.append('sort', params.sort);
    } else {
      queryParams.append('sort', 'LastUpdatePostDate:desc');
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

    const apiUrl = `${BASE_URL}/studies?${queryParams.toString()}`;
    console.log(`📡 Calling ClinicalTrials.gov API: ${apiUrl}`);
    
    const response = await fetch(apiUrl);
    
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

