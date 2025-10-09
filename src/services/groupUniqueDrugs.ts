// Service for grouping clinical trials and papers by unique drug names

import type { ClinicalTrial } from './clinicalTrialsAPI';
import type { PubMedArticle } from './pubmedAPI';
import type { ExtractedDrug } from './extractDrugsService';
import { ExtractDrugsService } from './extractDrugsService';

export interface DrugGroup {
  drugName: string;
  normalizedName: string;
  trials: ClinicalTrial[];
  papers: PubMedArticle[];
  totalCount: number;
  matchScore: number; // Relevance score for the user's query
  drugInfo: {
    confidence: number;
    sources: ('clinical_trial' | 'paper')[];
    sourceIds: string[];
  };
}

export interface GroupedResults {
  drugGroups: DrugGroup[];
  ungroupedTrials: ClinicalTrial[];
  ungroupedPapers: PubMedArticle[];
  totalDrugs: number;
  totalTrials: number;
  totalPapers: number;
}

export class GroupUniqueDrugsService {
  /**
   * Group clinical trials and papers by unique drug names
   */
  static async groupUniqueDrugs(
    trials: ClinicalTrial[],
    papers: PubMedArticle[],
    userQuery: string,
    extractedDrugs?: ExtractedDrug[]
  ): Promise<GroupedResults> {
    console.log('💊 GroupUniqueDrugsService.groupUniqueDrugs called');
    console.log(`📊 Grouping ${trials.length} trials and ${papers.length} papers`);
    
    try {
      // Extract drugs if not provided
      let drugs: ExtractedDrug[] = extractedDrugs || [];
      if (drugs.length === 0) {
        const extractionResult = await ExtractDrugsService.extractDrugs(trials, papers);
        if (extractionResult.success) {
          drugs = extractionResult.drugs;
        }
      }
      
      // Group drugs by normalized names
      const drugGroups = ExtractDrugsService.groupDrugsByName(drugs);
      
      // Create drug groups with associated trials and papers
      const groupedResults: DrugGroup[] = [];
      const processedTrialIds = new Set<string>();
      const processedPaperIds = new Set<string>();
      
      for (const [normalizedName, drugList] of drugGroups.entries()) {
        const mostCommonName = ExtractDrugsService.getMostCommonDrugName(drugList);
        
        // Find trials and papers associated with this drug
        const associatedTrials = this.findTrialsForDrug(trials, drugList, processedTrialIds);
        const associatedPapers = this.findPapersForDrug(papers, drugList, processedPaperIds);
        
        // Calculate match score based on user query
        const matchScore = this.calculateMatchScore(
          mostCommonName,
          associatedTrials,
          associatedPapers,
          userQuery
        );
        
        // Calculate confidence and gather source info
        const confidence = Math.max(...drugList.map(d => d.confidence));
        const sources = [...new Set(drugList.map(d => d.source))];
        const sourceIds = [...new Set(drugList.map(d => d.sourceId))];
        
        const drugGroup: DrugGroup = {
          drugName: mostCommonName,
          normalizedName,
          trials: associatedTrials,
          papers: associatedPapers,
          totalCount: associatedTrials.length + associatedPapers.length,
          matchScore,
          drugInfo: {
            confidence,
            sources,
            sourceIds
          }
        };
        
        groupedResults.push(drugGroup);
      }
      
      // Sort drug groups by match score (highest first)
      groupedResults.sort((a, b) => b.matchScore - a.matchScore);
      
      // Find ungrouped trials and papers
      const ungroupedTrials = trials.filter(trial => !processedTrialIds.has(trial.nctId));
      const ungroupedPapers = papers.filter(paper => !processedPaperIds.has(paper.pmid));
      
      console.log(`✅ Successfully grouped results into ${groupedResults.length} drug groups`);
      console.log(`📊 Ungrouped: ${ungroupedTrials.length} trials, ${ungroupedPapers.length} papers`);
      
      return {
        drugGroups: groupedResults,
        ungroupedTrials,
        ungroupedPapers,
        totalDrugs: groupedResults.length,
        totalTrials: trials.length,
        totalPapers: papers.length
      };
    } catch (error) {
      console.error('❌ Error grouping unique drugs:', error);
      throw error;
    }
  }

