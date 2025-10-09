// Service for calling ClinicalTrials.gov and PubMed APIs and storing results in Supabase

import { EnhancedSearchAPI } from './enhancedSearchAPI';
import { pubmedAPI } from './pubmedAPI';
import { supabase } from '@/lib/supabase';
import type { EnhancedQueries } from './enhanceUserQuery';
import type { ClinicalTrial } from './clinicalTrialsAPI';
import type { PubMedArticle } from './pubmedAPI';

export interface SearchResults {
  trials: ClinicalTrial[];
  papers: PubMedArticle[];
  totalTrials: number;
  totalPapers: number;
  searchStrategies: {
    primary: { trials: ClinicalTrial[]; papers: PubMedArticle[] };
    alternative: { trials: ClinicalTrial[]; papers: PubMedArticle[] };
    broad: { trials: ClinicalTrial[]; papers: PubMedArticle[] };
  };
}

export interface StoredSearchSession {
  id: string;
  userQuery: string;
  enhancedQueries: EnhancedQueries;
  results: SearchResults;
  createdAt: string;
  userId?: string;
}

export class SearchAndStoreService {
  /**
   * Perform enhanced search and store results in Supabase
   */
  static async searchAndStore(
    userQuery: string,
    enhancedQueries: EnhancedQueries,
    userId?: string
  ): Promise<StoredSearchSession> {
    console.log('🔍 SearchAndStoreService.searchAndStore called with:', userQuery);
    
    try {
      // Use the existing EnhancedSearchAPI to get trials
      console.log('🚀 Using existing EnhancedSearchAPI for trials...');
      const trialsResult = await EnhancedSearchAPI.searchWithEnhancement(userQuery);
      
      // Use the existing pubmedAPI to get papers
      console.log('📚 Using existing pubmedAPI for papers...');
      const papers = await pubmedAPI.searchPapers({
        query: `${userQuery} AND ("Clinical Trial"[Publication Type] OR "Randomized Controlled Trial"[Publication Type])`,
        maxResults: 50
      });

      // Create combined results
      const combinedResults: SearchResults = {
        trials: trialsResult.trials,
        papers: papers,
        totalTrials: trialsResult.trials.length,
        totalPapers: papers.length,
        searchStrategies: {
          primary: { trials: trialsResult.trials, papers: papers },
          alternative: { trials: [], papers: [] },
          broad: { trials: [], papers: [] }
        }
      };

      // Create search session object
      const searchSession: Omit<StoredSearchSession, 'id'> = {
        userQuery,
        enhancedQueries,
        results: combinedResults,
        createdAt: new Date().toISOString(),
        userId
      };

      // Store in Supabase (optional - continue even if storage fails)
      try {
        const { data, error } = await supabase
          .from('search_sessions')
          .insert([searchSession])
          .select()
          .single();

        if (error) {
          console.error('❌ Error storing search session:', error);
          // Continue without storing - return session with generated ID
          return { ...searchSession, id: `temp-${Date.now()}` };
        }

        console.log('✅ Successfully stored search session:', data.id);
        return { ...searchSession, id: data.id };
      } catch (storageError) {
        console.error('❌ Supabase storage failed, continuing without storage:', storageError);
        return { ...searchSession, id: `temp-${Date.now()}` };
      }
    } catch (error) {
      console.error('❌ Error in search and store:', error);
      throw error;
    }
  }


  /**
   * Retrieve a stored search session by ID
   */
  static async getSearchSession(sessionId: string): Promise<StoredSearchSession | null> {
    try {
      const { data, error } = await supabase
        .from('search_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error) {
        console.error('❌ Error retrieving search session:', error);
        return null;
      }

      return data as StoredSearchSession;
    } catch (error) {
      console.error('❌ Error retrieving search session:', error);
      return null;
    }
  }

  /**
   * Get recent search sessions for a user
   */
  static async getRecentSearchSessions(
    userId?: string,
    limit: number = 10
  ): Promise<StoredSearchSession[]> {
    try {
      let query = supabase
        .from('search_sessions')
        .select('*')
        .order('createdAt', { ascending: false })
        .limit(limit);

      if (userId) {
        query = query.eq('userId', userId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ Error retrieving recent search sessions:', error);
        return [];
      }

      return data as StoredSearchSession[];
    } catch (error) {
      console.error('❌ Error retrieving recent search sessions:', error);
      return [];
    }
  }

  /**
   * Delete a search session
   */
  static async deleteSearchSession(sessionId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('search_sessions')
        .delete()
        .eq('id', sessionId);

      if (error) {
        console.error('❌ Error deleting search session:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('❌ Error deleting search session:', error);
      return false;
    }
  }

  /**
   * Update search session with additional data (e.g., extracted drugs)
   */
  static async updateSearchSession(
    sessionId: string,
    updates: Partial<StoredSearchSession>
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('search_sessions')
        .update(updates)
        .eq('id', sessionId);

      if (error) {
        console.error('❌ Error updating search session:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('❌ Error updating search session:', error);
      return false;
    }
  }
}
