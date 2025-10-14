// Drug Grouping Service
// Groups clinical trials and research papers by specific drugs/interventions

import type { ClinicalTrial } from './clinicalTrialsAPI';
import type { PubMedArticle } from './pubmedAPI';

export interface DrugGroup {
  drugName: string;
  normalizedName: string;
  trials: ClinicalTrial[];
  papers: PubMedArticle[];
  totalCount: number;
  category?: string; // e.g., "Drug", "Biological", "Procedure", "Device"
}

export interface GroupedResults {
  groups: DrugGroup[];
  ungrouped: {
    trials: ClinicalTrial[];
    papers: PubMedArticle[];
  };
  totalDrugs: number;
}

export class DrugGroupingService {
  /**
   * Main function to group trials and papers by drug
   */
  static groupByDrug(trials: ClinicalTrial[], papers: PubMedArticle[]): GroupedResults {
    // Extract all unique drugs from trials
    const drugMap = new Map<string, DrugGroup>();
    
    // Process trials to extract drugs
    trials.forEach(trial => {
      const drugs = this.extractDrugsFromTrial(trial);
      
      drugs.forEach(drug => {
        const normalized = this.normalizeDrugName(drug.name);
        
        if (!drugMap.has(normalized)) {
          drugMap.set(normalized, {
            drugName: drug.name,
            normalizedName: normalized,
            trials: [],
            papers: [],
            totalCount: 0,
            category: drug.category
          });
        }
        
        const group = drugMap.get(normalized)!;
        if (!group.trials.find(t => t.nctId === trial.nctId)) {
          group.trials.push(trial);
        }
      });
    });
    
    // Match papers to drug groups
    papers.forEach(paper => {
      const matchedDrugs = this.matchPaperToDrugs(paper, Array.from(drugMap.keys()));
      
      matchedDrugs.forEach(normalizedDrug => {
        const group = drugMap.get(normalizedDrug);
        if (group && !group.papers.find(p => p.pmid === paper.pmid)) {
          group.papers.push(paper);
        }
      });
    });
    
    // Calculate total counts and sort
    const groups = Array.from(drugMap.values())
      .map(group => ({
        ...group,
        totalCount: group.trials.length + group.papers.length
      }))
      .filter(group => group.totalCount > 0) // Only include drugs with results
      .sort((a, b) => b.totalCount - a.totalCount); // Sort by total count
    
    // Identify ungrouped items (trials/papers not associated with any drug)
    const groupedTrialIds = new Set(
      groups.flatMap(g => g.trials.map(t => t.nctId))
    );
    const groupedPaperIds = new Set(
      groups.flatMap(g => g.papers.map(p => p.pmid))
    );
    
    const ungrouped = {
      trials: trials.filter(t => !groupedTrialIds.has(t.nctId)),
      papers: papers.filter(p => !groupedPaperIds.has(p.pmid))
    };
    
    return {
      groups,
      ungrouped,
      totalDrugs: groups.length
    };
  }
  
  /**
   * Extract drugs from a clinical trial
   */
  private static extractDrugsFromTrial(trial: ClinicalTrial): Array<{ name: string; category: string }> {
    const drugs: Array<{ name: string; category: string }> = [];
    
    if (!trial.interventions || trial.interventions.length === 0) {
      return drugs;
    }
    
    trial.interventions.forEach(intervention => {
      // Parse intervention format: "Type: Name" or just "Name"
      const parts = intervention.split(':').map(p => p.trim());
      let type = 'Other';
      let name = intervention;
      
      if (parts.length === 2) {
        type = parts[0];
        name = parts[1];
      }
      
      // Skip very generic interventions
      if (this.isGenericIntervention(name)) {
        return;
      }
      
      // Categorize intervention type
      const category = this.categorizeIntervention(type);
      
      drugs.push({ name, category });
    });
    
    return drugs;
  }
  
  /**
   * Normalize drug names for grouping (handle variations)
   */
  private static normalizeDrugName(name: string): string {
    return name
      .toLowerCase()
      .trim()
      // Remove common suffixes
      .replace(/\s+(injection|tablet|capsule|solution|suspension)$/i, '')
      // Remove dosage information
      .replace(/\s+\d+\s*(mg|g|ml|mcg|%)/gi, '')
      // Remove parenthetical information
      .replace(/\s*\([^)]*\)/g, '')
      .trim();
  }
  
  /**
   * Match a paper to drug groups based on title and abstract
   */
  private static matchPaperToDrugs(paper: PubMedArticle, normalizedDrugNames: string[]): string[] {
    const searchText = `${paper.title} ${paper.abstract}`.toLowerCase();
    const matches: string[] = [];
    
    normalizedDrugNames.forEach(drugName => {
      // Check if drug name appears in paper text
      if (searchText.includes(drugName)) {
        matches.push(drugName);
      }
    });
    
    return matches;
  }
  
  /**
   * Check if intervention name is too generic to be useful
   */
  private static isGenericIntervention(name: string): boolean {
    const genericTerms = [
      'placebo',
      'standard care',
      'usual care',
      'best supportive care',
      'observation',
      'no intervention',
      'other',
      'behavioral',
      'procedure',
      'device',
      'radiation',
      'surgery'
    ];
    
    const lowerName = name.toLowerCase();
    return genericTerms.some(term => lowerName === term || lowerName.startsWith(term + ':'));
  }
  
  /**
   * Categorize intervention type
   */
  private static categorizeIntervention(type: string): string {
    const typeMap: Record<string, string> = {
      'drug': 'Drug',
      'biological': 'Biological',
      'procedure': 'Procedure',
      'device': 'Device',
      'diagnostic test': 'Diagnostic',
      'dietary supplement': 'Supplement',
      'radiation': 'Radiation',
      'behavioral': 'Behavioral',
      'genetic': 'Genetic',
      'combination product': 'Combination'
    };
    
    const lowerType = type.toLowerCase();
    return typeMap[lowerType] || 'Other';
  }
  
  /**
   * Get statistics about drug groups
   */
  static getGroupStatistics(groupedResults: GroupedResults): {
    totalGroups: number;
    avgTrialsPerDrug: number;
    avgPapersPerDrug: number;
    topDrugs: Array<{ name: string; count: number }>;
  } {
    const { groups } = groupedResults;
    
    if (groups.length === 0) {
      return {
        totalGroups: 0,
        avgTrialsPerDrug: 0,
        avgPapersPerDrug: 0,
        topDrugs: []
      };
    }
    
    const totalTrials = groups.reduce((sum, g) => sum + g.trials.length, 0);
    const totalPapers = groups.reduce((sum, g) => sum + g.papers.length, 0);
    
    const topDrugs = groups
      .slice(0, 5)
      .map(g => ({ name: g.drugName, count: g.totalCount }));
    
    return {
      totalGroups: groups.length,
      avgTrialsPerDrug: Math.round(totalTrials / groups.length),
      avgPapersPerDrug: Math.round(totalPapers / groups.length),
      topDrugs
    };
  }
}

