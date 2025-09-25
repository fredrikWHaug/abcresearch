import type { ClinicalTrial } from './clinicalTrialsAPI';

interface RankedTrial extends ClinicalTrial {
  rankScore: number;
  rankReasons: string[];
}

export class TrialRankingService {
  /**
   * Rank trials based on multiple factors
   */
  static rankTrials(trials: ClinicalTrial[], userQuery: string): RankedTrial[] {
    const queryWords = userQuery.toLowerCase().split(' ').filter(word => word.length > 2);
    
    const rankedTrials = trials.map(trial => {
      let score = 0;
      const reasons: string[] = [];
      
      // 1. Title Relevance (40%)
      const titleScore = this.calculateTitleRelevance(trial, queryWords);
      score += titleScore * 0.4;
      if (titleScore > 0.5) reasons.push('Title match');
      
      // 2. Status Score (30%)
      const statusScore = this.calculateStatusScore(trial.overallStatus);
      score += statusScore * 0.3;
      if (statusScore > 0.7) reasons.push('Actively recruiting');
      
      // 3. Phase Score (20%)
      const phaseScore = this.calculatePhaseScore(trial.phase);
      score += phaseScore * 0.2;
      if (phaseScore > 0.7) reasons.push('Advanced phase');
      
      // 4. Recency Score (10%)
      const recencyScore = this.calculateRecencyScore(trial.startDate);
      score += recencyScore * 0.1;
      if (recencyScore > 0.7) reasons.push('Recent trial');
      
      return {
        ...trial,
        rankScore: Math.round(score * 100),
        rankReasons: reasons
      } as RankedTrial;
    });
    
    // Sort by score descending
    return rankedTrials.sort((a, b) => b.rankScore - a.rankScore);
  }
  
  private static calculateTitleRelevance(trial: ClinicalTrial, queryWords: string[]): number {
    const title = (trial.briefTitle + ' ' + (trial.officialTitle || '')).toLowerCase();
    let matches = 0;
    
    queryWords.forEach(word => {
      if (title.includes(word)) matches++;
    });
    
    return queryWords.length > 0 ? matches / queryWords.length : 0;
  }
  
  private static calculateStatusScore(status: string): number {
    switch (status.toUpperCase()) {
      case 'RECRUITING':
        return 1.0;
      case 'ACTIVE_NOT_RECRUITING':
        return 0.7;
      case 'ENROLLING_BY_INVITATION':
        return 0.6;
      case 'NOT_YET_RECRUITING':
        return 0.5;
      case 'COMPLETED':
        return 0.3;
      case 'TERMINATED':
      case 'WITHDRAWN':
        return 0.1;
      default:
        return 0.4;
    }
  }
  
  private static calculatePhaseScore(phases?: string[]): number {
    if (!phases || phases.length === 0) return 0.4;
    
    const phase = phases[0];
    if (phase.includes('3') || phase.includes('III')) return 1.0;
    if (phase.includes('2') || phase.includes('II')) return 0.8;
    if (phase.includes('1') || phase.includes('I')) return 0.6;
    if (phase.includes('4') || phase.includes('IV')) return 0.9;
    return 0.4;
  }
  
  private static calculateRecencyScore(startDate?: string): number {
    if (!startDate) return 0.5;
    
    const start = new Date(startDate);
    const now = new Date();
    const monthsAgo = (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30);
    
    if (monthsAgo < 6) return 1.0;
    if (monthsAgo < 12) return 0.8;
    if (monthsAgo < 24) return 0.6;
    if (monthsAgo < 36) return 0.4;
    return 0.2;
  }
}
