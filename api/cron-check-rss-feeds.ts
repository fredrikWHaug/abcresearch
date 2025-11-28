
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { 
  processFeedUpdates, 
  registerFeedProcessing, 
  unregisterFeedProcessing 
} from './utils/rss-feed-utils.js';
import { sendTrialUpdateEmail } from './services/emailService.js';
const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const geminiApiKey = process.env.GOOGLE_GEMINI_API_KEY!;

/**
 * Vercel Cron Job - Runs daily at 9am ET (14:00 UTC)
 * 
 * Checks all watched RSS feeds for clinical trial updates.
 * The main ClinicalTrials.gov database is refreshed daily, Monday through Friday, typically by 9 a.m. ET.
 * The feed can be configured to show new or modified records within the last 14 days.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('[CRON] Starting daily RSS feed check');
  
  // Verify this is a cron request (Vercel sets this header)
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.error('[CRON] Unauthorized request - invalid CRON_SECRET');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!geminiApiKey) {
    console.error('[CRON] GOOGLE_GEMINI_API_KEY not configured');
    return res.status(500).json({ error: 'GOOGLE_GEMINI_API_KEY not configured' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // 1. Get all watched feeds from database
    const { data: feeds, error: feedsError } = await supabase
      .from('watched_feeds')
      .select('*');

    if (feedsError) {
      console.error('[CRON] Failed to fetch watched feeds:', feedsError);
      return res.status(500).json({ error: 'Failed to fetch feeds' });
    }

    if (!feeds || feeds.length === 0) {
      console.log('[CRON] No feeds to check');
      return res.json({ message: 'No feeds to check', processed: 0 });
    }

    console.log(`[CRON] Found ${feeds.length} feeds to check`);

    let totalUpdates = 0;
    const results: Array<{
      feed_id: number;
      label: string;
      new_updates?: number;
      processed?: number;
      total?: number;
      error?: string;
    }> = [];

    // 2. Process each feed using shared processing logic
    for (const feed of feeds) {
      // Register processing for this feed
      const controller = registerFeedProcessing(feed.id);
      
      try {
        console.log(`[CRON] Checking feed: ${feed.label} (${feed.feed_url})`);
        
        const result = await processFeedUpdates(
          feed.id,
          feed.feed_url,
          geminiApiKey,
          supabase,
          false, // Disable progress tracking for cron (no UI to update)
          controller.signal // Pass cancellation signal
        );

        totalUpdates += result.newUpdates;
        results.push({
          feed_id: feed.id,
          label: feed.label,
          new_updates: result.newUpdates,
          processed: result.processedItems,
          total: result.totalItems,
        });

        console.log(`[CRON] ✅ Feed ${feed.label}: ${result.newUpdates} new updates`);

        // 3. Send email notification if configured and there are new updates
        if (feed.notification_email && result.newUpdates > 0 && result.updates && result.updates.length > 0) {
          console.log(`[CRON] Sending email to ${feed.notification_email} for feed ${feed.id}`);
          
          try {
            const emailSent = await sendTrialUpdateEmail({
              feedLabel: feed.label,
              updates: result.updates,
              recipientEmail: feed.notification_email,
            });

            if (emailSent) {
              console.log(`[CRON] ✅ Email sent successfully to ${feed.notification_email}`);
              
              // Update last_email_sent_at timestamp
              await supabase
                .from('watched_feeds')
                .update({
                  last_email_sent_at: new Date().toISOString(),
                })
                .eq('id', feed.id);

              // Mark updates as emailed
              const updateIds = result.updates.map(u => u.nctId);
              if (updateIds.length > 0) {
                await supabase
                  .from('trial_updates')
                  .update({ email_sent: true })
                  .eq('feed_id', feed.id)
                  .in('nct_id', updateIds);
              }
            } else {
              console.log(`[CRON] ⚠️ Email sending failed for ${feed.notification_email}`);
            }
          } catch (emailError) {
            console.error(`[CRON] ❌ Error sending email:`, emailError);
            // Don't fail the entire cron job if email fails
          }
        } else if (feed.notification_email && result.newUpdates === 0) {
          console.log(`[CRON] No new updates for feed ${feed.id}, skipping email`);
        } else if (!feed.notification_email) {
          console.log(`[CRON] No notification email configured for feed ${feed.id}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const isCancelled = errorMessage.includes('Processing cancelled');
        
        if (isCancelled) {
          console.log(`[CRON] 🛑 Processing cancelled for feed ${feed.id} (feed was deleted)`);
          results.push({
            feed_id: feed.id,
            label: feed.label,
            error: 'Cancelled - feed deleted',
          });
        } else {
          console.error(`[CRON] ❌ Error processing feed ${feed.id}:`, error);
          results.push({
            feed_id: feed.id,
            label: feed.label,
            error: errorMessage,
          });
        }
        // Continue with next feed (error handling done in processFeedUpdates)
      } finally {
        // Always unregister when processing completes or errors
        unregisterFeedProcessing(feed.id);
      }
    }

    console.log(`[CRON] ✅ Complete: ${feeds.length} feeds processed, ${totalUpdates} total updates`);

    return res.json({
      message: 'Feeds checked successfully',
      feeds_processed: feeds.length,
      updates_found: totalUpdates,
      results,
    });
  } catch (error) {
    console.error('[CRON] Fatal error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
