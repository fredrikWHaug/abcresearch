 
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
  fetchSponsorInfo,
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

        // 3. Filter entries that need processing
        const entriesToProcess: typeof recentEntries = [];
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
          } else {
            entriesToProcess.push(entry);
          }
        }

        console.log(`Processing ${entriesToProcess.length} new/updated entries`);

        // 4. Process entries in batches of 5 (parallel Puppeteer operations)
        const BATCH_SIZE = 5;
        for (let i = 0; i < entriesToProcess.length; i += BATCH_SIZE) {
          const batch = entriesToProcess.slice(i, i + BATCH_SIZE);
          console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(entriesToProcess.length / BATCH_SIZE)} (${batch.length} studies)`);

          // Process batch in parallel
          const batchResults = await Promise.allSettled(
            batch.map(async (entry) => {
              const nctId = extractNctId(entry.link);
              if (!nctId) throw new Error('No NCT ID found');

              const studyUrl = `https://clinicaltrials.gov/study/${nctId}`;
              let summary: string;
              let historyUrl: string;
              let comparisonUrl: string;
              let versionA: number;
              let versionB: number;
              let diffBlocks: string[];

              // Fetch sponsor information
              const sponsor = await fetchSponsorInfo(nctId);

              // Handle brand new studies differently
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
                  throw new Error(`No version pair found for ${nctId}`);
                }

                comparisonUrl = buildComparisonUrl(nctId, versionPair.a, versionPair.b);
                diffBlocks = await extractDiffBlocks(comparisonUrl);
                summary = await generateChangeSummary(nctId, entry.title, diffBlocks, geminiApiKey);
                versionA = versionPair.a;
                versionB = versionPair.b;
              }

              return {
                nctId,
                entry,
                studyUrl,
                historyUrl,
                comparisonUrl,
                versionA,
                versionB,
                diffBlocks,
                summary,
                sponsor,
              };
            })
          );

          // Save results from batch
          for (const result of batchResults) {
            if (result.status === 'fulfilled') {
              const data = result.value;
              const { error: insertError } = await supabase.from('trial_updates').insert({
                feed_id: feed.id,
                nct_id: data.nctId,
                title: data.entry.title,
                last_update: data.entry.updated_dt?.toISOString() || new Date().toISOString(),
                study_url: data.studyUrl,
                history_url: data.historyUrl,
                comparison_url: data.comparisonUrl || null,
                version_a: data.versionA,
                version_b: data.versionB,
                raw_diff_blocks: data.diffBlocks,
                llm_summary: data.summary,
                sponsor: data.sponsor || null,
              });

              if (insertError) {
                console.error(`Failed to insert update for ${data.nctId}:`, insertError);
              } else {
                totalUpdates++;
                console.log(`✅ Saved ${data.entry.isNew ? 'NEW' : 'updated'} study ${data.nctId}`);
              }
            } else {
              console.error(`❌ Failed to process study:`, result.reason);
            }
          }

          // Small delay between batches
          if (i + BATCH_SIZE < entriesToProcess.length) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        }

        // Update last_checked_at on success
        await supabase
          .from('watched_feeds')
          .update({ last_checked_at: new Date().toISOString() })
          .eq('id', feed.id);
      } catch (error) {
        console.error(`Error processing feed ${feed.id}:`, error);
        
        // ALWAYS update last_checked_at even on error (prevents immediate retry)
        try {
          await supabase
            .from('watched_feeds')
            .update({ last_checked_at: new Date().toISOString() })
            .eq('id', feed.id);
        } catch (updateError) {
          console.error(`Failed to update last_checked_at for feed ${feed.id}:`, updateError);
        }
        
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

