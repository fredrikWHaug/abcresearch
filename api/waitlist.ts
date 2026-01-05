/* eslint-disable */
/**
 * Waitlist API
 * 
 * POST /api/waitlist
 * Body: { email: string, name?: string, linkedinUrl?: string, message?: string }
 * 
 * Submits a request to join the waitlist (invite_requests table).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

interface WaitlistRequest {
  email: string;
  name?: string;
  linkedinUrl?: string;
  message?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

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
    const { email, name, linkedinUrl, message }: WaitlistRequest = req.body;

    // Validate required fields
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const trimmedEmail = email.trim().toLowerCase();
    if (!emailRegex.test(trimmedEmail)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate LinkedIn URL if provided
    let validatedLinkedInUrl = linkedinUrl?.trim() || null;
    if (validatedLinkedInUrl) {
      // Accept various LinkedIn URL formats
      const linkedinRegex = /^(https?:\/\/)?(www\.)?linkedin\.com\/(in|pub|profile)\/[\w-]+\/?$/i;
      if (!linkedinRegex.test(validatedLinkedInUrl)) {
        // Try to be lenient - just check if it contains linkedin.com
        if (!validatedLinkedInUrl.includes('linkedin.com')) {
          return res.status(400).json({ error: 'Invalid LinkedIn URL format' });
        }
      }
      // Ensure it starts with https://
      if (!validatedLinkedInUrl.startsWith('http')) {
        validatedLinkedInUrl = 'https://' + validatedLinkedInUrl;
      }
    }

    // Check if already on waitlist
    const { data: existing } = await supabase
      .from('invite_requests')
      .select('id, status')
      .eq('email', trimmedEmail)
      .single();

    if (existing) {
      if (existing.status === 'approved') {
        return res.status(200).json({
          success: true,
          message: 'Good news! Your request has already been approved. Check your email for an invite link.',
          alreadyApproved: true
        });
      }
      return res.status(200).json({
        success: true,
        message: 'You\'re already on the waitlist! We\'ll be in touch soon.',
        alreadyOnWaitlist: true
      });
    }

    // Check if user is already authorized (has a profile)
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', trimmedEmail)
      .single();

    if (profile) {
      return res.status(200).json({
        success: true,
        message: 'You already have access! Please sign in.',
        alreadyAuthorized: true
      });
    }

    // Insert into waitlist
    const { error: insertError } = await supabase
      .from('invite_requests')
      .insert({
        email: trimmedEmail,
        name: name?.trim() || null,
        linkedin_url: validatedLinkedInUrl,
        message: message?.trim() || null
      });

    if (insertError) {
      console.error('Waitlist insert error:', insertError);
      
      // Handle unique constraint violation
      if (insertError.code === '23505') {
        return res.status(200).json({
          success: true,
          message: 'You\'re already on the waitlist! We\'ll be in touch soon.',
          alreadyOnWaitlist: true
        });
      }
      
      return res.status(500).json({ 
        error: 'Failed to join waitlist',
        details: insertError.message 
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Thanks for your interest! We\'ll review your request and send an invite soon.'
    });

  } catch (error) {
    console.error('Waitlist error:', error);
    return res.status(500).json({ 
      error: 'An unexpected error occurred',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