  /**
   * Find trials associated with a specific drug
   */
  private static findTrialsForDrug(
    trials: ClinicalTrial[],
    drugList: ExtractedDrug[],
    processedIds: Set<string>
  ): ClinicalTrial[] {
    const associatedTrials: ClinicalTrial[] = [];
    const drugSourceIds = new Set(drugList.map(d => d.sourceId));
    
    for (const trial of trials) {
      // Check if this trial was a source for the drug
      if (drugSourceIds.has(trial.nctId)) {
        associatedTrials.push(trial);
        processedIds.add(trial.nctId);
        continue;
      }
      
      // Check if the drug name appears in the trial's interventions
      const drugNames = drugList.map(d => d.name.toLowerCase());
      const trialInterventions = (trial.interventions || []).join(' ').toLowerCase();
      
      const hasMatchingDrug = drugNames.some(drugName => 
        trialInterventions.includes(drugName.toLowerCase())
      );
      
      if (hasMatchingDrug) {
        associatedTrials.push(trial);
        processedIds.add(trial.nctId);
      }
    }
    
    return associatedTrials;
  }

  /**
   * Find papers associated with a specific drug
   */
  private static findPapersForDrug(
    papers: PubMedArticle[],
    drugList: ExtractedDrug[],
    processedIds: Set<string>
  ): PubMedArticle[] {
    const associatedPapers: PubMedArticle[] = [];
    const drugSourceIds = new Set(drugList.map(d => d.sourceId));
    
    for (const paper of papers) {
      // Check if this paper was a source for the drug
      if (drugSourceIds.has(paper.pmid)) {
        associatedPapers.push(paper);
        processedIds.add(paper.pmid);
        continue;
      }
      
      // Check if the drug name appears in the paper's title or abstract
      const drugNames = drugList.map(d => d.name.toLowerCase());
      const paperText = `${paper.title} ${paper.abstract}`.toLowerCase();
      
      const hasMatchingDrug = drugNames.some(drugName => 
        paperText.includes(drugName.toLowerCase())
      );
      
      if (hasMatchingDrug) {
        associatedPapers.push(paper);
        processedIds.add(paper.pmid);
      }
    }
    
    return associatedPapers;
  }

  /**
   * Calculate match score for a drug group based on user query
   */
  private static calculateMatchScore(
    drugName: string,
    trials: ClinicalTrial[],
    papers: PubMedArticle[],
    userQuery: string
  ): number {
    let score = 0;
    const queryTerms = userQuery.toLowerCase().split(/\s+/);
    const drugNameLower = drugName.toLowerCase();
    
    // Base score from number of results
    score += Math.min(trials.length * 10, 50); // Max 50 points for trials
    score += Math.min(papers.length * 5, 25); // Max 25 points for papers
    
    // Bonus for exact drug name match in query
    if (queryTerms.some(term => drugNameLower.includes(term) || term.includes(drugNameLower))) {
      score += 30;
    }
    
    // Bonus for drug name appearing in trial titles
    const trialTitleMatches = trials.filter(trial => 
      trial.briefTitle.toLowerCase().includes(drugNameLower)
    ).length;
    score += trialTitleMatches * 5;
    
    // Bonus for drug name appearing in paper titles
    const paperTitleMatches = papers.filter(paper => 
      paper.title.toLowerCase().includes(drugNameLower)
    ).length;
    score += paperTitleMatches * 3;
    
    // Bonus for high-quality sources (premium journals, phase 3 trials)
    const premiumJournals = ['New England Journal', 'JAMA', 'Lancet', 'Nature Medicine'];
    const premiumPaperBonus = papers.filter(paper => 
      premiumJournals.some(journal => paper.journal.includes(journal))
    ).length * 5;
    score += premiumPaperBonus;
    
    const phase3TrialBonus = trials.filter(trial => 
      trial.phase?.includes('PHASE3') || trial.phase?.includes('PHASE III')
    ).length * 10;
    score += phase3TrialBonus;
    
    return Math.min(score, 100); // Cap at 100
  }

