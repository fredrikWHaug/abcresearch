// Extract Drug Names Service
// Business logic for extracting drug names from clinical trials and research papers
// Calls extract-drug-names API proxy

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
}

export class ExtractDrugNamesService {
  // Blacklist of non-drug terms to exclude
  private static readonly DRUG_BLACKLIST = new Set([
    'placebo',
    'glp-1',
    'glp1',
    'sglt2',
    'dpp-4',
    'ace inhibitor',
    'beta blocker',
    'calcium channel blocker',
    'statin',
    'insulin',
    'metformin', // too generic
    'aspirin', // too generic
    'control',
    'standard care',
    'standard of care',
    'usual care',
    'best supportive care',
    'chemotherapy', // too generic
    'radiation',
    'surgery',
    'combination',
    'monotherapy',
    'therapy',
    'treatment',
    'intervention',
    'drug',
    'medication',
    'agent',
  ]);

  /**
   * Check if a drug name should be excluded
   */
  private static shouldExcludeDrug(drugName: string): boolean {
    const normalized = drugName.toLowerCase().trim();
    
    // Exclude if in blacklist
    if (this.DRUG_BLACKLIST.has(normalized)) {
      return true;
    }
    
    // Exclude very short names (likely acronyms or not real drugs)
    if (normalized.length <= 3) {
      return true;
    }
    
    // Exclude if it's just a drug class (ends with common class suffixes without proper drug name)
    const genericClassPatterns = [
      /^glp-?\d+/i,
      /^sglt-?\d+/i,
      /^dpp-?\d+/i,
      /\binhibitor$/i,
      /\bblocker$/i,
      /receptor\s+agonist$/i,
      /receptor\s+antagonist$/i,
    ];
    
    if (genericClassPatterns.some(pattern => pattern.test(normalized))) {
      return true;
    }
    
    // Exclude generic terms
    const genericTerms = [
      /^active\s+/i,
      /^experimental\s+/i,
      /^investigational\s+/i,
      /^standard\s+/i,
      /^conventional\s+/i,
    ];
    
    if (genericTerms.some(pattern => pattern.test(normalized))) {
      return true;
    }
    
    return false;
  }

  /**
   * Call the extract-drug-names API proxy
   */
  private static async callExtractAPI(
    text: string, 
    context: 'clinical_trial' | 'research_paper' | 'general' = 'general'
  ): Promise<Omit<DrugInfo, 'source' | 'sourceType'>[]> {
    try {
      const response = await fetch('/api/extract-drug-names', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          context
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Drug extraction API error:', errorData);
        return [];
      }

      const data: ExtractDrugNamesResponse = await response.json();
      
      if (!data.success) {
        return [];
      }

      return data.drugs || [];
    } catch (error) {
      console.error('Error calling extract-drug-names API:', error);
      return [];
    }
  }

  /**
   * Extract drug names from a single clinical trial
   */
  static async extractFromTrial(trial: ClinicalTrial): Promise<DrugInfo[]> {
    // Combine relevant text from the trial
    const text = [
      trial.briefTitle,
      trial.officialTitle,
      ...(trial.interventions || []),
      ...(trial.conditions || [])
    ].filter(Boolean).join(' ');

    const drugs = await this.callExtractAPI(text, 'clinical_trial');
    
    // Add source information
    return drugs.map(drug => ({
      ...drug,
      source: trial.nctId,
      sourceType: 'trial' as const
    }));
  }

