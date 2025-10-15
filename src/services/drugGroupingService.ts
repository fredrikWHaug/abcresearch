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
   * Group papers and trials by drugs mentioned
   */
  static groupByDrugs(
    papers: PubMedArticle[],
    trials: ClinicalTrial[]
  ): DrugGroup[] {
    const drugMap = new Map<string, DrugGroup>();

    // Extract drugs from trials
    trials.forEach(trial => {
      const drugs = this.extractDrugsFromTrial(trial);
      drugs.forEach(drugName => {
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
    papers.forEach(paper => {
      const drugs = this.extractDrugsFromPaper(paper);
      drugs.forEach(drugName => {
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
   * Extract drug names from a clinical trial
   */
  private static extractDrugsFromTrial(trial: ClinicalTrial): string[] {
    const drugs = new Set<string>();

    if (trial.interventions) {
      trial.interventions.forEach(intervention => {
        // Extract drug name from intervention string (format: "Drug: DrugName" or "Biological: DrugName")
        const drugMatch = intervention.match(/(?:Drug|Biological|Other):\s*(.+)/i);
        if (drugMatch) {
          const drugName = drugMatch[1].trim();
          // Clean up common suffixes
          const cleanedName = drugName
            .replace(/\s*\(.*?\)/g, '') // Remove parentheses
            .replace(/\s+\d+\s*mg.*$/i, '') // Remove dosage
            .replace(/\s+tablets?$/i, '') // Remove "tablet(s)"
            .replace(/\s+injection$/i, '') // Remove "injection"
            .trim();
          
          if (cleanedName && cleanedName.length > 2) {
            drugs.add(cleanedName);
          }
        } else {
          // If no type prefix, just use the intervention name
          const cleanedName = intervention
            .replace(/\s*\(.*?\)/g, '')
            .replace(/\s+\d+\s*mg.*$/i, '')
            .trim();
          if (cleanedName && cleanedName.length > 2) {
            drugs.add(cleanedName);
          }
        }
      });
    }

    // Also check the title for drug names
    const titleDrugs = this.extractDrugsFromText(trial.briefTitle);
    titleDrugs.forEach(drug => drugs.add(drug));

    return Array.from(drugs);
  }

  /**
   * Extract drug names from a paper
   */
  private static extractDrugsFromPaper(paper: PubMedArticle): string[] {
    const drugs = new Set<string>();

    // Extract from title and abstract
    const text = `${paper.title} ${paper.abstract}`;
    const extractedDrugs = this.extractDrugsFromText(text);
    extractedDrugs.forEach(drug => drugs.add(drug));

    return Array.from(drugs);
  }

  /**
   * Extract drug names from text using pattern matching
   */
  private static extractDrugsFromText(text: string): string[] {
    const drugs = new Set<string>();

    // Check against known drug synonyms
    Object.entries(this.DRUG_SYNONYMS).forEach(([primaryName, synonyms]) => {
      synonyms.forEach(synonym => {
        const regex = new RegExp(`\\b${synonym}\\b`, 'gi');
        if (regex.test(text)) {
          drugs.add(primaryName);
        }
      });
    });

    // Pattern matching for common drug naming conventions
    // Drugs ending in -mab (monoclonal antibodies)
    const mabMatches = text.match(/\b[A-Z][a-z]+mab\b/g);
    if (mabMatches) {
      mabMatches.forEach(drug => drugs.add(drug));
    }

    // Drugs ending in -tinib (tyrosine kinase inhibitors)
    const tinibMatches = text.match(/\b[A-Z][a-z]+tinib\b/g);
    if (tinibMatches) {
      tinibMatches.forEach(drug => drugs.add(drug));
    }

    // Drugs ending in -tide (peptides)
    const tideMatches = text.match(/\b[A-Z][a-z]+tide\b/g);
    if (tideMatches) {
      tideMatches.forEach(drug => drugs.add(drug));
    }

    // Drugs ending in -ine
    const ineMatches = text.match(/\b[A-Z][a-z]{5,}ine\b/g);
    if (ineMatches) {
      ineMatches.forEach(drug => drugs.add(drug));
    }

    return Array.from(drugs);
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

