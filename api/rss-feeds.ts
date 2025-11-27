/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Consolidated RSS Feed API
 * TODO: Fetching RSS feed and parsing isn't working after I tried to handle multiple feeds.
 * Handles all RSS feed operations:
 * - GET /api/rss-feeds?action=watch - Get watched feeds
 * - POST /api/rss-feeds?action=watch - Add watched feed
 * - PUT /api/rss-feeds?action=watch - Update watched feed
 * - DELETE /api/rss-feeds?action=watch - Remove watched feed
 * - GET /api/rss-feeds?action=updates&feedId=xxx&days=30 - Get trial updates
 * - POST /api/rss-feeds?action=refresh - Manually refresh a feed
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { processFeedUpdates } from './utils/rss-feed-utils.js';

// Simple helper function - doesn't need heavy dependencies
function buildRssUrl(
  searchTerm?: string,
  locStr?: string,
  country?: string,
  dateField?: string
): string {
  const base = 'https://clinicaltrials.gov/api/rss';
  const params = new URLSearchParams();
  
  if (searchTerm) params.append('intr', searchTerm);
  if (locStr) params.append('locStr', locStr);
  if (country) params.append('country', country);
  params.append('dateField', dateField || 'LastUpdatePostDate');
  
  return `${base}?${params.toString()}`;
}


const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;
const geminiApiKey = process.env.GOOGLE_GEMINI_API_KEY!;

