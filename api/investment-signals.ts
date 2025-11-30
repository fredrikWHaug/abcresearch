/**
 * Investment Signals API
 * Generates AI-powered investment insights from trial updates using Claude
 * 
 * POST /api/investment-signals
 * Body: { feedIds?: number[] } - Optional: filter by specific feed IDs
 * 
 * Returns: { signals: string[] } - Array of 3 investment signal bullet points
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;
const anthropicApiKey = process.env.ANTHROPIC_API_KEY!;

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { user, supabase, error: authError } = await getAuthenticatedUser(req);

    if (authError || !user || !supabase) {
      return res.status(401).json({ error: authError || 'Unauthorized' });
    }

    if (!anthropicApiKey) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
    }

    // Get all watched feeds for the user
    const { data: feeds, error: feedsError } = await supabase
      .from('watched_feeds')
      .select('id, label')
      .eq('user_id', user.id);

    if (feedsError) {
      return res.status(500).json({ error: feedsError.message });
    }

    if (!feeds || feeds.length === 0) {
      return res.json({ 
        signals: [
          { 
            rating: 'HOLD', 
            content: 'No watched feeds yet. Start monitoring clinical trials to receive investment signals.' 
          }
        ]
      });
    }

    const feedIds = feeds.map((f) => f.id);

    // Get recent trial updates (last 30 days) from all watched feeds
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: updates, error: updatesError } = await supabase
      .from('trial_updates')
      .select('nct_id, title, sponsor, llm_summary, last_update, raw_diff_blocks, version_a, version_b')
      .in('feed_id', feedIds)
      .gte('last_update', thirtyDaysAgo.toISOString())
      .order('last_update', { ascending: false })
      .limit(50); // Limit to most recent 50 updates to keep context manageable

    if (updatesError) {
      return res.status(500).json({ error: updatesError.message });
    }

    if (!updates || updates.length === 0) {
      return res.json({ 
        signals: [
          { 
            rating: 'HOLD', 
            content: 'No recent trial updates found. Refresh your feeds to check for new updates.' 
          }
        ]
      });
    }

    // Format updates for Claude analysis
    const updatesContext = updates.map((update, idx) => {
      const isNew = update.raw_diff_blocks?.includes('NEW_STUDY');
      const updateType = isNew ? 'NEW STUDY' : `UPDATE (v${update.version_a} → v${update.version_b})`;
      
      return `${idx + 1}. ${update.sponsor || 'Unknown Sponsor'} - ${update.nct_id}
   Type: ${updateType}
   Title: ${update.title}
   Summary: ${update.llm_summary}
   Date: ${new Date(update.last_update).toLocaleDateString()}`;
    }).join('\n\n');

    // Build prompt for Claude
    const prompt = `You are a senior sell-side biotech equity analyst providing investment signals to institutional investors. 

Analyze the following clinical trial updates and generate EXACTLY 3 bullet points highlighting the most significant investment signals.

Clinical Trial Updates (Last 30 Days):
${updatesContext}

Investment Signal Guidelines:
- Format: "[RATING] Sponsor Name: [concise insight]"
- Each bullet should be 1-2 sentences maximum
- Focus on material events that impact company valuation
- Positive signals: enrollment expansion, new trials, phase progression, positive interim results → OUTPERFORM
- Negative signals: trial termination, enrollment issues, delays, safety concerns → UNDERPERFORM
- Neutral/mixed signals: minor updates, maintenance activities → HOLD
- Use sell-side analyst voice: professional, direct, action-oriented
- Prioritize by materiality and recency

Rating Definitions:
- OUTPERFORM: Positive catalyst, expect stock to outperform sector/market
- HOLD: Neutral development, maintain current position
- UNDERPERFORM: Negative catalyst, expect stock to underperform sector/market

Generate EXACTLY 3 investment signals in this format:
1. [OUTPERFORM] Sponsor Name: insight here
2. [UNDERPERFORM] Sponsor Name: insight here
3. [HOLD] Sponsor Name: insight here

CRITICAL: Each line MUST start with the rating in brackets: [OUTPERFORM], [HOLD], or [UNDERPERFORM]

Do not include any introductory text, explanations, or disclaimers. Return only the 3 numbered bullet points with ratings.`;

    // Call Claude API
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 500,
        temperature: 0.7,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text();
      console.error('Claude API error:', errorText);
      return res.status(500).json({ error: 'Failed to generate investment signals' });
    }

    const claudeData = await claudeResponse.json();
    const signalsText = claudeData.content[0].text;

    // Parse the signals into an array with ratings
    // Expected format: "1. [RATING] Sponsor: insight\n2. [RATING] Sponsor: insight\n3. [RATING] Sponsor: insight"
    const signalLines = signalsText
      .split('\n')
      .filter((line: string) => line.trim().match(/^\d+\./))
      .map((line: string) => {
        // Remove leading number and whitespace
        const cleaned = line.replace(/^\d+\.\s*/, '').trim();
        
        // Extract rating and content
        const ratingMatch = cleaned.match(/^\[(OUTPERFORM|HOLD|UNDERPERFORM)\]\s*/i);
        if (ratingMatch) {
          const rating = ratingMatch[1].toUpperCase();
          const content = cleaned.replace(/^\[(OUTPERFORM|HOLD|UNDERPERFORM)\]\s*/i, '').trim();
          return { rating, content };
        }
        
        // Fallback if no rating found (shouldn't happen but handle gracefully)
        return { rating: 'HOLD', content: cleaned };
      });

    return res.json({
      signals: signalLines,
      updatesAnalyzed: updates.length,
      generatedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Investment signals API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

