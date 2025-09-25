import { ClinicalTrialsAPI, type ClinicalTrial, type SearchParams } from './clinicalTrialsAPI';

interface EnhancedQueries {
  primary: SearchParams;
  alternative: SearchParams;
  broad: SearchParams;
}

interface EnhancedSearchResponse {
  success: boolean;
  enhancedQueries: EnhancedQueries;
}

export class EnhancedSearchAPI {
  /**
   * Enhance a user query using AI and return multiple search strategies
   */
  static async enhanceQuery(userQuery: string): Promise<EnhancedQueries> {
    try {
      const response = await fetch('/api/enhance-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: userQuery
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data: EnhancedSearchResponse = await response.json();
      
      if (!data.success) {
        throw new Error('Failed to enhance search query');
      }

      return data.enhancedQueries;
    } catch (error) {
      console.error('Error enhancing search query:', error);
      throw error;
    }
  }

  /**
   * Perform enhanced search with multiple strategies and merge results
   */
  static async searchWithEnhancement(userQuery: string): Promise<{
    trials: ClinicalTrial[];
    totalCount: number;
    searchStrategies: {
      primary: { count: number; trials: ClinicalTrial[] };
      alternative: { count: number; trials: ClinicalTrial[] };
      broad: { count: number; trials: ClinicalTrial[] };
    };
  }> {
    try {
      // Get enhanced queries from AI
      const enhancedQueries = await this.enhanceQuery(userQuery);
      
      // Clean up the enhanced queries to ensure they're valid
      const cleanQuery = (params: SearchParams): SearchParams => {
        const cleaned: SearchParams = {};
        
        // Only add non-null values
        if (params.condition && params.condition !== 'null') cleaned.condition = params.condition;
        if (params.sponsor && params.sponsor !== 'null') cleaned.sponsor = params.sponsor;
        if (params.phase && params.phase !== 'null') cleaned.phase = params.phase;
        if (params.status && params.status !== 'null') cleaned.status = params.status;
        if (params.query && params.query !== 'null') cleaned.query = params.query;
        
        // If no parameters were set, use the original user query
        if (Object.keys(cleaned).length === 0) {
          cleaned.query = userQuery;
        }
        
        return cleaned;
      };
      
      // Perform searches in parallel with cleaned queries
      const [primaryResult, alternativeResult, broadResult] = await Promise.all([
        ClinicalTrialsAPI.searchTrials(cleanQuery(enhancedQueries.primary)),
        ClinicalTrialsAPI.searchTrials(cleanQuery(enhancedQueries.alternative)),
        ClinicalTrialsAPI.searchTrials(cleanQuery(enhancedQueries.broad))
      ]);

      // Merge and deduplicate results
      const allTrials = [
        ...primaryResult.trials,
        ...alternativeResult.trials,
        ...broadResult.trials
      ];

      // Remove duplicates based on NCT ID
      const uniqueTrials = allTrials.reduce((acc: ClinicalTrial[], current: ClinicalTrial) => {
        const existing = acc.find(trial => trial.nctId === current.nctId);
        if (!existing) {
          acc.push(current);
        }
        return acc;
      }, []);

      return {
        trials: uniqueTrials,
        totalCount: uniqueTrials.length,
        searchStrategies: {
          primary: { count: primaryResult.trials.length, trials: primaryResult.trials },
          alternative: { count: alternativeResult.trials.length, trials: alternativeResult.trials },
          broad: { count: broadResult.trials.length, trials: broadResult.trials }
        }
      };
    } catch (error) {
      console.error('Error in enhanced search:', error);
      throw error;
    }
  }
}
