 
// Pipeline LLM Service
// Uses AI to extract comprehensive drug pipeline data

import type { DrugGroup } from '@/services/drugGroupingService';
import type { PipelineDrugCandidate } from '@/types/pipeline';

interface ExtractPipelineResponse {
  candidates: PipelineDrugCandidate[];
  totalProcessed: number;
  totalRequested: number;
  limit: number;
  errors?: string[];
}

export class PipelineLLMService {
  /**
   * Extract pipeline data for drug groups using LLM
   * Processes drugs ordered by combined papers + trials count
   */
  static async extractPipelineData(
    drugGroups: DrugGroup[],
    limit: number = 10
  ): Promise<PipelineDrugCandidate[]> {
    try {
      // Sort by combined papers + trials count
      const sortedDrugs = [...drugGroups].sort((a, b) => {
        const aTotal = a.papers.length + a.trials.length;
        const bTotal = b.papers.length + b.trials.length;
        return bTotal - aTotal;
      });
      const topDrugs = sortedDrugs.slice(0, limit);
      
      console.log(`Extracting pipeline data for top ${topDrugs.length} drugs (out of ${drugGroups.length} total)`);
      console.log('Top drugs by combined count:', topDrugs.map(d => 
        `${d.drugName} (${d.papers.length} papers, ${d.trials.length} trials)`
      ));

      // Call the API endpoint
      const response = await fetch('/api/generate-asset-pipeline-table', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          drugGroups: topDrugs,
          limit
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
        const matchingGroup = topDrugs.find(group => 
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
   * Get the top N drugs that will be processed (by combined papers + trials)
   */
  static getTopDrugs(drugGroups: DrugGroup[], limit: number = 10): DrugGroup[] {
    return [...drugGroups]
      .sort((a, b) => {
        const aTotal = a.papers.length + a.trials.length;
        const bTotal = b.papers.length + b.trials.length;
        return bTotal - aTotal;
      })
      .slice(0, limit);
  }

  /**
   * Check if a drug will be processed (in top N by combined count)
   */
  static willBeProcessed(drugGroup: DrugGroup, allDrugGroups: DrugGroup[], limit: number = 10): boolean {
    const topDrugs = this.getTopDrugs(allDrugGroups, limit);
    return topDrugs.some(d => d.drugName === drugGroup.drugName);
  }

  /**
   * Get statistics about what will be processed
   */
  static getProcessingStats(drugGroups: DrugGroup[], limit: number = 10): {
    total: number;
    willProcess: number;
    willSkip: number;
    topDrugs: Array<{ name: string; paperCount: number; trialCount: number; totalCount: number }>;
  } {
    const topDrugs = this.getTopDrugs(drugGroups, limit);
    
    return {
      total: drugGroups.length,
      willProcess: Math.min(limit, drugGroups.length),
      willSkip: Math.max(0, drugGroups.length - limit),
      topDrugs: topDrugs.map(d => ({
        name: d.drugName,
        paperCount: d.papers.length,
        trialCount: d.trials.length,
        totalCount: d.papers.length + d.trials.length
      }))
    };
  }
}

