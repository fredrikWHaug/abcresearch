import { ClinicalTrialsAPI, type ClinicalTrial, type SearchParams } from './clinicalTrialsAPI';
import { TrialRankingService } from './trialRankingService';

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
    console.log('🔍 EnhancedSearchAPI.enhanceQuery called with:', userQuery);
    
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
      console.log('📥 Response ok:', response.ok);
      console.log('📥 Response headers:', Object.fromEntries(response.headers.entries()));

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
      
      let data: EnhancedSearchResponse;
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

      console.log('✅ Successfully enhanced queries:', data.enhancedQueries);
      return data.enhancedQueries;
    } catch (error) {
      console.error('❌ Error enhancing search query:', error);
      console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
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
    console.log('🚀 EnhancedSearchAPI.searchWithEnhancement called with:', userQuery);
    
    try {
      // Get enhanced queries from AI
      console.log('🤖 Getting enhanced queries from AI...');
      const enhancedQueries = await this.enhanceQuery(userQuery);
      console.log('✅ Received enhanced queries:', enhancedQueries);
      
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
      
      // Apply ranking to the unique trials
      const rankedTrials = TrialRankingService.rankTrials(uniqueTrials, userQuery);

      return {
        trials: rankedTrials,
        totalCount: rankedTrials.length,
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
