import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

/**
 * API endpoint to fetch trial updates for user's watched feeds
 * GET: Fetch recent updates with optional filters
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing authorization header' });
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
    if (req.method === 'GET') {
      const { feedId, days = '30' } = req.query;

      // Calculate date threshold
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - parseInt(days as string, 10));

      // First get user's watched feeds
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

      // Build query for updates
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

      // Group by date for timeline view
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
    } else if (req.method === 'POST') {
      // Manually trigger check for a specific feed
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

      // Trigger immediate check by calling the cron function
      // In production, you would use internal service-to-service auth
      return res.json({
        message: 'Feed check will be processed in the next scheduled run',
        feed_id: feedId,
      });
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('RSS feed updates API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

