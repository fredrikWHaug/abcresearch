import type { ClinicalTrial } from '@/types/trials';
import type { PubMedArticle } from '@/types/papers';

export interface DrugInfo {
  name: string;
  type?: string; // e.g., "drug", "intervention", "therapy"
  confidence: 'high' | 'medium' | 'low';
  source: string; // Which trial or paper it came from
  sourceType: 'trial' | 'paper';
}

interface ExtractDrugNamesResponse {
  success: boolean;
  drugs: Omit<DrugInfo, 'source' | 'sourceType'>[];
  error?: string;
  details?: string;
}

export class ExtractDrugNamesService {
  // Track failed extractions for debugging
  private static failedExtractions: Array<{ id: string; error: string }> = [];

  /**
   * Call the extract-drug-names API proxy
   */
  private static async callExtractAPI(
    text: string, 
    context: 'clinical_trial' | 'research_paper' | 'general' = 'general',
    userQuery?: string
  ): Promise<Omit<DrugInfo, 'source' | 'sourceType'>[]> {
    try {
      const response = await fetch('/api/extract-drug-names', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          context,
          userQuery
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Drug extraction API error:', errorData);
        throw new Error(errorData.error || `Drug extraction failed: ${response.status}`);
      }

      const data: ExtractDrugNamesResponse = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Drug extraction failed');
      }

      return data.drugs || [];
    } catch (error) {
      console.error('Error calling extract-drug-names API:', error);
      throw error;
    }
  }

  /**
   * Extract drug names from a single clinical trial
   */
  static async extractFromTrial(trial: ClinicalTrial, userQuery?: string): Promise<DrugInfo[]> {
    try {
      // Combine relevant text from the trial
      const text = [
        trial.briefTitle,
        trial.officialTitle,
        ...(trial.interventions || []),
        ...(trial.conditions || [])
      ].filter(Boolean).join(' ');

      const drugs = await this.callExtractAPI(text, 'clinical_trial', userQuery);
      
      // Add source information
      return drugs.map(drug => ({
        ...drug,
        source: trial.nctId,
        sourceType: 'trial' as const
      }));
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Failed to extract drugs from trial ${trial.nctId}:`, errorMsg);
      this.failedExtractions.push({ id: trial.nctId, error: errorMsg });
      return [];
    }
  }

  /**
   * Extract drug names from multiple clinical trials
   */
  static async extractFromTrials(trials: ClinicalTrial[], userQuery?: string): Promise<DrugInfo[]> {
    // Process trials in batches to avoid overwhelming the API
    const batchSize = 5;
    const allDrugs: DrugInfo[] = [];

    for (let i = 0; i < trials.length; i += batchSize) {
      const batch = trials.slice(i, i + batchSize);
      const batchPromises = batch.map(trial => this.extractFromTrial(trial, userQuery));
      const batchResults = await Promise.all(batchPromises);
      
      // Flatten results
      allDrugs.push(...batchResults.flat());
      
      // Small delay between batches to respect rate limits
      if (i + batchSize < trials.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Return raw drugs with source information (don't deduplicate yet)
    return allDrugs;
  }

  /**
   * Extract drug names from a single research paper
   */
  static async extractFromPaper(paper: PubMedArticle, userQuery?: string): Promise<DrugInfo[]> {
    try {
      // Combine relevant text from the paper
      const text = [
        paper.title,
        paper.abstract
      ].filter(Boolean).join(' ');

      // Validate that we have text content before calling API (Issue 1 Fix)
      if (!text || text.trim().length === 0) {
        console.warn(`Skipping paper ${paper.pmid}: No text content available`);
        return [];
      }

      const drugs = await this.callExtractAPI(text, 'research_paper', userQuery);
      
      // Add source information
      return drugs.map(drug => ({
        ...drug,
        source: paper.pmid,
        sourceType: 'paper' as const
      }));
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Failed to extract drugs from paper ${paper.pmid}:`, errorMsg);
      this.failedExtractions.push({ id: paper.pmid, error: errorMsg });
      return [];
    }
  }

  /**
   * Extract drug names from multiple research papers
   */
  static async extractFromPapers(papers: PubMedArticle[], userQuery?: string): Promise<DrugInfo[]> {
    // Process papers in batches to avoid overwhelming the API
    const batchSize = 5;
    const allDrugs: DrugInfo[] = [];

    for (let i = 0; i < papers.length; i += batchSize) {
      const batch = papers.slice(i, i + batchSize);
      const batchPromises = batch.map(paper => this.extractFromPaper(paper, userQuery));
      const batchResults = await Promise.all(batchPromises);
      
      // Flatten results
      allDrugs.push(...batchResults.flat());
      
      // Small delay between batches to respect rate limits
      if (i + batchSize < papers.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Return raw drugs with source information (don't deduplicate yet)
    return allDrugs;
  }

  /**
   * Extract drug names from all search results (trials and papers)
   */
  static async extractFromSearchResults(
    trials: ClinicalTrial[], 
    papers: PubMedArticle[],
    userQuery?: string
  ): Promise<{
    allDrugs: DrugInfo[];
    trialDrugs: DrugInfo[];
    paperDrugs: DrugInfo[];
    uniqueDrugNames: string[];
    deduplicationWarning?: string;
  }> {
    try {
      // Extract from both trials and papers in parallel
      const [trialDrugs, paperDrugs] = await Promise.all([
        this.extractFromTrials(trials, userQuery), // Extract from all trials
        this.extractFromPapers(papers, userQuery)  // Extract from all papers
      ]);

      // Combine all drugs
      const allDrugs = [...trialDrugs, ...paperDrugs];
      
      // Try to deduplicate, but if it fails, continue with undeduped list
      let deduplicatedDrugs: DrugInfo[];
      let deduplicationWarning: string | undefined;
      
      try {
        deduplicatedDrugs = await this.deduplicateDrugs(allDrugs);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.warn('⚠️ Deduplication failed, using basic deduplication:', errorMsg);
        
        // Fall back to basic deduplication by name (case-insensitive)
        const seen = new Map<string, DrugInfo>();
        for (const drug of allDrugs) {
          const key = drug.name.toLowerCase();
          const existing = seen.get(key);
          // Keep the one with higher confidence
          if (!existing || drug.confidence === 'high' || (drug.confidence === 'medium' && existing.confidence === 'low')) {
            seen.set(key, drug);
          }
        }
        deduplicatedDrugs = Array.from(seen.values());

        // Set warning message for user
        deduplicationWarning = `⚠️ Advanced deduplication unavailable. Using basic deduplication - some duplicate drugs (brand/generic names) may appear separately in results.`;
      }

      // Filter to only high-confidence drugs
      const highConfidenceDrugs = deduplicatedDrugs.filter(drug => drug.confidence === 'high');

      // Get unique drug names
      const uniqueDrugNames = [...new Set(highConfidenceDrugs.map(d => d.name))];

      // Log failed extractions if any
      if (this.failedExtractions.length > 0) {
        console.warn(`Failed to extract drugs from ${this.failedExtractions.length} items:`, this.failedExtractions);
        // Clear failed extractions after logging
        this.failedExtractions = [];
      }

      return {
        allDrugs: highConfidenceDrugs,
        trialDrugs,
        paperDrugs,
        uniqueDrugNames,
        deduplicationWarning
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Error extracting drugs from search results:', errorMsg);
      
      // Return error to be displayed on frontend
      throw new Error(`Failed to extract drug names: ${errorMsg}`);
    }
  }

  /**
   * Deduplicate drugs using LLM to handle synonyms, spelling variations, and brand/generic names
   * Now calls server-side API to avoid exposing API keys in the browser
   */
  private static async deduplicateDrugs(drugs: DrugInfo[]): Promise<DrugInfo[]> {
    // If list is small or empty, no need for LLM deduplication
    if (drugs.length <= 1) {
      return drugs;
    }

    try {
      const response = await fetch('/api/deduplicate-drugs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ drugs })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Drug deduplication API error:', errorData);
        throw new Error(errorData.error || `Deduplication failed: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Deduplication failed');
      }

      return data.drugs;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error in LLM deduplication:', errorMsg);
      throw new Error(`Drug deduplication failed: ${errorMsg}`);
    }
  }

  /**
   * Get drugs by type (filter results)
   */
  static filterByType(drugs: DrugInfo[], type: string): DrugInfo[] {
    return drugs.filter(drug => drug.type === type);
  }

  /**
   * Get drugs by confidence level
   */
  static filterByConfidence(drugs: DrugInfo[], confidence: 'high' | 'medium' | 'low'): DrugInfo[] {
    return drugs.filter(drug => drug.confidence === confidence);
  }

  /**
   * Get high confidence drugs only
   */
  static getHighConfidenceDrugs(drugs: DrugInfo[]): DrugInfo[] {
    return drugs.filter(drug => drug.confidence === 'high');
  }

  /**
   * Get and clear failed extractions
   */
  static getFailedExtractions(): Array<{ id: string; error: string }> {
    const failed = [...this.failedExtractions];
    this.failedExtractions = [];
    return failed;
  }
}

