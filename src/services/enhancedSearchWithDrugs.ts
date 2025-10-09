// Service for enhanced search with drug extraction and grouping using existing APIs

import { EnhanceUserQueryService } from './enhanceUserQuery';
import { SearchAndStoreService } from './searchAndStoreService';
import { ExtractDrugsService } from './extractDrugsService';
import { GroupUniqueDrugsService } from './groupUniqueDrugs';
import type { GroupedResults } from './groupUniqueDrugs';

export interface EnhancedSearchWithDrugsResponse {
  success: boolean;
  searchSessionId: string;
  groupedResults: GroupedResults;
  error?: string;
}

export class EnhancedSearchWithDrugsService {
  /**
   * Perform enhanced search with drug extraction and grouping using existing APIs
   */
  static async searchWithDrugGrouping(
    userQuery: string,
    userId?: string
  ): Promise<EnhancedSearchWithDrugsResponse> {
    console.log('🔍 EnhancedSearchWithDrugsService.searchWithDrugGrouping called with:', userQuery);
    
    try {
      console.log('🤖 Step 1: Enhancing user query...');
      // Step 1: Enhance the user query using existing enhance-search API
      const enhancedQueries = await EnhanceUserQueryService.enhanceUserQuery(userQuery);

      console.log('🔍 Step 2: Performing search and storing results...');
      // Step 2: Search and store results using existing APIs
      const searchSession = await SearchAndStoreService.searchAndStore(
        userQuery,
        enhancedQueries,
        userId
      );

      console.log('💊 Step 3: Extracting drugs from results...');
      // Step 3: Extract drugs from the results
      const drugExtractionResult = await ExtractDrugsService.extractDrugs(
        searchSession.results.trials,
        searchSession.results.papers
      );

      if (!drugExtractionResult.success) {
        console.error('❌ Drug extraction failed:', drugExtractionResult.error);
        // Continue without drug extraction - return basic grouped results
        const basicGroupedResults = await GroupUniqueDrugsService.groupUniqueDrugs(
          searchSession.results.trials,
          searchSession.results.papers,
          userQuery,
          [] // No extracted drugs
        );

        return {
          success: true,
          searchSessionId: searchSession.id,
          groupedResults: basicGroupedResults
        };
      }

      console.log('📊 Step 4: Grouping results by unique drugs...');
      // Step 4: Group results by unique drugs
      const groupedResults = await GroupUniqueDrugsService.groupUniqueDrugs(
        searchSession.results.trials,
        searchSession.results.papers,
        userQuery,
        drugExtractionResult.drugs
      );

      // Sort the grouped results by relevance
      const sortedGroupedResults = GroupUniqueDrugsService.sortGroupContents(
        groupedResults,
        userQuery
      );

      console.log('✅ Enhanced search with drug grouping completed successfully');
      console.log(`📊 Results: ${sortedGroupedResults.totalDrugs} drug groups, ${sortedGroupedResults.totalTrials} trials, ${sortedGroupedResults.totalPapers} papers`);

      return {
        success: true,
        searchSessionId: searchSession.id,
        groupedResults: sortedGroupedResults
      };

    } catch (error) {
      console.error('❌ Error in enhanced search with drug grouping:', error);
      console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      
      return {
        success: false,
        searchSessionId: '',
        groupedResults: {
          drugGroups: [],
          ungroupedTrials: [],
          ungroupedPapers: [],
          totalDrugs: 0,
          totalTrials: 0,
          totalPapers: 0
        },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get a stored search session by ID
   */
  static async getSearchSession(sessionId: string): Promise<GroupedResults | null> {
    try {
      // This would typically call the SearchAndStoreService
      // For now, we'll return null as this is a placeholder
      console.log('📋 Getting search session:', sessionId);
      return null;
    } catch (error) {
      console.error('❌ Error getting search session:', error);
      return null;
    }
  }

  /**
   * Export selected results to various formats
   */
  static async exportResults(
    selectedItems: string[],
    format: 'excel' | 'csv' | 'json' = 'excel'
  ): Promise<void> {
    try {
      console.log(`📤 Exporting ${selectedItems.length} items to ${format}`);
      
      // This would implement the export functionality
      // For now, we'll just log the action
      console.log('Selected items:', selectedItems);
      console.log('Export format:', format);
      
      // Placeholder for actual export implementation
      throw new Error('Export functionality not yet implemented');
    } catch (error) {
      console.error('❌ Error exporting results:', error);
      throw error;
    }
  }
}
