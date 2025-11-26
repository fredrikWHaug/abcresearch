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
import {
  parseRssFeed,
  isWithinDays,
  extractNctId,
  buildHistoryUrl,
  buildComparisonUrl,
  parseLatestTwoVersions,
  extractDiffBlocks,
  generateChangeSummary,
  generateNewStudySummary,
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

// Background refresh function that updates progress as it processes
async function refreshFeedInBackground(
  feedId: number,
  feedUrl: string,
  geminiApiKey: string,
  supabase: any,
  userId?: string,
  accessToken?: string
) {
  console.log(`[REFRESH] ========================================`);
  console.log(`[REFRESH] Starting background refresh for feed ${feedId}`);
  console.log(`[REFRESH] Feed URL: ${feedUrl}`);
  console.log(`[REFRESH] Gemini API key present: ${!!geminiApiKey}`);
  console.log(`[REFRESH] Supabase client present: ${!!supabase}`);
  console.log(`[REFRESH] User ID: ${userId || 'not provided'}`);
  console.log(`[REFRESH] Access token present: ${!!accessToken}`);
  
  // Ensure we have a valid Supabase client
  let client = supabase;
  if (!client && userId && accessToken) {
    console.log(`[REFRESH] Creating new Supabase client for background operation`);
    client = createBackgroundSupabaseClient(userId, accessToken);
  }
  
  if (!client) {
    throw new Error('No Supabase client available for background refresh');
  }
  
  if (!geminiApiKey) {
    throw new Error('Gemini API key is required for background refresh');
  }
  
  try {
    console.log(`[REFRESH] Step 1: Parsing RSS feed...`);
    let entries: any[];
    try {
      entries = await parseRssFeed(feedUrl);
      console.log(`[REFRESH] Step 1 complete: Found ${entries.length} total entries`);
    } catch (parseError: any) {
      console.error(`[REFRESH] ❌ RSS feed parsing failed:`, parseError.message);
      throw new Error(`Failed to parse RSS feed: ${parseError.message}`);
    }
    
    console.log(`[REFRESH] Step 2: Filtering recent entries...`);
    const recentEntries = entries.filter((e) => isWithinDays(e.updated_dt, 14));
    console.log(`[REFRESH] Step 2 complete: Found ${recentEntries.length} recent entries for feed ${feedId}`);

    // Initialize progress tracking
    const totalItems = recentEntries.length;
    let processedItems = 0;
    
    // Try to update refresh_status, but don't fail if column doesn't exist yet
    console.log(`[REFRESH] Step 3: Updating refresh status in database...`);
    try {
      const { error: updateError } = await client
        .from('watched_feeds')
        .update({
          refresh_status: {
            total: totalItems,
            processed: 0,
            in_progress: true,
            started_at: new Date().toISOString(),
          },
        })
        .eq('id', feedId);
      
      if (updateError) {
        throw updateError;
      }
      console.log(`[REFRESH] Step 3 complete: Refresh status updated`);
    } catch (error: any) {
      // If column doesn't exist, log but continue processing
      if (error?.message?.includes('does not exist') || error?.code === '42703') {
        console.warn('[REFRESH] refresh_status column not found, skipping progress tracking. Run migration to add it.');
      } else {
        console.error('[REFRESH] Failed to update refresh status:', error);
        throw error;
      }
    }

    let newUpdates = 0;

    for (const entry of recentEntries) {
      const nctId = extractNctId(entry.link);
      if (!nctId) {
        processedItems++;
        continue;
      }

      const { data: existing } = await client
        .from('trial_updates')
        .select('id')
        .eq('feed_id', feedId)
        .eq('nct_id', nctId)
        .gte('last_update', entry.updated_dt?.toISOString() || new Date().toISOString())
        .single();

      if (existing) {
        console.log(`Skipping ${nctId} - already processed`);
        processedItems++;
        // Update progress (silently fail if column doesn't exist)
        try {
          await client
            .from('watched_feeds')
            .update({
              refresh_status: {
                total: totalItems,
                processed: processedItems,
                in_progress: true,
              },
            })
            .eq('id', feedId);
        } catch (err: any) {
          if (!err?.message?.includes('does not exist') && err?.code !== '42703') {
            console.error('[REFRESH] Failed to update progress:', err);
          }
        }
        continue;
      }

      const studyUrl = `https://clinicaltrials.gov/study/${nctId}`;
      let summary: string;
      let historyUrl: string;
      let comparisonUrl: string;
      let versionA: number;
      let versionB: number;
      let diffBlocks: string[];

      if (entry.isNew) {
        console.log(`${nctId} is a NEW study - generating summary`);
        summary = await generateNewStudySummary(nctId, entry.title, geminiApiKey);
        historyUrl = buildHistoryUrl(nctId);
        comparisonUrl = '';
        versionA = 1;
        versionB = 1;
        diffBlocks = ['NEW_STUDY'];
      } else {
        console.log(`${nctId} is an UPDATED study - comparing versions`);
        historyUrl = buildHistoryUrl(nctId);
        const versionPair = await parseLatestTwoVersions(historyUrl, geminiApiKey);

        if (!versionPair) {
          console.log(`No version pair found for ${nctId}`);
          processedItems++;
          // Update progress (silently fail if column doesn't exist)
          try {
            await client
              .from('watched_feeds')
              .update({
                refresh_status: {
                  total: totalItems,
                  processed: processedItems,
                  in_progress: true,
                },
              })
              .eq('id', feedId);
          } catch (err: any) {
            if (!err?.message?.includes('does not exist') && err?.code !== '42703') {
              console.error('[REFRESH] Failed to update progress:', err);
            }
          }
          continue;
        }

        comparisonUrl = buildComparisonUrl(nctId, versionPair.a, versionPair.b);
        diffBlocks = await extractDiffBlocks(comparisonUrl);
        summary = await generateChangeSummary(nctId, entry.title, diffBlocks, geminiApiKey);
        versionA = versionPair.a;
        versionB = versionPair.b;
      }

      const { error: insertError } = await client.from('trial_updates').insert({
        feed_id: feedId,
        nct_id: nctId,
        title: entry.title,
        last_update: entry.updated_dt?.toISOString() || new Date().toISOString(),
        study_url: studyUrl,
        history_url: historyUrl,
        comparison_url: comparisonUrl || null,
        version_a: versionA,
        version_b: versionB,
        raw_diff_blocks: diffBlocks,
        llm_summary: summary,
      });

      if (insertError) {
        console.error(`Failed to insert update for ${nctId}:`, insertError);
      } else {
        newUpdates++;
        console.log(`Saved ${entry.isNew ? 'NEW' : 'updated'} study ${nctId}`);
      }

      processedItems++;
      
      // Update progress after each study (silently fail if column doesn't exist)
      try {
        await client
          .from('watched_feeds')
          .update({
            refresh_status: {
              total: totalItems,
              processed: processedItems,
              in_progress: true,
            },
          })
          .eq('id', feedId);
      } catch (err: any) {
        if (!err?.message?.includes('does not exist') && err?.code !== '42703') {
          console.error('[REFRESH] Failed to update progress:', err);
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Mark refresh as complete (silently fail if column doesn't exist)
    console.log(`[REFRESH] Step 4: Marking refresh as complete...`);
    try {
      await client
        .from('watched_feeds')
        .update({
          last_checked_at: new Date().toISOString(),
          refresh_status: {
            total: totalItems,
            processed: processedItems,
            in_progress: false,
            completed_at: new Date().toISOString(),
            new_updates: newUpdates,
          },
        })
        .eq('id', feedId);
      console.log(`[REFRESH] Step 4 complete: Refresh marked as complete`);
    } catch (err: any) {
      // Update last_checked_at even if refresh_status column doesn't exist
      if (err?.message?.includes('does not exist') || err?.code === '42703') {
        console.log(`[REFRESH] refresh_status column missing, updating last_checked_at only`);
        await client
          .from('watched_feeds')
          .update({
            last_checked_at: new Date().toISOString(),
          })
          .eq('id', feedId);
      } else {
        console.error('[REFRESH] Failed to update refresh status:', err);
      }
    }

    console.log(`[REFRESH] ✅ Auto-refresh complete: ${newUpdates} new updates found`);
  } catch (refreshError) {
    console.error(`[REFRESH] ❌ Error during auto-refresh for feed ${feedId}:`, refreshError);
    console.error(`[REFRESH] Error stack:`, refreshError instanceof Error ? refreshError.stack : 'No stack trace');
    console.error(`[REFRESH] Error details:`, JSON.stringify(refreshError, Object.getOwnPropertyNames(refreshError)));
    
    // Mark refresh as failed (silently fail if column doesn't exist)
    try {
      await client
        .from('watched_feeds')
        .update({
          refresh_status: {
            in_progress: false,
            error: refreshError instanceof Error ? refreshError.message : 'Unknown error',
          },
        })
        .eq('id', feedId);
    } catch (err: any) {
      if (!err?.message?.includes('does not exist') && err?.code !== '42703') {
        console.error('[REFRESH] Failed to update error status:', err);
      }
    }
  }
  console.log(`[REFRESH] ========================================`);
}

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;
const geminiApiKey = process.env.GOOGLE_GEMINI_API_KEY!;

// Helper to create a Supabase client for background operations
function createBackgroundSupabaseClient(userId: string, accessToken: string) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

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
          locStr || 'USA',
          country || 'US',
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
        if (data && geminiApiKey) {
          console.log(`[API] Starting background refresh for newly created feed ${data.id}`);
          // Get access token from request headers for background operation
          const accessToken = req.headers.authorization?.replace('Bearer ', '') || '';
          // Start refresh in background (don't await)
          refreshFeedInBackground(data.id, data.feed_url, geminiApiKey, supabase, user.id, accessToken).catch(err => {
            console.error('[API] Background refresh error (unhandled):', err);
            console.error('[API] Error stack:', err instanceof Error ? err.stack : 'No stack trace');
          });
          console.log(`[API] Background refresh initiated for feed ${data.id}`);
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

      // Start refresh in background
      console.log(`[API] Starting background refresh for feed ${feed.id}`);
      // Get access token from request headers for background operation
      const accessToken = req.headers.authorization?.replace('Bearer ', '') || '';
      refreshFeedInBackground(feed.id, feed.feed_url, geminiApiKey, supabase, user.id, accessToken).catch(err => {
        console.error('[API] Background refresh error (unhandled):', err);
        console.error('[API] Error stack:', err instanceof Error ? err.stack : 'No stack trace');
      });
      console.log(`[API] Background refresh initiated for feed ${feed.id}`);

      return res.json({
        success: true,
        message: 'Refresh started in background',
        feed_id: feedId,
      });
    } else {
      return res.status(400).json({ error: 'Invalid action parameter. Use: watch, updates, progress, or refresh' });
    }
  } catch (error) {
    console.error('RSS feeds API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
