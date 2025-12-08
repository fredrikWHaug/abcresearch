import type { ClinicalTrial } from '@/types/trials';
import type { PipelineDrugCandidate, PipelineStage } from '@/types/pipeline';

export class PipelineService {
  /**
   * Convert clinical trial phase to pipeline stage
   */
  private static mapPhaseToStage(phases?: string[]): PipelineStage {
    if (!phases || phases.length === 0) return 'Discovery';
    
    // Take the highest phase
    const phaseStr = phases[0]?.toLowerCase() || '';
    
    if (phaseStr.includes('phase 3') || phaseStr.includes('phase iii')) {
      return 'Phase III';
    } else if (phaseStr.includes('phase 2') || phaseStr.includes('phase ii')) {
      return 'Phase II';
    } else if (phaseStr.includes('phase 1') || phaseStr.includes('phase i')) {
      return 'Phase I';
    } else if (phaseStr.includes('early') || phaseStr.includes('pre')) {
      return 'Pre-Clinical';
    }
    
    return 'Discovery';
  }

  /**
   * Check if drug is marketed based on trial status
   */
  private static isMarketed(trial: ClinicalTrial): boolean {
    const status = trial.overallStatus?.toLowerCase() || '';
    return status.includes('approved') || 
           status.includes('marketed') ||
           (status.includes('completed') && (trial.phase?.some(p => p.toLowerCase().includes('phase 4')) ?? false));
  }

  /**
   * Extract technology/molecule type from interventions
   */
  private static extractTechnology(interventions?: string[]): string {
    if (!interventions || interventions.length === 0) return 'Unknown';
    
    const intervention = interventions[0]?.toLowerCase() || '';
    
    // Common patterns
    if (intervention.includes('antibod') || intervention.includes('mab')) {
      return 'Biologics';
    } else if (intervention.includes('peptide')) {
      return 'Peptide';
    } else if (intervention.includes('gene') || intervention.includes('rna')) {
      return 'Gene Therapy';
    } else if (intervention.includes('cell')) {
      return 'Cell Therapy';
    } else if (intervention.includes('small molecule') || intervention.includes('oral')) {
      return 'Small Molecule';
    }
    
    return 'Small Molecule'; // default
  }

  /**
   * Extract mechanism of action from intervention description
   */
  private static extractMechanism(interventions?: string[]): string {
    if (!interventions || interventions.length === 0) return 'Unknown';
    
    const count = interventions.length;
    if (count > 1) {
      return 'Combination Therapy';
    }
    
    const intervention = interventions[0]?.toLowerCase() || '';
    
    if (intervention.includes('oral')) {
      return 'Oral';
    } else if (intervention.includes('injection') || intervention.includes('iv')) {
      return 'Injectable';
    } else if (intervention.includes('monoclonal')) {
      return 'Monotherapy';
    }
    
    return 'Monotherapy'; // default
  }

  /**
   * Extract drug name from intervention strings
   */
  private static extractDrugName(interventions?: string[]): string {
    if (!interventions || interventions.length === 0) return 'Unknown';
    
    // Take the first intervention as primary drug name
    const intervention = interventions[0] || 'Unknown';
    
    // Clean up the name - remove "Drug:" prefix if present
    return intervention.replace(/^(Drug|Biological|Device|Procedure):\s*/i, '').trim();
  }

  /**
   * Normalize drug name to identify commercial vs scientific names
   */
  private static normalizeDrugName(name: string): { 
    commercialName?: string; 
    scientificName: string 
  } {
    // Check if name has trademark symbols
    if (name.includes('™') || name.includes('®')) {
      return {
        commercialName: name,
        scientificName: name.replace(/[™®]/g, '').trim()
      };
    }
    
    // Check if name is all caps (likely commercial name)
    if (name === name.toUpperCase() && name.length > 3) {
      return {
        commercialName: name,
        scientificName: name
      };
    }
    
    // Otherwise treat as scientific name
    return {
      scientificName: name
    };
  }

