/* eslint-disable */
/**
 * Invite Redemption API
 * 
 * POST /api/invite/redeem
 * Body: { token: string, email: string, userId: string }
 * 
 * Calls the redeem_invite RPC function to atomically:
 * 1. Validate the token
 * 2. Mark it as used
 * 3. Create a profile for the user
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

interface RedeemRequest {
  token: string;
  email: string;
  userId: string;
}

interface RedeemResult {
  success: boolean;
  error?: string;
  message?: string;
  already_authorized?: boolean;
  profile_id?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Validate environment variables
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing Supabase environment variables');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // Create Supabase client with service role (bypasses RLS)
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { token, email, userId }: RedeemRequest = req.body;

    // Validate required fields
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Token is required' });
    }
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email is required' });
    }
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Call the redeem_invite RPC function
    const { data, error } = await supabase.rpc('redeem_invite', {
      p_token: token.trim(),
      p_email: email.trim().toLowerCase(),
      p_user_id: userId
    });

    if (error) {
      console.error('RPC error:', error);
      return res.status(500).json({ 
        error: 'Failed to redeem invite',
        details: error.message 
      });
    }

    const result = data as RedeemResult;

    if (!result.success) {
      // Return specific error messages for different failure cases
      return res.status(400).json({ 
        error: result.error || 'Failed to redeem invite'
      });
    }

    // Success
    return res.status(200).json({
      success: true,
      message: result.message,
      alreadyAuthorized: result.already_authorized || false,
      profileId: result.profile_id
    });

  } catch (error) {
    console.error('Invite redemption error:', error);
    return res.status(500).json({ 
      error: 'An unexpected error occurred',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

