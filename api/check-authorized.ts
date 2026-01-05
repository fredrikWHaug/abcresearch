/**
 * Authorization Check API
 * 
 * GET /api/check-authorized
 * Headers: Authorization: Bearer <access_token>
 * 
 * Checks if the authenticated user has a profile (is authorized to use the app).
 * Returns { authorized: boolean, email?: string }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Validate environment variables
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    console.error('Missing Supabase environment variables');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    // Get the access token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        authorized: false, 
        error: 'No authorization token provided' 
      });
    }

    const accessToken = authHeader.replace('Bearer ', '');

    // Create client with the user's access token to get user info
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    });

    // Get the authenticated user
    const { data: { user }, error: userError } = await userClient.auth.getUser();

    if (userError || !user) {
      return res.status(401).json({ 
        authorized: false, 
        error: 'Invalid or expired token' 
      });
    }

    // Use service role to check profiles table (bypasses RLS)
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Check if user has a profile
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('id, email, name')
      .eq('user_id', user.id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      // PGRST116 = no rows returned (not an error, just not authorized)
      console.error('Profile check error:', profileError);
      return res.status(500).json({ 
        authorized: false, 
        error: 'Failed to check authorization' 
      });
    }

    if (profile) {
      return res.status(200).json({
        authorized: true,
        email: profile.email,
        name: profile.name,
        userId: user.id
      });
    } else {
      return res.status(200).json({
        authorized: false,
        email: user.email,
        userId: user.id,
        message: 'This app is invite-only. Please request access or use an invite link.'
      });
    }

  } catch (error) {
    console.error('Authorization check error:', error);
    return res.status(500).json({ 
      authorized: false,
      error: 'An unexpected error occurred',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