  /**
   * Convert clinical trials to pipeline drug candidates
   */
  static trialsToPipeline(trials: ClinicalTrial[]): PipelineDrugCandidate[] {
    const candidateMap = new Map<string, PipelineDrugCandidate>();

    trials.forEach(trial => {
      const drugName = this.extractDrugName(trial.interventions);
      const { commercialName, scientificName } = this.normalizeDrugName(drugName);
      
      // Use scientific name as unique key
      const key = scientificName.toLowerCase();
      
      // If we already have this drug, update with latest info
      if (candidateMap.has(key)) {
        const existing = candidateMap.get(key)!;
        
        // Update to marketed if any trial shows it's marketed
        if (this.isMarketed(trial)) {
          existing.stage = 'Marketed';
        } else if (existing.stage !== 'Marketed') {
          // Otherwise update to highest phase
          const newStage = this.mapPhaseToStage(trial.phase);
          const stageOrder = ['Discovery', 'Pre-Clinical', 'Phase I', 'Phase II', 'Phase III', 'Marketed'];
          const currentIndex = stageOrder.indexOf(existing.stage);
          const newIndex = stageOrder.indexOf(newStage);
          if (newIndex > currentIndex) {
            existing.stage = newStage;
          }
        }
        
        // Update date if newer
        if (trial.startDate && (!existing.lastTrialStartDate || trial.startDate > existing.lastTrialStartDate)) {
          existing.lastTrialStartDate = trial.startDate;
        }
        
        // Merge indications
        if (trial.conditions) {
          const newIndications = trial.conditions.filter(c => !existing.indications?.includes(c));
          existing.indications = [...(existing.indications || []), ...newIndications];
        }
      } else {
        // Create new candidate
        const stage = this.isMarketed(trial) ? 'Marketed' : this.mapPhaseToStage(trial.phase);
        
        const candidate: PipelineDrugCandidate = {
          id: key,
          commercialName,
          scientificName,
          sponsorCompany: trial.sponsors?.lead || 'Unknown',
          stage,
          technologies: this.extractTechnology(trial.interventions),
          mechanismOfAction: this.extractMechanism(trial.interventions),
          indications: trial.conditions || [],
          lastTrialStartDate: trial.startDate,
          sourceGroupId: key, // Use the normalized key for matching
        };
        
        candidateMap.set(key, candidate);
      }
    });

    // Convert map to array and sort by stage (marketed first, then by phase)
    const stageOrder = ['Marketed', 'Phase III', 'Phase II', 'Phase I', 'Pre-Clinical', 'Discovery'];
    return Array.from(candidateMap.values()).sort((a, b) => {
      const aIndex = stageOrder.indexOf(a.stage);
      const bIndex = stageOrder.indexOf(b.stage);
      if (aIndex !== bIndex) return aIndex - bIndex;
      
      // Within same stage, sort by date (newest first)
      if (a.lastTrialStartDate && b.lastTrialStartDate) {
        return b.lastTrialStartDate.localeCompare(a.lastTrialStartDate);
      }
      
      return 0;
    });
  }

  /**
   * Filter pipeline candidates
   */
  static filterCandidates(
    candidates: PipelineDrugCandidate[],
    filters: {
      stage?: PipelineStage[];
      company?: string[];
      indication?: string[];
      searchQuery?: string;
    }
  ): PipelineDrugCandidate[] {
    let filtered = candidates;

    // Filter by stage
    if (filters.stage && filters.stage.length > 0) {
      filtered = filtered.filter(c => filters.stage!.includes(c.stage));
    }

    // Filter by company
    if (filters.company && filters.company.length > 0) {
      filtered = filtered.filter(c => 
        filters.company!.some(comp => 
          c.sponsorCompany.toLowerCase().includes(comp.toLowerCase())
        )
      );
    }

    // Filter by indication
    if (filters.indication && filters.indication.length > 0) {
      filtered = filtered.filter(c => 
        c.indications?.some(ind => 
          filters.indication!.some(filterInd => 
            ind.toLowerCase().includes(filterInd.toLowerCase())
          )
        )
      );
    }

    // Filter by search query
    if (filters.searchQuery && filters.searchQuery.trim()) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(c =>
        c.scientificName.toLowerCase().includes(query) ||
        c.commercialName?.toLowerCase().includes(query) ||
        c.sponsorCompany.toLowerCase().includes(query) ||
        c.indications?.some(ind => ind.toLowerCase().includes(query))
      );
    }

    return filtered;
  }

  /**
   * Get unique companies from candidates
   */
  static getUniqueCompanies(candidates: PipelineDrugCandidate[]): string[] {
    const companies = new Set(candidates.map(c => c.sponsorCompany));
    return Array.from(companies).sort();
  }

  /**
   * Get unique indications from candidates
   */
  static getUniqueIndications(candidates: PipelineDrugCandidate[]): string[] {
    const indications = new Set<string>();
    candidates.forEach(c => {
      c.indications?.forEach(ind => indications.add(ind));
    });
    return Array.from(indications).sort();
  }

  /**
   * Get statistics for pipeline
   */
  static getStats(candidates: PipelineDrugCandidate[]) {
    const stats = {
      total: candidates.length,
      byStage: {
        Marketed: 0,
        'Phase III': 0,
        'Phase II': 0,
        'Phase I': 0,
        'Pre-Clinical': 0,
        Discovery: 0,
      },
      byCompany: {} as Record<string, number>,
      byIndication: {} as Record<string, number>,
    };

    candidates.forEach(c => {
      // Count by stage
      stats.byStage[c.stage] = (stats.byStage[c.stage] || 0) + 1;

      // Count by company
      stats.byCompany[c.sponsorCompany] = (stats.byCompany[c.sponsorCompany] || 0) + 1;

      // Count by indication
      c.indications?.forEach(ind => {
        stats.byIndication[ind] = (stats.byIndication[ind] || 0) + 1;
      });
    });

    return stats;
  }
}

