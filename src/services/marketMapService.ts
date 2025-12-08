/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from '@/lib/supabase';
import type { ClinicalTrial } from '@/types/trials';
import type { SlideData } from './slideAPI';

export interface SavedMarketMap {
  id: number;
  user_id: string;
  project_id: number | null;
  name: string;
  query: string;
  trials_data: ClinicalTrial[];
  slide_data: SlideData;
  chat_history: Array<{type: 'user' | 'system', message: string, searchSuggestions?: Array<{id: string, label: string, query: string, description?: string}>}> | null;
  papers_data: any[] | null; // PubMed articles
  created_at: string;
  updated_at: string;
}

export interface CreateMarketMapData {
  name: string;
  query: string;
  trials_data: ClinicalTrial[];
  slide_data: SlideData;
  chat_history?: Array<{type: 'user' | 'system', message: string, searchSuggestions?: Array<{id: string, label: string, query: string, description?: string}>}>;
  papers_data?: any[]; // PubMed articles
}

export class MarketMapService {
  /**
   * Save a market map to the database
   */
  static async saveMarketMap(data: CreateMarketMapData, projectId: number | null): Promise<SavedMarketMap> {
    // Get the current user
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User must be authenticated to save market maps');
    }

    const insertData = {
      user_id: user.id,
      project_id: projectId,
      name: data.name,
      query: data.query,
      trials_data: data.trials_data,
      slide_data: data.slide_data,
      chat_history: data.chat_history || null,
      papers_data: data.papers_data || null,
    };

    const { data: result, error } = await supabase
      .from('market_maps')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Error saving market map:', error);
      throw new Error(`Failed to save market map: ${error.message}`);
    }

    if (projectId) {
      this.backgroundDualWrite(projectId, data).catch((error) => {
        console.error('[MarketMapService] Background dual-write failed:', error);
      });
    }

    return result;
  }

  /**
   * Background task to write data to normalized tables
   * This runs asynchronously and doesn't block the main save operation
   */
  private static async backgroundDualWrite(projectId: number, data: CreateMarketMapData): Promise<void> {
    try {
      const { upsertTrial, linkTrialToProject } = await import('./trialService');
      const { upsertPaper, linkPaperToProject } = await import('./paperService');

      if (data.trials_data && data.trials_data.length > 0) {
        const batchSize = 10;
        for (let i = 0; i < data.trials_data.length; i += batchSize) {
          const batch = data.trials_data.slice(i, i + batchSize);
          await Promise.all(
            batch.map(async (trial) => {
              try {
                const trialId = await upsertTrial(trial);
                await linkTrialToProject(projectId, trialId);
              } catch (error) {
                console.error(`[MarketMapService] Failed to process trial ${trial.nctId}:`, error);
              }
            })
          );
        }
      }

      if (data.papers_data && data.papers_data.length > 0) {
        const batchSize = 10;
        for (let i = 0; i < data.papers_data.length; i += batchSize) {
          const batch = data.papers_data.slice(i, i + batchSize);
          await Promise.all(
            batch.map(async (paper) => {
              try {
                const paperId = await upsertPaper(paper);
                await linkPaperToProject(projectId, paperId);
              } catch (error) {
                console.error(`[MarketMapService] Failed to process paper ${paper.pmid}:`, error);
              }
            })
          );
        }
      }
    } catch (error) {
      console.error('[MarketMapService] Background dual-write failed:', error);
      throw error;
    }
  }

  /**
   * Get all market maps for the current user, optionally filtered by project
   */
  static async getUserMarketMaps(projectId?: number | null): Promise<SavedMarketMap[]> {
    let query = supabase
      .from('market_maps')
      .select('*')
      .order('created_at', { ascending: false });

    // Filter by project if projectId is provided
    if (projectId !== undefined && projectId !== null) {
      query = query.eq('project_id', projectId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching market maps:', error);
      throw new Error(`Failed to fetch market maps: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get a specific market map by ID
   */
  static async getMarketMap(id: number): Promise<SavedMarketMap> {
    const { data, error } = await supabase
      .from('market_maps')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching market map:', error);
      throw new Error(`Failed to fetch market map: ${error.message}`);
    }

    return data;
  }

  /**
   * Update a market map
   */
  static async updateMarketMap(id: number, data: Partial<CreateMarketMapData>): Promise<SavedMarketMap> {
    const updateData = {
      ...data,
      updated_at: new Date().toISOString(),
    };

    const { data: result, error } = await supabase
      .from('market_maps')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating market map:', error);
      throw new Error(`Failed to update market map: ${error.message}`);
    }

    return result;
  }

  /**
   * Delete a market map
   */
  static async deleteMarketMap(id: number): Promise<void> {
    const { error } = await supabase
      .from('market_maps')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting market map:', error);
      throw new Error(`Failed to delete market map: ${error.message}`);
    }
  }
}
