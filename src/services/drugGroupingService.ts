 
// Drug Grouping Service
// Groups papers and clinical trials by the drugs they mention

import type { PubMedArticle } from '@/types/papers';
import type { ClinicalTrial } from '@/types/trials';
import type { PressRelease } from '@/types/press-releases';
import type { IRDeck } from '@/types/ir-decks';

export interface DrugGroup {
  drugName: string;
  normalizedName: string;
  papers: PubMedArticle[];
  trials: ClinicalTrial[];
  pressReleases: PressRelease[];
  irDecks: IRDeck[];
  totalResults: number;
  hasBeenDeepDived?: boolean;
}

export class DrugGroupingService {
  /**
   * Check if a drug name should be excluded
   */
  private static shouldExcludeDrug(drugName: string): boolean {
    const normalized = drugName.toLowerCase().trim();
    
    // Exclude very short names (likely acronyms or not real drugs)
    if (normalized.length <= 3) {
      return true;
    }
    
    return false;
  }

  /**
   * Group papers and trials by drugs mentioned
   * NOTE: Pattern-based extraction is disabled. This method will return empty results.
   * Use AI-powered extraction (ExtractDrugNamesService) in the two-stage search flow instead.
   */
  static groupByDrugs(
    papers: PubMedArticle[],
    trials: ClinicalTrial[]
  ): DrugGroup[] {
    const drugMap = new Map<string, DrugGroup>();

    // Extract drugs from trials
    // Pattern-based extraction disabled - rely on AI extraction upstream
    trials.forEach(trial => {
      const drugs: string[] = [];
      drugs.forEach(drugName => {
        // Skip blacklisted drugs
        if (this.shouldExcludeDrug(drugName)) {
          return;
        }
        
        const normalized = this.normalizeDrugName(drugName);
        if (!drugMap.has(normalized)) {
          drugMap.set(normalized, {
            drugName: normalized,
            normalizedName: normalized.toLowerCase(),
            papers: [],
            trials: [],
            pressReleases: [],
            irDecks: [],
            totalResults: 0,
          });
        }
        const group = drugMap.get(normalized)!;
        if (!group.trials.some(t => t.nctId === trial.nctId)) {
          group.trials.push(trial);
        }
      });
    });

    // Extract drugs from papers
    // Pattern-based extraction disabled - rely on AI extraction upstream
    papers.forEach(paper => {
      const drugs: string[] = [];
      drugs.forEach(drugName => {
        // Skip blacklisted drugs
        if (this.shouldExcludeDrug(drugName)) {
          return;
        }
        
        const normalized = this.normalizeDrugName(drugName);
        if (!drugMap.has(normalized)) {
          drugMap.set(normalized, {
            drugName: normalized,
            normalizedName: normalized.toLowerCase(),
            papers: [],
            trials: [],
            pressReleases: [],
            irDecks: [],
            totalResults: 0,
          });
        }
        const group = drugMap.get(normalized)!;
        if (!group.papers.some(p => p.pmid === paper.pmid)) {
          group.papers.push(paper);
        }
      });
    });

    // Calculate total results and sort
    const groups = Array.from(drugMap.values()).map(group => ({
      ...group,
      totalResults: group.papers.length + group.trials.length,
    }));

    // Sort by total results (descending)
    return groups.sort((a, b) => b.totalResults - a.totalResults);
  }

  /**
   * Normalize drug names for consistency
   */
  private static normalizeDrugName(drugName: string): string {
    // Capitalize first letter and return
    return drugName.charAt(0).toUpperCase() + drugName.slice(1);
  }

  /**
   * Filter drug groups by search query
   */
  static filterDrugGroups(groups: DrugGroup[], query: string): DrugGroup[] {
    if (!query.trim()) return groups;

    const lowerQuery = query.toLowerCase();
    return groups.filter(group =>
      group.drugName.toLowerCase().includes(lowerQuery) ||
      group.papers.some(p => 
        p.title.toLowerCase().includes(lowerQuery) ||
        p.abstract.toLowerCase().includes(lowerQuery)
      ) ||
      group.trials.some(t =>
        t.briefTitle.toLowerCase().includes(lowerQuery)
      )
    );
  }
}

