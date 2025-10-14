import { supabase } from '@/lib/supabase';
import type { ClinicalTrial } from '@/types/trials';
import type { SlideData } from './slideAPI';

export interface SavedMarketMap {
  id: number;
  user_id: string;
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
  static async saveMarketMap(data: CreateMarketMapData): Promise<SavedMarketMap> {
    // Get the current user
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User must be authenticated to save market maps');
    }

    console.log('Saving to database:', {
      chat_history: data.chat_history,
      papers_data: data.papers_data,
      chat_history_length: data.chat_history?.length || 0,
      papers_data_length: data.papers_data?.length || 0
    });

    const insertData = {
      user_id: user.id,
      name: data.name,
      query: data.query,
      trials_data: data.trials_data,
      slide_data: data.slide_data,
      chat_history: data.chat_history || null,
      papers_data: data.papers_data || null,
    };

    console.log('Insert data being sent to database:', insertData);
    console.log('Chat history type:', typeof insertData.chat_history);
    console.log('Papers data type:', typeof insertData.papers_data);

    const { data: result, error } = await supabase
      .from('market_maps')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Error saving market map:', error);
      throw new Error(`Failed to save market map: ${error.message}`);
    }

    console.log('Successfully saved to database. Result:', result);

    return result;
  }

  /**
   * Get all market maps for the current user
   */
  static async getUserMarketMaps(): Promise<SavedMarketMap[]> {
    const { data, error } = await supabase
      .from('market_maps')
      .select('*')
      .order('created_at', { ascending: false });

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

    console.log('Fetched market map from database:', data);
    console.log('Chat history from database:', data.chat_history);
    console.log('Papers data from database:', data.papers_data);
    console.log('Chat history type:', typeof data.chat_history);
    console.log('Papers data type:', typeof data.papers_data);

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

    console.log('Updating market map with data:', updateData);
    console.log('Chat history type:', typeof updateData.chat_history);
    console.log('Papers data type:', typeof updateData.papers_data);

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

    console.log('Successfully updated market map. Result:', result);
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
