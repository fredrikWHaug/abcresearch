// Gather Search Results Service
// Orchestrates AI-enhanced search, clinical trials, and research papers
// Contains business logic for searching across multiple data sources

import type { ClinicalTrial, SearchParams } from '@/types/trials';
import type { PubMedArticle } from '@/types/papers';
import { pubmedAPI } from './pubmedAPI';
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
  totalCount: number;
  searchStrategies: StrategyResult[];
  strategiesUsed: number;
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
   * Enhance a user query using AI and return phrase-based discovery strategies
   * Generates EXACTLY 5 strategies focused on discovering drugs (not searching for known drugs)
   */
  private static async enhanceQuery(userQuery: string): Promise<SearchStrategy[]> {
    try {
      const response = await fetch('/api/enhance-search', {
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

      // Enforce limit of 5 strategies
      const strategies = data.strategies.slice(0, 5);

      console.log(`✅ Generated ${strategies.length} discovery strategies for: "${userQuery}"`);
      strategies.forEach((s, i) => {
        console.log(`  ${i+1}. [${s.priority}] ${s.searchType}: "${s.query}"`);
        console.log(`      → ${s.description}`);
      });

      return strategies;
    } catch (error) {
      console.error('Error enhancing search query:', error);
      // Fallback to basic search if enhancement fails
      return [{
        query: userQuery,
        description: 'Original query (fallback)',
        priority: 'high',
        searchType: 'broad'
      }];
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
   * Search for clinical trials using phrase-based discovery strategies
   * Executes 5 LLM-generated queries to UNCOVER drugs across all stages
   */
  private static async searchClinicalTrials(userQuery: string): Promise<{
    trials: ClinicalTrial[];
    searchStrategies: StrategyResult[];
  }> {
    try {
      // Get 5 phrase-based discovery strategies from AI
      const strategies = await this.enhanceQuery(userQuery);
      
      console.log(`🔍 Executing ${strategies.length} discovery searches in parallel...`);
      
      // Execute all 5 strategies in parallel (max 50 results per strategy)
      const strategyResults = await Promise.all(
        strategies.map(async (strategy) => {
          try {
            const result = await this.searchTrials({ query: strategy.query, pageSize: 50 });
            console.log(`  ✓ "${strategy.query}": ${result.trials.length} trials`);
            
            // Capture formatted queries for display
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
      
      console.log(`📊 Total trials across ${strategies.length} strategies: ${allTrials.length}`);

      // Deduplicate by NCT ID
      const uniqueTrials = allTrials.reduce((acc: ClinicalTrial[], current: ClinicalTrial) => {
        const existing = acc.find(trial => trial.nctId === current.nctId);
        if (!existing) {
          acc.push(current);
        }
        return acc;
      }, []);
      
      console.log(`✅ Unique trials after deduplication: ${uniqueTrials.length}`);
      console.log(`   Removed ${allTrials.length - uniqueTrials.length} duplicates (${Math.round((allTrials.length - uniqueTrials.length) / allTrials.length * 100)}%)`);
      
      // Apply ranking to prioritize most relevant
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
   * Search for research papers using phrase-based discovery strategies
   * Uses all 5 LLM-generated queries to maximize paper discovery
   */
  private static async searchResearchPapers(userQuery: string): Promise<PubMedArticle[]> {
    try {
      // Get 5 phrase-based discovery strategies from AI (same as trials)
      const strategies = await this.enhanceQuery(userQuery);
      
      console.log(`📄 Searching papers with ${strategies.length} discovery strategies...`);
      
      // Execute all 5 paper searches in parallel (30 results per strategy)
      const paperSearches = await Promise.all(
        strategies.map(async (strategy) => {
          try {
            const papers = await pubmedAPI.searchPapers({
              query: `${strategy.query} AND ("Clinical Trial"[Publication Type] OR "Randomized Controlled Trial"[Publication Type])`,
              maxResults: 30
            });
            console.log(`  ✓ "${strategy.query}": ${papers.length} papers`);
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
      
      console.log(`📄 Total papers: ${allPapers.length}, Unique: ${uniquePapers.length} (${Math.round((allPapers.length - uniquePapers.length) / allPapers.length * 100)}% duplicates)`);
      
      return uniquePapers;
    } catch (error) {
      console.error('Error searching research papers:', error);
      // Don't throw - just return empty array if papers fail
      return [];
    }
  }

  /**
   * Main method: Discover drugs through phrase-based searches
   * Orchestrates 5 LLM-generated queries for trials and 5 for papers
   * Goal: UNCOVER drugs across all stages (discovery → approved)
   */
  static async gatherSearchResults(userQuery: string): Promise<GatherSearchResultsResponse> {
    try {
      console.log(`\n🚀 Starting drug discovery search for: "${userQuery}"`);
      console.log(`   Strategy: Phrase-based discovery (NOT drug-specific)`);
      console.log('=' .repeat(80));
      
      // Search both clinical trials and research papers in parallel
      // Each uses 5 LLM-generated phrase-based queries
      const [trialsResult, papers] = await Promise.all([
        this.searchClinicalTrials(userQuery),
        this.searchResearchPapers(userQuery)
      ]);

      console.log(`\n✅ Discovery search complete!`);
      console.log(`   Unique trials: ${trialsResult.trials.length}`);
      console.log(`   Unique papers: ${papers.length}`);
      console.log(`   Discovery strategies: ${trialsResult.searchStrategies.length}`);
      console.log(`   → Now extract drug names from these ${trialsResult.trials.length + papers.length} results`);
      console.log('=' .repeat(80) + '\n');

      return {
        trials: trialsResult.trials,
        papers: papers,
        totalCount: trialsResult.trials.length,
        searchStrategies: trialsResult.searchStrategies,
        strategiesUsed: trialsResult.searchStrategies.length
      };
    } catch (error) {
      console.error('Error in discovery search:', error);
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
        searchStrategies: [{
          strategy: {
            query: userQuery,
            description: 'Direct search (no AI enhancement)',
            priority: 'high',
            searchType: 'targeted'
          },
          count: trialsResult.trials.length,
          trials: trialsResult.trials
        }],
        strategiesUsed: 1
      };
    } catch (error) {
      console.error('Error in simple search:', error);
      throw error;
    }
  }
}