  /**
   * Extract drug names from multiple clinical trials
   */
  static async extractFromTrials(trials: ClinicalTrial[]): Promise<DrugInfo[]> {
    // Process trials in batches to avoid overwhelming the API
    const batchSize = 5;
    const allDrugs: DrugInfo[] = [];

    for (let i = 0; i < trials.length; i += batchSize) {
      const batch = trials.slice(i, i + batchSize);
      const batchPromises = batch.map(trial => this.extractFromTrial(trial));
      const batchResults = await Promise.all(batchPromises);
      
      // Flatten results
      allDrugs.push(...batchResults.flat());
      
      // Small delay between batches to respect rate limits
      if (i + batchSize < trials.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Deduplicate drugs by name
    return this.deduplicateDrugs(allDrugs);
  }

  /**
   * Extract drug names from a single research paper
   */
  static async extractFromPaper(paper: PubMedArticle): Promise<DrugInfo[]> {
    // Combine relevant text from the paper
    const text = [
      paper.title,
      paper.abstract
    ].filter(Boolean).join(' ');

    const drugs = await this.callExtractAPI(text, 'research_paper');
    
    // Add source information
    return drugs.map(drug => ({
      ...drug,
      source: paper.pmid,
      sourceType: 'paper' as const
    }));
  }

  /**
   * Extract drug names from multiple research papers
   */
  static async extractFromPapers(papers: PubMedArticle[]): Promise<DrugInfo[]> {
    // Process papers in batches to avoid overwhelming the API
    const batchSize = 5;
    const allDrugs: DrugInfo[] = [];

    for (let i = 0; i < papers.length; i += batchSize) {
      const batch = papers.slice(i, i + batchSize);
      const batchPromises = batch.map(paper => this.extractFromPaper(paper));
      const batchResults = await Promise.all(batchPromises);
      
      // Flatten results
      allDrugs.push(...batchResults.flat());
      
      // Small delay between batches to respect rate limits
      if (i + batchSize < papers.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Deduplicate drugs by name
    return this.deduplicateDrugs(allDrugs);
  }

  /**
   * Extract drug names from all search results (trials and papers)
   */
  static async extractFromSearchResults(
    trials: ClinicalTrial[], 
    papers: PubMedArticle[]
  ): Promise<{
    allDrugs: DrugInfo[];
    trialDrugs: DrugInfo[];
    paperDrugs: DrugInfo[];
    uniqueDrugNames: string[];
  }> {
    try {
      // Extract from both trials and papers in parallel
      const [trialDrugs, paperDrugs] = await Promise.all([
        this.extractFromTrials(trials.slice(0, 20)), // Limit to first 20 trials
        this.extractFromPapers(papers.slice(0, 20))  // Limit to first 20 papers
      ]);

      // Combine all drugs
      const allDrugs = [...trialDrugs, ...paperDrugs];
      const deduplicatedDrugs = this.deduplicateDrugs(allDrugs);

      // Filter to only high-confidence drugs and exclude blacklisted terms
      const highConfidenceDrugs = deduplicatedDrugs.filter(drug => {
        // Only include high confidence
        if (drug.confidence !== 'high') {
          return false;
        }
        
        // Exclude blacklisted terms
        if (this.shouldExcludeDrug(drug.name)) {
          console.log(`Excluding drug: ${drug.name} (blacklisted or generic)`);
          return false;
        }
        
        return true;
      });

      // Get unique drug names
      const uniqueDrugNames = [...new Set(highConfidenceDrugs.map(d => d.name))];

      console.log(`Filtered to ${uniqueDrugNames.length} high-confidence drugs from ${deduplicatedDrugs.length} total`);

      return {
        allDrugs: highConfidenceDrugs,
        trialDrugs,
        paperDrugs,
        uniqueDrugNames
      };
    } catch (error) {
      console.error('Error extracting drugs from search results:', error);
      return {
        allDrugs: [],
        trialDrugs: [],
        paperDrugs: [],
        uniqueDrugNames: []
      };
    }
  }

  /**
   * Deduplicate drugs by name (keep highest confidence)
   */
  private static deduplicateDrugs(drugs: DrugInfo[]): DrugInfo[] {
    const drugMap = new Map<string, DrugInfo>();
    
    const confidenceRank = { high: 3, medium: 2, low: 1 };
    
    for (const drug of drugs) {
      const normalizedName = drug.name.toLowerCase().trim();
      const existing = drugMap.get(normalizedName);
      
      if (!existing) {
        drugMap.set(normalizedName, drug);
      } else {
        // Keep the drug with higher confidence
        if (confidenceRank[drug.confidence] > confidenceRank[existing.confidence]) {
          drugMap.set(normalizedName, drug);
        }
      }
    }
    
    return Array.from(drugMap.values());
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
}

