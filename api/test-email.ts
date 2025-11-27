/**
 * Test Email Endpoint
 * Send a test email to verify SendGrid configuration
 * 
 * Usage: GET /api/test-email?email=your@email.com
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sendTestEmail } from './services/emailService.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  const email = req.query.email as string;

  if (!email) {
    return res.status(400).json({
      error: 'Email parameter required',
      usage: 'GET /api/test-email?email=your@email.com',
    });
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  try {
    console.log(`[TEST-EMAIL] Sending test email to ${email}`);
    const success = await sendTestEmail(email);

    if (success) {
      return res.json({
        success: true,
        message: `Test email sent successfully to ${email}`,
        note: 'Check your inbox (and spam folder) for the test email',
      });
    } else {
      return res.status(500).json({
        success: false,
        error: 'Failed to send test email. Check server logs for details.',
      });
    }
  } catch (error) {
    console.error('[TEST-EMAIL] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

