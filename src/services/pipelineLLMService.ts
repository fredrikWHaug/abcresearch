// Pipeline LLM Service
// Uses AI to extract comprehensive drug pipeline data

import type { DrugGroup } from '@/services/drugGroupingService';
import type { PipelineDrugCandidate } from '@/types/pipeline';

interface ExtractPipelineResponse {
  candidates: PipelineDrugCandidate[];
  totalProcessed: number;
  totalRequested: number;
  top10Count: number;
  errors?: string[];
}

export class PipelineLLMService {
  /**
   * Extract pipeline data for drug groups using LLM
   * Only processes top 10 drugs by paper count to control costs
   */
  static async extractPipelineData(
    drugGroups: DrugGroup[]
  ): Promise<PipelineDrugCandidate[]> {
    try {
      // Sort by paper count to show which will be processed
      const sortedDrugs = [...drugGroups].sort((a, b) => b.papers.length - a.papers.length);
      const top10 = sortedDrugs.slice(0, 10);
      
      console.log(`Extracting pipeline data for top ${top10.length} drugs (out of ${drugGroups.length} total)`);
      console.log('Top drugs by paper count:', top10.map(d => `${d.drugName} (${d.papers.length} papers)`));

      // Call the API endpoint
      const response = await fetch('/api/generate-asset-pipeline-table', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          drugGroups: top10
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `API request failed: ${response.status}`);
      }

      const data: ExtractPipelineResponse = await response.json();
      
      console.log(`Successfully extracted ${data.totalProcessed} drug candidates`);
      if (data.errors && data.errors.length > 0) {
        console.warn('Some drugs failed to process:', data.errors);
      }

      // Add sourceGroupId to match candidates back to their drug groups
      const candidatesWithRefs = data.candidates.map(candidate => {
        // Find the matching drug group by normalized name
        const matchingGroup = top10.find(group => 
          group.normalizedName === candidate.id ||
          group.drugName.toLowerCase() === candidate.scientificName.toLowerCase()
        );
        
        return {
          ...candidate,
          sourceGroupId: matchingGroup?.normalizedName || candidate.id
        };
      });

      return candidatesWithRefs;
    } catch (error) {
      console.error('Error extracting pipeline data:', error);
      throw error;
    }
  }

  /**
   * Get the top 10 drugs that will be processed
   */
  static getTop10Drugs(drugGroups: DrugGroup[]): DrugGroup[] {
    return [...drugGroups]
      .sort((a, b) => b.papers.length - a.papers.length)
      .slice(0, 10);
  }

  /**
   * Check if a drug will be processed (in top 10 by paper count)
   */
  static willBeProcessed(drugGroup: DrugGroup, allDrugGroups: DrugGroup[]): boolean {
    const top10 = this.getTop10Drugs(allDrugGroups);
    return top10.some(d => d.drugName === drugGroup.drugName);
  }

  /**
   * Get statistics about what will be processed
   */
  static getProcessingStats(drugGroups: DrugGroup[]): {
    total: number;
    willProcess: number;
    willSkip: number;
    top10: Array<{ name: string; paperCount: number; trialCount: number }>;
  } {
    const top10 = this.getTop10Drugs(drugGroups);
    
    return {
      total: drugGroups.length,
      willProcess: Math.min(10, drugGroups.length),
      willSkip: Math.max(0, drugGroups.length - 10),
      top10: top10.map(d => ({
        name: d.drugName,
        paperCount: d.papers.length,
        trialCount: d.trials.length
      }))
    };
  }
}

