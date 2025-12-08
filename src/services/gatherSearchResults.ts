import type { ClinicalTrial, SearchParams } from '@/types/trials';
import type { PubMedArticle, PubMedSearchParams } from '@/types/papers';
import type { PressRelease } from '@/types/press-releases';
import type { IRDeck } from '@/types/ir-decks';
import { TrialRankingService } from './trialRankingService';

interface SearchStrategy {
  query: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  searchType: 'targeted' | 'broad' | 'synonym' | 'brand' | 'indication' | 'combination';
}

interface EnhancedSearchResponse {
  success: boolean;
  strategies: SearchStrategy[];
  totalStrategies: number;
}

export interface StrategyResult {
  strategy: SearchStrategy;
  count: number;
  trials: ClinicalTrial[];
  formattedQueries?: {
    clinicalTrials: string;  // Actual query.term sent to ClinicalTrials.gov API
    pubmed: string;          // Actual term sent to PubMed E-Utilities API
  };
}

export interface GatherSearchResultsResponse {
  trials: ClinicalTrial[];
  papers: PubMedArticle[];
  pressReleases: PressRelease[];
  irDecks: IRDeck[];
  totalCount: number;
  searchStrategies: StrategyResult[];
  strategiesUsed: number;
}

export type ProgressCallback = (message: string, data?: {
  trials?: number;
  papers?: number;
  pressReleases?: number;
  irDecks?: number;
  drugs?: number;
}) => void;

/**
 * Get server API base URL - handles both browser (vercel deployment) and test environments (localhost)
 */
function getApiBaseUrl(): string {
  // In test environment, use TEST_SERVER_URL if provided - this is provided in run-integration-tests.sh and nowhere else
  if (typeof process !== 'undefined' && process.env?.TEST_SERVER_URL) {
    return process.env.TEST_SERVER_URL;
  }
  
  // In browser, relative URLs work fine
  if (typeof window !== 'undefined') {
    return '';
  }
  
  // In Node.js without TEST_SERVER_URL, use localhost (fallback)
  return 'http://localhost:5173';
}

/**
 * Build full server API URL for fetch calls
 */
