// Drug Grouping Service
// Groups papers and clinical trials by the drugs they mention

import type { PubMedArticle } from '@/types/papers';
import type { ClinicalTrial } from '@/types/trials';

export interface DrugGroup {
  drugName: string;
  normalizedName: string;
  papers: PubMedArticle[];
  trials: ClinicalTrial[];
  totalResults: number;
}

export class DrugGroupingService {
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

  // Common drug name mappings and synonyms
  private static readonly DRUG_SYNONYMS: Record<string, string[]> = {
    'Semaglutide': ['Ozempic', 'Wegovy', 'Rybelsus', 'semaglutide'],
    'Tirzepatide': ['Mounjaro', 'Zepbound', 'tirzepatide'],
    'Liraglutide': ['Victoza', 'Saxenda', 'liraglutide'],
    'Dulaglutide': ['Trulicity', 'dulaglutide'],
    'Exenatide': ['Byetta', 'Bydureon', 'exenatide'],
    'Pembrolizumab': ['Keytruda', 'pembrolizumab'],
    'Nivolumab': ['Opdivo', 'nivolumab'],
    'Atezolizumab': ['Tecentriq', 'atezolizumab'],
    'Durvalumab': ['Imfinzi', 'durvalumab'],
    'Ipilimumab': ['Yervoy', 'ipilimumab'],
  };

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
    
    // Exclude if it's just a drug class (ends with common class suffixes without specific drug name)
    const genericClassPatterns = [
      /^glp-?\d+$/i,
      /^sglt-?\d+$/i,
      /^dpp-?\d+$/i,
    ];
    
    if (genericClassPatterns.some(pattern => pattern.test(normalized))) {
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
   * Normalize drug names using known synonyms
   */
  private static normalizeDrugName(drugName: string): string {
    // Check if this drug is a synonym of a known drug
    for (const [primaryName, synonyms] of Object.entries(this.DRUG_SYNONYMS)) {
      if (synonyms.some(syn => syn.toLowerCase() === drugName.toLowerCase())) {
        return primaryName;
      }
    }

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