// Helper to get authenticated user
async function getAuthenticatedUser(req: VercelRequest) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return { user: null, error: 'Missing authorization header' };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { user: null, error: 'Unauthorized' };
  }

  return { user, supabase, error: null };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const action = (req.query.action as string) || 'watch';

  try {
    const { user, supabase, error: authError } = await getAuthenticatedUser(req);

    if (authError || !user || !supabase) {
      return res.status(401).json({ error: authError || 'Unauthorized' });
    }

    if (action === 'watch') {
      // Manage watched feeds
      if (req.method === 'GET') {
        // Fetch user's watched feeds (including refresh_status if column exists)
        const { data, error } = await supabase
          .from('watched_feeds')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) {
          return res.status(500).json({ error: error.message });
        }

        // Ensure all feeds are returned, even if refresh_status column doesn't exist
        const feeds = (data || []).map((feed: any) => ({
          ...feed,
          refresh_status: feed.refresh_status || null,
        }));

        return res.json({ feeds });
      } else if (req.method === 'POST') {
        // Add new watched feed
        const body = req.body;
        const { searchTerm, label, locStr, country, dateField } = body;

        if (!searchTerm) {
          return res.status(400).json({ error: 'Search term is required' });
        }

        const feedUrl = buildRssUrl(
          searchTerm,
          locStr,
          country,
          dateField || 'LastUpdatePostDate'
        );

        const { data, error } = await supabase
          .from('watched_feeds')
          .insert({
            user_id: user.id,
            feed_url: feedUrl,
            label: label || `${searchTerm} trials`,
          })
          .select()
          .single();

        if (error) {
          return res.status(500).json({ error: error.message });
        }

        // Automatically refresh the feed after creation
        // NOTE: In serverless, we MUST await or the execution context will freeze and kill timers
        if (data && geminiApiKey) {
          console.log(`[API] Starting initial refresh for newly created feed ${data.id}`);
          
          // MUST AWAIT - serverless will freeze execution context if we don't
          try {
            await processFeedUpdates(data.id, data.feed_url, geminiApiKey, supabase, true);
            console.log(`[API] Initial refresh completed for feed ${data.id}`);
          } catch (refreshError: any) {
            // Feed was created successfully, but refresh failed - that's OK
            console.error('[API] Initial refresh failed (feed still created):', refreshError.message);
          }
        } else {
          console.log(`[API] Skipping auto-refresh: data=${!!data}, geminiApiKey=${!!geminiApiKey}`);
        }

        return res.json({ feed: data });
      } else if (req.method === 'PUT') {
        // Update watched feed
        const { feedId, feedUrl, label } = req.body;

        if (!feedId || !feedUrl) {
          return res.status(400).json({ error: 'Feed ID and URL required' });
        }

        const { data, error } = await supabase
          .from('watched_feeds')
          .update({
            feed_url: feedUrl,
            label: label || 'Clinical Trials Feed',
          })
          .eq('id', feedId)
          .eq('user_id', user.id)
          .select()
          .single();

        if (error) {
          return res.status(500).json({ error: error.message });
        }

        return res.json({ feed: data });
      } else if (req.method === 'DELETE') {
        // Remove watched feed
        const { feedId } = req.body;

        if (!feedId) {
          return res.status(400).json({ error: 'Feed ID required' });
        }

        const { error } = await supabase
          .from('watched_feeds')
          .delete()
          .eq('id', feedId)
          .eq('user_id', user.id);

        if (error) {
          return res.status(500).json({ error: error.message });
        }

        return res.json({ message: 'Feed removed successfully' });
      } else {
        return res.status(405).json({ error: 'Method not allowed' });
      }
    } else if (action === 'updates') {
      // Get trial updates
      if (req.method === 'GET') {
        const { feedId, days = '30' } = req.query;

        const daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - parseInt(days as string, 10));

        const { data: feeds, error: feedsError } = await supabase
          .from('watched_feeds')
          .select('id')
          .eq('user_id', user.id);

        if (feedsError) {
          return res.status(500).json({ error: feedsError.message });
        }

        if (!feeds || feeds.length === 0) {
          return res.json({ updates: [], timeline: [] });
        }

        const feedIds = feeds.map((f) => f.id);

        let query = supabase
          .from('trial_updates')
          .select(
            `
            *,
            watched_feeds!inner(id, label, feed_url)
          `
          )
          .in('feed_id', feedIds)
          .gte('last_update', daysAgo.toISOString())
          .order('last_update', { ascending: false });

        if (feedId) {
          query = query.eq('feed_id', feedId);
        }

        const { data: updates, error: updatesError } = await query;

        if (updatesError) {
          return res.status(500).json({ error: updatesError.message });
        }

        const timeline: Record<string, any[]> = {};
        (updates || []).forEach((update) => {
          const date = new Date(update.last_update).toISOString().split('T')[0];
          if (!timeline[date]) {
            timeline[date] = [];
          }
          timeline[date].push(update);
        });

        const timelineArray = Object.keys(timeline)
          .sort((a, b) => b.localeCompare(a))
          .map((date) => ({
            date,
            updates: timeline[date],
          }));

        return res.json({
          updates: updates || [],
          timeline: timelineArray,
        });
      } else {
        return res.status(405).json({ error: 'Method not allowed' });
      }
    } else if (action === 'progress') {
      // Get refresh progress for a feed
      if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
      }

      const feedId = req.query.feedId as string;

      if (!feedId) {
        return res.status(400).json({ error: 'Feed ID required' });
      }

      const feedIdNum = parseInt(feedId, 10);
      if (isNaN(feedIdNum)) {
        return res.status(400).json({ error: 'Invalid feed ID' });
      }

      // Try to select refresh_status, but fallback to selecting all columns if column doesn't exist
      const { data: feed, error: feedError } = await supabase
        .from('watched_feeds')
        .select('*') // Select all columns to handle missing refresh_status gracefully
        .eq('id', feedIdNum)
        .eq('user_id', user.id)
        .single();

      if (feedError) {
        console.error('Progress query error:', feedError);
        // Check if it's a column error vs feed not found
        if (feedError.code === '42703' || feedError.message?.includes('does not exist')) {
          // Column doesn't exist - return null progress but don't error
          return res.json({
            progress: null,
            error: 'refresh_status column not yet migrated',
          });
        }
        // Feed doesn't exist or other error
        return res.status(404).json({ error: 'Feed not found', details: feedError.message });
      }

      if (!feed) {
        return res.status(404).json({ error: 'Feed not found' });
      }

      return res.json({
        progress: (feed as any).refresh_status || null,
      });
    } else if (action === 'refresh') {
      // Manually refresh a feed
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
      }

      if (!geminiApiKey) {
        return res.status(500).json({ error: 'GOOGLE_GEMINI_API_KEY not configured' });
      }

      const { feedId } = req.body;

      if (!feedId) {
        return res.status(400).json({ error: 'Feed ID required' });
      }

      const { data: feed, error: feedError } = await supabase
        .from('watched_feeds')
        .select('*')
        .eq('id', feedId)
        .eq('user_id', user.id)
        .single();

      if (feedError || !feed) {
        return res.status(404).json({ error: 'Feed not found' });
      }

      // Perform refresh synchronously (serverless functions can't do true background work)
      console.log(`[API] Starting refresh for feed ${feed.id}`);
      
      // MUST AWAIT in serverless - otherwise execution context freezes and kills timers
      try {
        await processFeedUpdates(feed.id, feed.feed_url, geminiApiKey, supabase, true);
        console.log(`[API] Refresh completed successfully for feed ${feed.id}`);
        
        // Get updated feed data with new last_checked_at
        const { data: updatedFeed, error: fetchError } = await supabase
          .from('watched_feeds')
          .select('*')
          .eq('id', feedId)
          .eq('user_id', user.id)
          .single();
        
        if (fetchError) {
          console.error('[API] Failed to fetch updated feed:', fetchError);
        }
        
        return res.json({
          success: true,
          message: 'Refresh completed successfully',
          feed_id: feedId,
          feed: updatedFeed || null,
        });
      } catch (refreshError: any) {
        console.error('[API] Refresh failed:', refreshError);
        return res.status(500).json({
          success: false,
          error: refreshError.message || 'Refresh failed',
          feed_id: feedId,
        });
      }
    } else {
      return res.status(400).json({ error: 'Invalid action parameter. Use: watch, updates, progress, or refresh' });
    }
  } catch (error) {
    console.error('RSS feeds API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
