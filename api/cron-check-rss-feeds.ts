 
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
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const geminiApiKey = process.env.GOOGLE_GEMINI_API_KEY!;

// This runs daily via Vercel Cron
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify this is a cron request (Vercel sets this header)
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!geminiApiKey) {
    return res.status(500).json({ error: 'GOOGLE_GEMINI_API_KEY not configured' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // 1. Get all watched feeds from database
    const { data: feeds, error: feedsError } = await supabase
      .from('watched_feeds')
      .select('*');

    if (feedsError) {
      console.error('Failed to fetch watched feeds:', feedsError);
      return res.status(500).json({ error: 'Failed to fetch feeds' });
    }

    if (!feeds || feeds.length === 0) {
      return res.json({ message: 'No feeds to check', processed: 0 });
    }

    let totalUpdates = 0;

    // 2. Process each feed
    for (const feed of feeds) {
      try {
        console.log(`Checking feed: ${feed.label} (${feed.feed_url})`);
        
        // Parse RSS feed
        const entries = await parseRssFeed(feed.feed_url);
        const recentEntries = entries.filter((e) => isWithinDays(e.updated_dt, 14));

        console.log(`Found ${recentEntries.length} recent entries for ${feed.label}`);

        // 3. Process each recent entry
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
            
            // 4. Get version history
            historyUrl = buildHistoryUrl(nctId);
            const versionPair = await parseLatestTwoVersions(historyUrl, geminiApiKey);

            if (!versionPair) {
              console.log(`No version pair found for ${nctId}`);
              continue;
            }

            // 5. Get comparison and extract diffs
            comparisonUrl = buildComparisonUrl(nctId, versionPair.a, versionPair.b);
            diffBlocks = await extractDiffBlocks(comparisonUrl);

            // 6. Generate LLM summary using Gemini
            summary = await generateChangeSummary(nctId, entry.title, diffBlocks, geminiApiKey);
            versionA = versionPair.a;
            versionB = versionPair.b;
          }

          // 7. Save to database
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
            totalUpdates++;
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
      } catch (error) {
        console.error(`Error processing feed ${feed.id}:`, error);
        // Continue with next feed
      }
    }

    return res.json({
      message: 'Feeds checked successfully',
      feeds_processed: feeds.length,
      updates_found: totalUpdates,
    });
  } catch (error) {
    console.error('Cron job error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

