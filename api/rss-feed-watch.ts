import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { buildRssUrl } from './utils/rss-feed-utils.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

/**
 * API endpoint to manage watched RSS feeds
 * GET: Fetch user's watched feeds
 * POST: Add a new watched feed
 * PUT: Update an existing watched feed
 * DELETE: Remove a watched feed
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

      // Build RSS URL from search term
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
  } catch (error) {
    console.error('RSS feed watch API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