  /**
   * Get displayable dictionary of drug name -> all relevant trials and papers
   */
  static getDisplayableDictionary(groupedResults: GroupedResults): Record<string, {
    trials: ClinicalTrial[];
    papers: PubMedArticle[];
    matchScore: number;
    totalCount: number;
  }> {
    const dictionary: Record<string, {
      trials: ClinicalTrial[];
      papers: PubMedArticle[];
      matchScore: number;
      totalCount: number;
    }> = {};
    
    for (const drugGroup of groupedResults.drugGroups) {
      dictionary[drugGroup.drugName] = {
        trials: drugGroup.trials,
        papers: drugGroup.papers,
        matchScore: drugGroup.matchScore,
        totalCount: drugGroup.totalCount
      };
    }
    
    return dictionary;
  }

  /**
   * Sort trials and papers within each drug group by relevance
   */
  static sortGroupContents(
    groupedResults: GroupedResults,
    userQuery: string
  ): GroupedResults {
    const queryTerms = userQuery.toLowerCase().split(/\s+/);
    
    // Sort trials within each group
    for (const drugGroup of groupedResults.drugGroups) {
      drugGroup.trials.sort((a, b) => {
        const scoreA = this.calculateTrialRelevance(a, queryTerms);
        const scoreB = this.calculateTrialRelevance(b, queryTerms);
        return scoreB - scoreA;
      });
      
      drugGroup.papers.sort((a, b) => {
        const scoreA = this.calculatePaperRelevance(a, queryTerms);
        const scoreB = this.calculatePaperRelevance(b, queryTerms);
        return scoreB - scoreA;
      });
    }
    
    // Sort ungrouped items
    groupedResults.ungroupedTrials.sort((a, b) => {
      const scoreA = this.calculateTrialRelevance(a, queryTerms);
      const scoreB = this.calculateTrialRelevance(b, queryTerms);
      return scoreB - scoreA;
    });
    
    groupedResults.ungroupedPapers.sort((a, b) => {
      const scoreA = this.calculatePaperRelevance(a, queryTerms);
      const scoreB = this.calculatePaperRelevance(b, queryTerms);
      return scoreB - scoreA;
    });
    
    return groupedResults;
  }

  /**
   * Calculate relevance score for a trial
   */
  private static calculateTrialRelevance(trial: ClinicalTrial, queryTerms: string[]): number {
    let score = 0;
    const trialText = `${trial.briefTitle} ${trial.officialTitle || ''} ${(trial.conditions || []).join(' ')} ${(trial.interventions || []).join(' ')}`.toLowerCase();
    
    // Count query term matches
    for (const term of queryTerms) {
      if (trialText.includes(term)) {
        score += 10;
      }
    }
    
    // Bonus for title matches
    if (trial.briefTitle.toLowerCase().includes(queryTerms.join(' '))) {
      score += 20;
    }
    
    // Bonus for recruiting status
    if (trial.overallStatus === 'RECRUITING') {
      score += 15;
    }
    
    // Bonus for phase 3 trials
    if (trial.phase?.includes('PHASE3') || trial.phase?.includes('PHASE III')) {
      score += 10;
    }
    
    return score;
  }

  /**
   * Calculate relevance score for a paper
   */
  private static calculatePaperRelevance(paper: PubMedArticle, queryTerms: string[]): number {
    let score = paper.relevanceScore || 0;
    const paperText = `${paper.title} ${paper.abstract}`.toLowerCase();
    
    // Count query term matches
    for (const term of queryTerms) {
      if (paperText.includes(term)) {
        score += 5;
      }
    }
    
    // Bonus for title matches
    if (paper.title.toLowerCase().includes(queryTerms.join(' '))) {
      score += 15;
    }
    
    // Bonus for recent publications
    const publicationYear = new Date(paper.publicationDate).getFullYear();
    const currentYear = new Date().getFullYear();
    if (currentYear - publicationYear <= 2) {
      score += 10;
    }
    
    return score;
  }
}
