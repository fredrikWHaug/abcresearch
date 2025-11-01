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

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;
const geminiApiKey = process.env.GOOGLE_GEMINI_API_KEY!;

/**
 * API endpoint to manually refresh a specific RSS feed
 * POST: Trigger immediate check for a feed
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  if (!geminiApiKey) {
    return res.status(500).json({ error: 'GOOGLE_GEMINI_API_KEY not configured' });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  // Verify user is authenticated
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { feedId } = req.body;

    if (!feedId) {
      return res.status(400).json({ error: 'Feed ID required' });
    }

    // Verify user owns this feed
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

    // Parse RSS feed
    const entries = await parseRssFeed(feed.feed_url);
    const recentEntries = entries.filter((e) => isWithinDays(e.updated_dt, 14));

    console.log(`Found ${recentEntries.length} recent entries for ${feed.label}`);

    let newUpdates = 0;

    // Process each recent entry
    for (const entry of recentEntries) {
      const nctId = extractNctId(entry.link);
      if (!nctId) continue;

      // Check if we already have this update
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

      // Handle brand new studies differently
      if (entry.isNew) {
        console.log(`${nctId} is a NEW study - generating summary`);
        
        // For new studies, just generate a summary based on title
        summary = await generateNewStudySummary(nctId, entry.title, geminiApiKey);
        historyUrl = buildHistoryUrl(nctId);
        comparisonUrl = '';
        versionA = 1;
        versionB = 1;
        diffBlocks = ['NEW_STUDY'];
      } else {
        console.log(`${nctId} is an UPDATED study - comparing versions`);
        
        // Get version history
        historyUrl = buildHistoryUrl(nctId);
        const versionPair = await parseLatestTwoVersions(historyUrl, geminiApiKey);

        if (!versionPair) {
          console.log(`No version pair found for ${nctId}`);
          continue;
        }

        // Get comparison and extract diffs
        comparisonUrl = buildComparisonUrl(nctId, versionPair.a, versionPair.b);
        diffBlocks = await extractDiffBlocks(comparisonUrl);

        // Generate LLM summary using Gemini
        summary = await generateChangeSummary(nctId, entry.title, diffBlocks, geminiApiKey);
        versionA = versionPair.a;
        versionB = versionPair.b;
      }

      // Save to database
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

      // Polite delay
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Update last_checked_at
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
  } catch (error) {
    console.error('RSS feed refresh error:', error);
    return res.status(500).json({ error: 'Failed to refresh feed' });
  }
}

