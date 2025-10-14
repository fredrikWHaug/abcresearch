// Gather Search Results Service
// Orchestrates AI-enhanced search, clinical trials, and research papers
// Contains business logic for searching across multiple data sources

import type { ClinicalTrial, SearchParams } from '@/types/trials';
import type { PubMedArticle } from '@/types/papers';
import { pubmedAPI } from './pubmedAPI';
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

export interface GatherSearchResultsResponse {
  trials: ClinicalTrial[];
  papers: PubMedArticle[];
  totalCount: number;
  searchStrategies: {
    primary: { count: number; trials: ClinicalTrial[] };
    alternative: { count: number; trials: ClinicalTrial[] };
    broad: { count: number; trials: ClinicalTrial[] };
  };
}

export class GatherSearchResultsService {
  /**
   * Search for clinical trials via API proxy
   * Calls server-side API proxy to avoid CORS issues
   */
  private static async searchTrials(params: SearchParams): Promise<{
    trials: ClinicalTrial[];
    nextPageToken?: string;
    totalCount: number;
  }> {
    try {
      const response = await fetch('/api/search-clinical-trials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      return {
        trials: data.trials || [],
        nextPageToken: data.nextPageToken,
        totalCount: data.totalCount || 0
      };
    } catch (error) {
      console.error('Error fetching clinical trials:', error);
      throw error;
    }
  }

  /**
   * Parse natural language query into search parameters
   */
  private static parseQuery(naturalLanguageQuery: string): SearchParams {
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

  /**
   * Enhance a user query using AI and return multiple search strategies
   * Calls ai-enhanced-search API
   */
  private static async enhanceQuery(userQuery: string): Promise<EnhancedQueries> {
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
      // Fallback to basic search if enhancement fails
      return {
        primary: { query: userQuery },
        alternative: { query: userQuery },
        broad: { query: userQuery }
      };
    }
  }

  /**
   * Clean up enhanced queries to ensure they're valid
   */
  private static cleanQuery(params: SearchParams, originalQuery: string): SearchParams {
    const cleaned: SearchParams = {};
    
    // Only add non-null values
    if (params.condition && params.condition !== 'null') cleaned.condition = params.condition;
    if (params.sponsor && params.sponsor !== 'null') cleaned.sponsor = params.sponsor;
    if (params.phase && params.phase !== 'null') cleaned.phase = params.phase;
    if (params.status && params.status !== 'null') cleaned.status = params.status;
    if (params.query && params.query !== 'null') cleaned.query = params.query;
    
    // If no parameters were set, use the original user query
    if (Object.keys(cleaned).length === 0) {
      cleaned.query = originalQuery;
    }
    
    return cleaned;
  }

  /**
   * Search for clinical trials using enhanced search strategies
   */
  private static async searchClinicalTrials(userQuery: string): Promise<{
    trials: ClinicalTrial[];
    searchStrategies: {
      primary: { count: number; trials: ClinicalTrial[] };
      alternative: { count: number; trials: ClinicalTrial[] };
      broad: { count: number; trials: ClinicalTrial[] };
    };
  }> {
    try {
      // Get enhanced queries from AI
      const enhancedQueries = await this.enhanceQuery(userQuery);
      
      // Perform searches in parallel with cleaned queries
      const [primaryResult, alternativeResult, broadResult] = await Promise.all([
        this.searchTrials(this.cleanQuery(enhancedQueries.primary, userQuery)),
        this.searchTrials(this.cleanQuery(enhancedQueries.alternative, userQuery)),
        this.searchTrials(this.cleanQuery(enhancedQueries.broad, userQuery))
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
        searchStrategies: {
          primary: { count: primaryResult.trials.length, trials: primaryResult.trials },
          alternative: { count: alternativeResult.trials.length, trials: alternativeResult.trials },
          broad: { count: broadResult.trials.length, trials: broadResult.trials }
        }
      };
    } catch (error) {
      console.error('Error searching clinical trials:', error);
      throw error;
    }
  }

  /**
   * Search for research papers related to the query
   */
  private static async searchResearchPapers(userQuery: string): Promise<PubMedArticle[]> {
    try {
      // Search for papers using the query
      const papers = await pubmedAPI.searchPapers({
        query: `${userQuery} AND ("Clinical Trial"[Publication Type] OR "Randomized Controlled Trial"[Publication Type])`,
        maxResults: 30
      });
      
      return papers;
    } catch (error) {
      console.error('Error searching research papers:', error);
      // Don't throw - just return empty array if papers fail
      return [];
    }
  }

  /**
   * Main method: Gather all search results (trials and papers)
   * Orchestrates AI-enhanced search, clinical trials API, and PubMed API
   */
  static async gatherSearchResults(userQuery: string): Promise<GatherSearchResultsResponse> {
    try {
      // Search both clinical trials and research papers in parallel
      const [trialsResult, papers] = await Promise.all([
        this.searchClinicalTrials(userQuery),
        this.searchResearchPapers(userQuery)
      ]);

      return {
        trials: trialsResult.trials,
        papers: papers,
        totalCount: trialsResult.trials.length,
        searchStrategies: trialsResult.searchStrategies
      };
    } catch (error) {
      console.error('Error gathering search results:', error);
      throw error;
    }
  }

  /**
   * Simple search without AI enhancement (fallback)
   */
  static async simpleSearch(userQuery: string): Promise<GatherSearchResultsResponse> {
    try {
      // Parse query and search directly
      const params = this.parseQuery(userQuery);
      
      // Search trials and papers in parallel
      const [trialsResult, papers] = await Promise.all([
        this.searchTrials(params),
        pubmedAPI.searchPapers({
          query: `${userQuery} AND ("Clinical Trial"[Publication Type] OR "Randomized Controlled Trial"[Publication Type])`,
          maxResults: 30
        })
      ]);

      // Apply ranking
      const rankedTrials = TrialRankingService.rankTrials(trialsResult.trials, userQuery);

      return {
        trials: rankedTrials,
        papers: papers,
        totalCount: rankedTrials.length,
        searchStrategies: {
          primary: { count: trialsResult.trials.length, trials: trialsResult.trials },
          alternative: { count: 0, trials: [] },
          broad: { count: 0, trials: [] }
        }
      };
    } catch (error) {
      console.error('Error in simple search:', error);
      throw error;
    }
  }
}

