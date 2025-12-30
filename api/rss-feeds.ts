/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Consolidated RSS Feed API
 * Handles all RSS feed operations:
 * - GET /api/rss-feeds?action=watch - Get watched feeds
 * - POST /api/rss-feeds?action=watch - Add watched feed
 * - PUT /api/rss-feeds?action=watch - Update watched feed
 * - DELETE /api/rss-feeds?action=watch - Remove watched feed (cancels active processing)
 * - GET /api/rss-feeds?action=updates&feedId=xxx&days=30 - Get trial updates
 * - POST /api/rss-feeds?action=refresh - Manually refresh a feed
 * - GET /api/rss-feeds?action=admin - Get list of currently processing feeds
 * - POST /api/rss-feeds?action=admin&feedId=xxx - Cancel processing for specific feed
 * - POST /api/rss-feeds?action=admin&cancelAll=true - Cancel all active processing
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { 
  processFeedUpdates, 
  registerFeedProcessing, 
  unregisterFeedProcessing, 
  cancelFeedProcessing,
  getActiveFeedProcessing,
  cancelAllFeedProcessing
} from './utils/rss-feed-utils.js';

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
        const { searchTerm, label, locStr, country, dateField, notificationEmail } = body;

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
            notification_email: notificationEmail || null,
          })
          .select()
          .single();

        if (error) {
          return res.status(500).json({ error: error.message });
        }

        // IMPORTANT: In serverless, we must process BEFORE sending response
        // Otherwise execution context freezes and timers don't fire
        if (data && geminiApiKey) {
          console.log(`[API] Starting initial processing for newly created feed ${data.id}`);
          console.log(`[API] NOTE: Processing happens BEFORE response to avoid serverless freeze`);
          
          // Register the processing operation so it can be cancelled if user deletes the feed
          const controller = registerFeedProcessing(data.id);
          
          // Process synchronously BEFORE sending response
          // This keeps the function alive and prevents execution context freeze
          try {
            const result = await processFeedUpdates(data.id, data.feed_url, geminiApiKey, supabase, true, controller.signal);
            console.log(`[API] Initial processing completed for feed ${data.id}. Processed: ${result.processedItems}, HasMore: ${result.hasMoreEntries}`);
            
            // Return success with the feed AND chaining info for frontend
            return res.json({ 
              feed: data,
              processing_complete: !result.hasMoreEntries,
              processedItems: result.processedItems,
              newUpdates: result.newUpdates,
              hasMoreEntries: result.hasMoreEntries,
              remainingEntries: result.remainingEntries,
            });
          } catch (refreshError: any) {
            const isCancelled = refreshError.message?.includes('Processing cancelled');
            
            if (isCancelled) {
              console.log(`[API] Processing cancelled for feed ${data.id}`);
              // Feed exists but processing was cancelled
              return res.json({
                feed: data,
                processing_complete: false,
                cancelled: true,
              });
            } else {
              // Feed was created successfully, but processing failed
              console.error('[API] Initial processing failed (feed still created):', refreshError.message);
              return res.json({
                feed: data,
                processing_complete: false,
                error: refreshError.message,
              });
            }
          } finally {
            // Always unregister when processing completes or errors
            unregisterFeedProcessing(data.id);
          }
        } else {
          console.log(`[API] Skipping auto-refresh: data=${!!data}, geminiApiKey=${!!geminiApiKey}`);
          return res.json({ feed: data });
        }
      } else if (req.method === 'PUT') {
        // Update watched feed
        const { feedId, feedUrl, label, notificationEmail } = req.body;

        if (!feedId || !feedUrl) {
          return res.status(400).json({ error: 'Feed ID and URL required' });
        }

        const { data, error } = await supabase
          .from('watched_feeds')
          .update({
            feed_url: feedUrl,
            label: label || 'Clinical Trials Feed',
            notification_email: notificationEmail || null,
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

        // Cancel any active processing for this feed BEFORE deleting
        const wasCancelled = cancelFeedProcessing(feedId);
        if (wasCancelled) {
          console.log(`[API] Cancelled active processing for feed ${feedId} before deletion`);
        }

        const { error } = await supabase
          .from('watched_feeds')
          .delete()
          .eq('id', feedId)
          .eq('user_id', user.id);

        if (error) {
          return res.status(500).json({ error: error.message });
        }

        return res.json({ 
          message: 'Feed removed successfully',
          cancelled: wasCancelled 
        });
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
    } else if (action === 'init') {
      // OPTIMIZED: Combined endpoint - get both feeds AND updates in a single request
      // This eliminates the need for two separate API calls on initial load
      if (req.method === 'GET') {
        const { days = '30' } = req.query;
        
        // Fetch feeds and updates in PARALLEL (2 DB queries instead of 3)
        const daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - parseInt(days as string, 10));
        
        const [feedsResult, updatesResult] = await Promise.all([
          // Query 1: Get all watched feeds for this user
          supabase
            .from('watched_feeds')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false }),
          // Query 2: Get all updates for this user's feeds (with feed info via join)
          supabase
            .from('trial_updates')
            .select(`
              *,
              watched_feeds!inner(id, label, feed_url, user_id)
            `)
            .eq('watched_feeds.user_id', user.id)
            .gte('last_update', daysAgo.toISOString())
            .order('last_update', { ascending: false })
        ]);
        
        if (feedsResult.error) {
          return res.status(500).json({ error: feedsResult.error.message });
        }
        
        if (updatesResult.error) {
          return res.status(500).json({ error: updatesResult.error.message });
        }
        
        const feeds = (feedsResult.data || []).map((feed: any) => ({
          ...feed,
          refresh_status: feed.refresh_status || null,
        }));
        
        // Build timeline from updates
        const timeline: Record<string, any[]> = {};
        (updatesResult.data || []).forEach((update) => {
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
          feeds,
          updates: updatesResult.data || [],
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
      
      // Register the processing operation so it can be cancelled if user deletes the feed
      const controller = registerFeedProcessing(feed.id);
      
      // MUST AWAIT in serverless - otherwise execution context freezes and kills timers
      try {
        const result = await processFeedUpdates(feed.id, feed.feed_url, geminiApiKey, supabase, true, controller.signal);
        console.log(`[API] Refresh completed successfully for feed ${feed.id}. Processed: ${result.processedItems}, New: ${result.newUpdates}, HasMore: ${result.hasMoreEntries}`);
        
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
          message: result.hasMoreEntries 
            ? `Processed ${result.processedItems} entries. ${result.remainingEntries} more available.`
            : `Completed! ${result.processedItems} entries processed, ${result.newUpdates} new updates.`,
          feed_id: feedId,
          feed: updatedFeed || null,
          processedItems: result.processedItems,
          newUpdates: result.newUpdates,
          hasMoreEntries: result.hasMoreEntries,
          remainingEntries: result.remainingEntries,
        });
      } catch (refreshError: any) {
        const isCancelled = refreshError.message?.includes('Processing cancelled');
        
        if (isCancelled) {
          console.log(`[API] Refresh cancelled for feed ${feed.id}`);
          return res.status(200).json({
            success: false,
            message: 'Refresh cancelled',
            cancelled: true,
            feed_id: feedId,
          });
        } else {
          console.error('[API] Refresh failed:', refreshError);
          return res.status(500).json({
            success: false,
            error: refreshError.message || 'Refresh failed',
            feed_id: feedId,
          });
        }
      } finally {
        // Always unregister when processing completes or errors
        unregisterFeedProcessing(feed.id);
      }
    } else if (action === 'admin') {
      // Admin actions for managing active processing
      if (req.method === 'GET') {
        // Get list of currently active feed processing operations
        const activeFeedIds = getActiveFeedProcessing();
        
        // Get feed details for active feeds (if they still exist)
        let activeFeeds: any[] = [];
        if (activeFeedIds.length > 0) {
          const { data: feeds } = await supabase
            .from('watched_feeds')
            .select('id, label, feed_url, created_at')
            .in('id', activeFeedIds);
          
          activeFeeds = feeds || [];
        }
        
        return res.json({
          active_count: activeFeedIds.length,
          active_feed_ids: activeFeedIds,
          active_feeds: activeFeeds,
          timestamp: new Date().toISOString(),
        });
      } else if (req.method === 'POST') {
        // Cancel active processing
        const { feedId, cancelAll } = req.body;
        
        if (cancelAll) {
          // Cancel all active processing
          console.log('[API] Admin action: Cancel all active processing');
          const result = cancelAllFeedProcessing();
          
          return res.json({
            success: true,
            message: `Cancelled ${result.count} active feed processing operations`,
            cancelled_feed_ids: result.cancelled,
            count: result.count,
          });
        } else if (feedId) {
          // Cancel specific feed processing
          console.log(`[API] Admin action: Cancel processing for feed ${feedId}`);
          const wasCancelled = cancelFeedProcessing(feedId);
          
          return res.json({
            success: true,
            message: wasCancelled 
              ? `Cancelled processing for feed ${feedId}` 
              : `No active processing found for feed ${feedId}`,
            cancelled: wasCancelled,
            feed_id: feedId,
          });
        } else {
          return res.status(400).json({ 
            error: 'Either feedId or cancelAll=true is required' 
          });
        }
      } else {
        return res.status(405).json({ error: 'Method not allowed' });
      }
    } else {
      return res.status(400).json({ error: 'Invalid action parameter. Use: watch, updates, progress, refresh, or admin' });
    }
  } catch (error) {
    console.error('RSS feeds API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
