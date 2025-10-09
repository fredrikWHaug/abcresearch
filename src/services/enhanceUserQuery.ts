// Service for enhancing user queries using AI to construct better search queries
// for ClinicalTrials.gov and PubMed APIs

export interface EnhancedQuery {
  clinicalTrialsQuery: string;
  pubmedQuery: string;
  searchTerms: string[];
  conditions: string[];
  interventions: string[];
}

export interface EnhancedQueries {
  primary: EnhancedQuery;
  alternative: EnhancedQuery;
  broad: EnhancedQuery;
}

export class EnhanceUserQueryService {
  /**
   * Enhance a user query using AI to create optimized search queries
   * for both ClinicalTrials.gov and PubMed APIs
   */
  static async enhanceUserQuery(userQuery: string): Promise<EnhancedQueries> {
    console.log('🔍 EnhanceUserQueryService.enhanceUserQuery called with:', userQuery);
    
    try {
      const requestBody = { query: userQuery };
      console.log('📤 Sending request to /api/enhance-search:', requestBody);
      
      const response = await fetch('/api/enhance-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      console.log('📥 Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Response not ok. Error text:', errorText);
        
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch (parseError) {
          console.error('❌ Failed to parse error response as JSON');
          errorData = { error: errorText };
        }
        
        console.error('❌ Error data:', errorData);
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const responseText = await response.text();
      console.log('📥 Raw response text:', responseText);
      
      let data: any;
      try {
        data = JSON.parse(responseText);
        console.log('📥 Parsed response data:', data);
      } catch (parseError) {
        console.error('❌ Failed to parse response as JSON:', parseError);
        throw new Error('Invalid JSON response from server');
      }
      
      if (!data.success) {
        console.error('❌ Response indicates failure:', data);
        throw new Error('Failed to enhance search query');
      }

      // Transform the enhanced queries into our format
      const enhancedQueries: EnhancedQueries = {
        primary: this.transformToEnhancedQuery(data.enhancedQueries.primary, userQuery),
        alternative: this.transformToEnhancedQuery(data.enhancedQueries.alternative, userQuery),
        broad: this.transformToEnhancedQuery(data.enhancedQueries.broad, userQuery)
      };

      console.log('✅ Successfully enhanced queries:', enhancedQueries);
      return enhancedQueries;
    } catch (error) {
      console.error('❌ Error enhancing search query:', error);
      console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      throw error;
    }
  }

  /**
   * Transform the basic enhanced query into our enhanced format with separate
   * queries for ClinicalTrials.gov and PubMed
   */
  private static transformToEnhancedQuery(basicQuery: any, originalQuery: string): EnhancedQuery {
    // Extract search terms from the query
    const searchTerms = this.extractSearchTerms(basicQuery, originalQuery);
    
    // Create optimized queries for each API
    const clinicalTrialsQuery = this.buildClinicalTrialsQuery(basicQuery, searchTerms);
    const pubmedQuery = this.buildPubMedQuery(basicQuery, searchTerms);
    
    // Extract conditions and interventions
    const conditions = this.extractConditions(basicQuery, searchTerms);
    const interventions = this.extractInterventions(basicQuery, searchTerms);

    return {
      clinicalTrialsQuery,
      pubmedQuery,
      searchTerms,
      conditions,
      interventions
    };
  }

  /**
   * Extract search terms from the enhanced query
   */
  private static extractSearchTerms(basicQuery: any, originalQuery: string): string[] {
    const terms: string[] = [];
    
    // Add the main query if it exists
    if (basicQuery.query && basicQuery.query !== 'null') {
      terms.push(basicQuery.query);
    }
    
    // Add condition if specified
    if (basicQuery.condition && basicQuery.condition !== 'null') {
      terms.push(basicQuery.condition);
    }
    
    // Add sponsor if specified
    if (basicQuery.sponsor && basicQuery.sponsor !== 'null') {
      terms.push(basicQuery.sponsor);
    }
    
    // If no specific terms, use the original query
    if (terms.length === 0) {
      terms.push(originalQuery);
    }
    
    return terms;
  }

  /**
   * Build optimized query for ClinicalTrials.gov API
   */
  private static buildClinicalTrialsQuery(basicQuery: any, searchTerms: string[]): string {
    const queryParts: string[] = [];
    
    // Add condition if specified
    if (basicQuery.condition && basicQuery.condition !== 'null') {
      queryParts.push(`AREA[Condition]${basicQuery.condition}`);
    }
    
    // Add sponsor if specified
    if (basicQuery.sponsor && basicQuery.sponsor !== 'null') {
      queryParts.push(`AREA[Sponsor]${basicQuery.sponsor}`);
    }
    
    // Add phase if specified
    if (basicQuery.phase && basicQuery.phase !== 'null') {
      queryParts.push(`AREA[Phase]${basicQuery.phase}`);
    }
    
    // Add main search terms
    if (basicQuery.query && basicQuery.query !== 'null') {
      queryParts.push(basicQuery.query);
    }
    
    // If no specific parts, use the search terms
    if (queryParts.length === 0) {
      queryParts.push(...searchTerms);
    }
    
    return queryParts.join(' AND ');
  }

  /**
   * Build optimized query for PubMed API
   */
  private static buildPubMedQuery(basicQuery: any, searchTerms: string[]): string {
    const queryParts: string[] = [];
    
    // Add condition if specified
    if (basicQuery.condition && basicQuery.condition !== 'null') {
      queryParts.push(`"${basicQuery.condition}"`);
    }
    
    // Add main search terms
    if (basicQuery.query && basicQuery.query !== 'null') {
      queryParts.push(`"${basicQuery.query}"`);
    }
    
    // Add clinical trial filters for PubMed
    queryParts.push('("Clinical Trial"[Publication Type] OR "Randomized Controlled Trial"[Publication Type])');
    
    // If no specific parts, use the search terms
    if (queryParts.length === 1) { // Only the clinical trial filter
      queryParts.unshift(...searchTerms.map(term => `"${term}"`));
    }
    
    return queryParts.join(' AND ');
  }

  /**
   * Extract conditions from the query
   */
  private static extractConditions(basicQuery: any, searchTerms: string[]): string[] {
    const conditions: string[] = [];
    
    if (basicQuery.condition && basicQuery.condition !== 'null') {
      conditions.push(basicQuery.condition);
    }
    
    // Add common medical conditions from search terms
    const medicalConditions = [
      'cancer', 'oncology', 'tumor', 'carcinoma', 'neoplasm',
      'diabetes', 'diabetic', 'hyperglycemia',
      'alzheimer', 'dementia', 'cognitive',
      'covid', 'coronavirus', 'sars-cov-2',
      'heart', 'cardiac', 'cardiovascular', 'myocardial',
      'hypertension', 'blood pressure',
      'asthma', 'copd', 'respiratory',
      'arthritis', 'rheumatoid', 'osteoarthritis',
      'depression', 'anxiety', 'mental health',
      'stroke', 'cerebrovascular'
    ];
    
    for (const term of searchTerms) {
      const lowerTerm = term.toLowerCase();
      for (const condition of medicalConditions) {
        if (lowerTerm.includes(condition) && !conditions.includes(condition)) {
          conditions.push(condition);
        }
      }
    }
    
    return conditions;
  }

  /**
   * Extract interventions from the query
   */
  private static extractInterventions(basicQuery: any, searchTerms: string[]): string[] {
    const interventions: string[] = [];
    
    // Add sponsor if it's a pharmaceutical company
    if (basicQuery.sponsor && basicQuery.sponsor !== 'null') {
      const pharmaCompanies = [
        'pfizer', 'moderna', 'johnson', 'janssen', 'merck', 'novartis',
        'roche', 'lilly', 'eli lilly', 'astrazeneca', 'astra zeneca',
        'bristol', 'squibb', 'abbvie', 'amgen', 'biogen', 'gilead',
        'regeneron', 'vertex', 'illumina', 'thermo fisher'
      ];
      
      const lowerSponsor = basicQuery.sponsor.toLowerCase();
      if (pharmaCompanies.some(company => lowerSponsor.includes(company))) {
        interventions.push(basicQuery.sponsor);
      }
    }
    
    // Add common drug-related terms from search terms
    const drugTerms = [
      'drug', 'medication', 'therapy', 'treatment', 'intervention',
      'vaccine', 'antibody', 'inhibitor', 'agonist', 'antagonist',
      'monoclonal', 'biologic', 'small molecule', 'compound'
    ];
    
    for (const term of searchTerms) {
      const lowerTerm = term.toLowerCase();
      for (const drugTerm of drugTerms) {
        if (lowerTerm.includes(drugTerm) && !interventions.includes(term)) {
          interventions.push(term);
        }
      }
    }
    
    return interventions;
  }
}
