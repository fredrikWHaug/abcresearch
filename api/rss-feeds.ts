/**
 * Consolidated RSS Feed API
 * 
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
  buildRssUrl,
} from './utils/rss-feed-utils.js';

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
        // Fetch user's watched feeds
        const { data, error } = await supabase
          .from('watched_feeds')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) {
          return res.status(500).json({ error: error.message });
        }

        return res.json({ feeds: data || [] });
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

      console.log(`Manual refresh for feed: ${feed.label} (${feed.feed_url})`);

      const entries = await parseRssFeed(feed.feed_url);
      const recentEntries = entries.filter((e) => isWithinDays(e.updated_dt, 14));

      console.log(`Found ${recentEntries.length} recent entries for ${feed.label}`);

      let newUpdates = 0;

      for (const entry of recentEntries) {
        const nctId = extractNctId(entry.link);
        if (!nctId) continue;

        const { data: existing } = await supabase
          .from('trial_updates')
          .select('id')
          .eq('feed_id', feed.id)
          .eq('nct_id', nctId)
          .gte('last_update', entry.updated_dt?.toISOString() || new Date().toISOString())
          .single();

        if (existing) {
          console.log(`Skipping ${nctId} - already processed`);
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
            continue;
          }

          comparisonUrl = buildComparisonUrl(nctId, versionPair.a, versionPair.b);
          diffBlocks = await extractDiffBlocks(comparisonUrl);
          summary = await generateChangeSummary(nctId, entry.title, diffBlocks, geminiApiKey);
          versionA = versionPair.a;
          versionB = versionPair.b;
        }

        const { error: insertError } = await supabase.from('trial_updates').insert({
          feed_id: feed.id,
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

        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      await supabase
        .from('watched_feeds')
        .update({ last_checked_at: new Date().toISOString() })
        .eq('id', feed.id);

      return res.json({
        success: true,
        feed_id: feedId,
        entries_checked: recentEntries.length,
        new_updates: newUpdates,
        message:
          newUpdates > 0
            ? `Found ${newUpdates} new update${newUpdates > 1 ? 's' : ''}`
            : 'No new updates found',
      });
    } else {
      return res.status(400).json({ error: 'Invalid action. Use: watch, updates, or refresh' });
    }
  } catch (error) {
    console.error('RSS feeds API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