function buildApiUrl(path: string): string {
  const baseUrl = getApiBaseUrl();
  return `${baseUrl}${path}`;
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
      const response = await fetch(buildApiUrl('/api/search?type=trials'), {
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
   * Enhance a user query using AI and return phrase-based discovery strategies
   * Generates EXACTLY 5 strategies focused on discovering drugs (not searching for known drugs)
   */
  private static async enhanceQuery(userQuery: string, onProgress?: ProgressCallback): Promise<SearchStrategy[]> {
    try {
      onProgress?.('Enhancing search terms');
      
      const response = await fetch(buildApiUrl('/api/enhance-search'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: userQuery,
          searchType: 'initial'  // Always use discovery-focused approach
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data: EnhancedSearchResponse = await response.json();
      
      if (!data.success || !data.strategies || data.strategies.length === 0) {
        throw new Error('Failed to enhance search query');
      }

      const strategies = data.strategies.slice(0, 5);
      return strategies;
    } catch (error) {
      console.error('Error enhancing search query:', error);
      // Re-throw the error to be handled by the caller
      throw new Error(`Search enhancement failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }



  /**
   * Search for clinical trials using phrase-based discovery strategies
   * Executes 5 LLM-generated queries that match user's phase requirements
   */
  private static async searchClinicalTrials(userQuery: string, onProgress?: ProgressCallback): Promise<{
    trials: ClinicalTrial[];
    searchStrategies: StrategyResult[];
  }> {
    try {
      // Get 5 phrase-based discovery strategies from AI (phase-aware)
      const strategies = await this.enhanceQuery(userQuery, onProgress);
      
      onProgress?.('Gathering clinical trials, papers and other sources');

      // Execute all 5 strategies in parallel (max 50 results per strategy)
      const strategyResults = await Promise.all(
        strategies.map(async (strategy) => {
          try {
            const result = await this.searchTrials({ query: strategy.query, pageSize: 50 });

            // Capture formatted queries for display
            //TODO: doesn't have to be RCT for phase 4+
            const formattedQueries = {
              clinicalTrials: strategy.query, // This becomes query.term parameter
              pubmed: `${strategy.query} AND ("Clinical Trial"[Publication Type] OR "Randomized Controlled Trial"[Publication Type])`
            };
            
            return {
              strategy,
              count: result.trials.length,
              trials: result.trials,
              formattedQueries
            };
          } catch (error) {
            console.error(`  ✗ "${strategy.query}" failed:`, error);
            return {
              strategy,
              count: 0,
              trials: [],
              formattedQueries: {
                clinicalTrials: strategy.query,
                pubmed: `${strategy.query} AND ("Clinical Trial"[Publication Type] OR "Randomized Controlled Trial"[Publication Type])`
              }
            };
          }
        })
      );

      // Union all results
      const allTrials = strategyResults.flatMap(r => r.trials);

      // Deduplicate by NCT ID
      const uniqueTrials = allTrials.reduce((acc: ClinicalTrial[], current: ClinicalTrial) => {
        const existing = acc.find(trial => trial.nctId === current.nctId);
        if (!existing) {
          acc.push(current);
        }
        return acc;
      }, []);

      // Apply ranking to prioritize most relevant
      // TODO: How long does this process take? Should add logging on latency of each step OR showing progress on screen
      const rankedTrials = TrialRankingService.rankTrials(uniqueTrials, userQuery);

      return {
        trials: rankedTrials,
        searchStrategies: strategyResults
      };
    } catch (error) {
      console.error('Error searching clinical trials:', error);
      throw error;
    }
  }

  /**
   * Search PubMed for papers using API endpoint
   */
  private static async searchPapers(params: PubMedSearchParams): Promise<PubMedArticle[]> {
    try {
      const response = await fetch(buildApiUrl('/api/search?type=papers'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params)
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data.papers || [];
    } catch (error) {
      console.error('PubMed search error:', error);
      throw new Error('Failed to search PubMed');
    }
  }

  /**
   * Search for research papers using phrase-based discovery strategies
   * Uses all 5 LLM-generated queries to maximize paper discovery
   */
  private static async searchResearchPapers(userQuery: string, onProgress?: ProgressCallback): Promise<PubMedArticle[]> {
    try {
      // Get 5 phrase-based discovery strategies from AI (same as trials)
      //TODO check if enhance query API has a different set of instructions for PubMed.
      //maybe you can merge the query enhancement with the searching
      const strategies = await this.enhanceQuery(userQuery, onProgress);

      // Execute all 5 paper searches in parallel (30 results per strategy)
      const paperSearches = await Promise.all(
        strategies.map(async (strategy) => {
          try {
            const papers = await this.searchPapers({
              query: `${strategy.query} AND ("Clinical Trial"[Publication Type] OR "Randomized Controlled Trial"[Publication Type])`,
              maxResults: 30
            });
            return papers;
          } catch (error) {
            console.error(`  ✗ "${strategy.query}" failed:`, error);
            return [];
          }
        })
      );
      
      // Union and deduplicate papers by PMID
      const allPapers = paperSearches.flat();
      const uniquePapers = allPapers.reduce((acc: PubMedArticle[], current: PubMedArticle) => {
        const existing = acc.find(paper => paper.pmid === current.pmid);
        if (!existing) {
          acc.push(current);
        }
        return acc;
      }, []);

      return uniquePapers;
    } catch (error) {
      console.error('Error searching research papers:', error);
      // Don't throw - just return empty array if papers fail
      return [];
    }
  }

  /**
   * Search for press releases from news sources
   * Searches recent press releases (last 30 days by default)
   */
  private static async searchPressReleases(userQuery: string): Promise<PressRelease[]> {
    try {
      const response = await fetch(buildApiUrl('/api/search?type=press-releases'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: userQuery,
          maxResults: 30
        })
      });

      if (!response.ok) {
        throw new Error(`Press releases API error: ${response.statusText}`);
      }

      const data = await response.json();
      const pressReleases = data.pressReleases || [];

      return pressReleases;
    } catch (error) {
      console.error('Error searching press releases:', error);
      // Don't throw - just return empty array if press releases fail
      return [];
    }
  }

  /**
   * Search for IR decks from SEC EDGAR
   * Searches company SEC filings (investor relations materials)
   */
  private static async searchIRDecks(userQuery: string): Promise<IRDeck[]> {
    try {
      const response = await fetch(buildApiUrl('/api/search?type=ir-decks'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: userQuery,
          maxResults: 20
        })
      });

      if (!response.ok) {
        throw new Error(`IR decks API error: ${response.statusText}`);
      }

      const data = await response.json();
      const irDecks = data.irDecks || [];

      return irDecks;
    } catch (error) {
      console.error('Error searching IR decks:', error);
      // Don't throw - just return empty array if IR decks fail
      return [];
    }
  }

  /**
   * Main method: Discover drugs through phrase-based searches
   * Orchestrates 5 LLM-generated queries for trials and 5 for papers
   * Goal: UNCOVER drugs across all stages (discovery → approved)
   */
  static async gatherSearchResults(userQuery: string, onProgress?: ProgressCallback): Promise<GatherSearchResultsResponse> {
    try {
      // Search clinical trials, research papers, press releases, and IR decks in parallel
      // Trials and papers each use 5 LLM-generated phrase-based queries
      const [trialsResult, papers, pressReleases, irDecks] = await Promise.all([
        this.searchClinicalTrials(userQuery, onProgress),
        this.searchResearchPapers(userQuery, onProgress),
        this.searchPressReleases(userQuery),
        this.searchIRDecks(userQuery)
      ]);

      // Report results found
      onProgress?.(`Found ${trialsResult.trials.length} trials and ${papers.length} papers. Grouping results...`, {
        trials: trialsResult.trials.length,
        papers: papers.length,
        pressReleases: pressReleases.length,
        irDecks: irDecks.length
      });

      return {
        trials: trialsResult.trials,
        papers: papers,
        pressReleases: pressReleases,
        irDecks: irDecks,
        totalCount: trialsResult.trials.length,
        searchStrategies: trialsResult.searchStrategies,
        strategiesUsed: trialsResult.searchStrategies.length
      };
    } catch (error) {
      console.error('Error in discovery search:', error);
      throw error;
    }
  }
}
