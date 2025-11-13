// Paper Linking Service
// Links academic papers to clinical trials based on various criteria

import type { PubMedArticle, PubMedSearchParams } from '@/types/papers';
import type { ClinicalTrial } from '@/types/trials';

/**
 * Get API base URL - handles both browser and test environments
 */
function getApiBaseUrl(): string {
  // In test environment, use TEST_SERVER_URL if provided
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
 * Build full API URL for fetch calls
 */
function buildApiUrl(path: string): string {
  const baseUrl = getApiBaseUrl();
  return `${baseUrl}${path}`;
}

export interface PaperTrialLink {
  trial: ClinicalTrial;
  papers: PubMedArticle[];
  linkStrength: 'strong' | 'moderate' | 'weak';
  linkReasons: string[];
}

export class PaperLinkingService {
  /**
   * Search PubMed for papers using API endpoint
   */
  private static async searchPapers(params: PubMedSearchParams): Promise<PubMedArticle[]> {
    try {
      const response = await fetch(buildApiUrl('/api/search-papers'), {
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
   * Find papers for a specific clinical trial
   */
  private static async findPapersForTrialByNCT(nctId: string): Promise<PubMedArticle[]> {
    const query = `${nctId}[Title/Abstract] OR ${nctId}[Secondary Source ID]`;
    return this.searchPapers({ query, maxResults: 10 });
  }

  /**
   * Search for papers by drug and condition
   */
  private static async searchByDrugCondition(drug: string, condition: string): Promise<PubMedArticle[]> {
    const query = `"${drug}" AND "${condition}" AND ("Clinical Trial"[Publication Type] OR "Randomized Controlled Trial"[Publication Type])`;
    return this.searchPapers({ 
      query, 
      maxResults: 20,
      startDate: '2020/01/01'
    });
  }

  /**
   * Find papers for a single clinical trial
   */
  static async findPapersForTrial(trial: ClinicalTrial): Promise<PaperTrialLink> {
    const papers: PubMedArticle[] = [];
    const linkReasons: string[] = [];

    try {
      // 1. Direct NCT ID search
      const nctPapers = await this.findPapersForTrialByNCT(trial.nctId);
      if (nctPapers.length > 0) {
        papers.push(...nctPapers);
        linkReasons.push(`Direct NCT ID match: ${nctPapers.length} papers`);
      }

      // 2. Search by drug and condition
      if (trial.interventions && trial.conditions) {
        for (const drug of trial.interventions.slice(0, 2)) { // Limit to first 2 drugs
          for (const condition of trial.conditions.slice(0, 2)) { // Limit to first 2 conditions
            const drugConditionPapers = await this.searchByDrugCondition(drug, condition);
            papers.push(...drugConditionPapers);
          }
        }
        linkReasons.push(`Drug-condition search: ${papers.length} papers`);
      }

      // 3. Search by sponsor if available
      if (trial.sponsors?.lead) {
        const sponsorQuery = `"${trial.sponsors.lead}"[Author] AND ("Clinical Trial"[Publication Type] OR "Randomized Controlled Trial"[Publication Type])`;
        const sponsorPapers = await this.searchPapers({ 
          query: sponsorQuery, 
          maxResults: 10 
        });
        papers.push(...sponsorPapers);
        linkReasons.push(`Sponsor search: ${sponsorPapers.length} papers`);
      }

      // Remove duplicates and calculate link strength
      const uniquePapers = this.deduplicatePapers(papers);
      const linkStrength = this.calculateLinkStrength(uniquePapers, trial);

      return {
        trial,
        papers: uniquePapers,
        linkStrength,
        linkReasons
      };
    } catch (error) {
      console.error('Error finding papers for trial:', error);
      return {
        trial,
        papers: [],
        linkStrength: 'weak',
        linkReasons: ['Error occurred during search']
      };
    }
  }

  /**
   * Find papers for multiple trials (batch processing)
   */
  static async findPapersForTrials(trials: ClinicalTrial[]): Promise<PaperTrialLink[]> {
    const results: PaperTrialLink[] = [];
    
    // Process trials in batches to avoid rate limiting
    const batchSize = 5;
    for (let i = 0; i < trials.length; i += batchSize) {
      const batch = trials.slice(i, i + batchSize);
      const batchPromises = batch.map(trial => this.findPapersForTrial(trial));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Add delay between batches to respect rate limits (350ms per request + buffer)
      if (i + batchSize < trials.length) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay between batches
      }
    }
    
    return results;
  }

  /**
   * Search for papers related to a market map query
   */
  static async searchPapersForQuery(query: string, trials: ClinicalTrial[]): Promise<{
    queryPapers: PubMedArticle[];
    trialLinks: PaperTrialLink[];
  }> {
    try {
      // Search for papers related to the overall query
      const queryPapers = await this.searchPapers({
        query: `${query} AND ("Clinical Trial"[Publication Type] OR "Randomized Controlled Trial"[Publication Type])`,
        maxResults: 50
      });

      // Find papers for individual trials
      const trialLinks = await this.findPapersForTrials(trials);

      return {
        queryPapers,
        trialLinks
      };
    } catch (error) {
      console.error('Error searching papers for query:', error);
      return {
        queryPapers: [],
        trialLinks: []
      };
    }
  }

  /**
   * Remove duplicate papers based on PMID
   */
  private static deduplicatePapers(papers: PubMedArticle[]): PubMedArticle[] {
    const seen = new Set<string>();
    return papers.filter(paper => {
      if (seen.has(paper.pmid)) {
        return false;
      }
      seen.add(paper.pmid);
      return true;
    });
  }

  /**
   * Calculate link strength between papers and trial
   */
  private static calculateLinkStrength(papers: PubMedArticle[], trial: ClinicalTrial): 'strong' | 'moderate' | 'weak' {
    if (papers.length === 0) return 'weak';
    
    // Check for direct NCT matches
    const directMatches = papers.filter(p => p.nctNumber === trial.nctId);
    if (directMatches.length > 0) return 'strong';
    
    // Check for high-relevance papers
    const highRelevancePapers = papers.filter(p => p.relevanceScore >= 80);
    if (highRelevancePapers.length >= 2) return 'strong';
    if (highRelevancePapers.length >= 1) return 'moderate';
    
    // Check for premium journal papers
    const premiumPapers = papers.filter(p => {
      const premiumJournals = ['New England Journal', 'JAMA', 'Lancet', 'Nature Medicine'];
      return premiumJournals.some(j => p.journal.includes(j));
    });
    if (premiumPapers.length >= 1) return 'moderate';
    
    return 'weak';
  }
}

export const paperLinkingService = new PaperLinkingService();
