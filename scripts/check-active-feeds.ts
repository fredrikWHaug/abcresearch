#!/usr/bin/env ts-node
/**
 * Script to check and kill active RSS feed processing operations
 * 
 * Environment Variables:
 *   API_BASE   - API base URL (required)
 *                Development: http://localhost:3000
 *                Production:  https://your-app.vercel.app
 *   AUTH_TOKEN - Your Supabase auth token (required)
 * 
 * Usage:
 *   export API_BASE='http://localhost:3000'
 *   export AUTH_TOKEN='your_token'
 *   
 *   npx ts-node scripts/check-active-feeds.ts check           # List active feeds
 *   npx ts-node scripts/check-active-feeds.ts cancel <feedId> # Cancel specific feed
 *   npx ts-node scripts/check-active-feeds.ts cancel-all      # Cancel all active feeds
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing environment variables:');
  console.error('   VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required');
  process.exit(1);
}

// Get auth token from command line or environment
const AUTH_TOKEN = process.env.AUTH_TOKEN;

if (!AUTH_TOKEN) {
  console.error('❌ Missing AUTH_TOKEN environment variable');
  console.error('   Get your token from Supabase dashboard or browser DevTools');
  console.error('   Usage: AUTH_TOKEN=your_token npx ts-node scripts/check-active-feeds.ts check');
  process.exit(1);
}

const API_BASE = process.env.API_BASE;

if (!API_BASE) {
  console.error('❌ Missing API_BASE environment variable');
  console.error('   For development: export API_BASE="http://localhost:3000"');
  console.error('   For production:  export API_BASE="https://your-app.vercel.app"');
  process.exit(1);
}

async function checkActiveFeeds() {
  console.log('🔍 Checking for active feed processing...');
  console.log(`📡 API: ${API_BASE}/api/rss-feeds?action=admin\n`);
  
  try {
    const response = await fetch(`${API_BASE}/api/rss-feeds?action=admin`, {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
      },
    });

    if (!response.ok) {
      console.error(`❌ HTTP ${response.status}: ${response.statusText}`);
      try {
        const error = await response.json();
        console.error('Error details:', error);
      } catch {
        const text = await response.text();
        console.error('Response:', text);
      }
      return;
    }

    const data = await response.json();

    console.log(`📊 Active Processing Summary:`);
    console.log(`   Total active: ${data.active_count}`);
    console.log(`   Timestamp: ${new Date(data.timestamp).toLocaleString()}\n`);

    if (data.active_count === 0) {
      console.log('✅ No active feed processing operations');
      return;
    }

    console.log('📋 Active Feeds:');
    data.active_feeds.forEach((feed: any) => {
      console.log(`   - Feed ID: ${feed.id}`);
      console.log(`     Label: ${feed.label}`);
      console.log(`     URL: ${feed.feed_url}`);
      console.log(`     Created: ${new Date(feed.created_at).toLocaleString()}`);
      console.log('');
    });

    // Show any feed IDs that don't have details (deleted feeds still processing)
    const detailedIds = new Set(data.active_feeds.map((f: any) => f.id));
    const orphanedIds = data.active_feed_ids.filter((id: number) => !detailedIds.has(id));
    
    if (orphanedIds.length > 0) {
      console.log('⚠️  Orphaned Processing (feeds deleted but still processing):');
      orphanedIds.forEach((id: number) => {
        console.log(`   - Feed ID: ${id} (feed no longer exists)`);
      });
      console.log('');
    }
  } catch (error) {
    console.error('❌ Error checking active feeds:', error);
  }
}

async function cancelFeed(feedId: number) {
  console.log(`🛑 Cancelling processing for feed ${feedId}...\n`);
  
  try {
    const response = await fetch(`${API_BASE}/api/rss-feeds?action=admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`,
      },
      body: JSON.stringify({ feedId }),
    });

    if (!response.ok) {
      console.error(`❌ HTTP ${response.status}: ${response.statusText}`);
      try {
        const error = await response.json();
        console.error('Error details:', error);
      } catch {
        const text = await response.text();
        console.error('Response:', text);
      }
      return;
    }

    const data = await response.json();

    if (data.cancelled) {
      console.log(`✅ Successfully cancelled processing for feed ${feedId}`);
    } else {
      console.log(`ℹ️  No active processing found for feed ${feedId}`);
    }
  } catch (error) {
    console.error('❌ Error cancelling feed:', error);
  }
}

async function cancelAllFeeds() {
  console.log('🛑 Cancelling ALL active feed processing...\n');
  
  try {
    const response = await fetch(`${API_BASE}/api/rss-feeds?action=admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`,
      },
      body: JSON.stringify({ cancelAll: true }),
    });

    if (!response.ok) {
      console.error(`❌ HTTP ${response.status}: ${response.statusText}`);
      try {
        const error = await response.json();
        console.error('Error details:', error);
      } catch {
        const text = await response.text();
        console.error('Response:', text);
      }
      return;
    }

    const data = await response.json();

    console.log(`✅ ${data.message}`);
    if (data.cancelled_feed_ids.length > 0) {
      console.log('\n📋 Cancelled feeds:');
      data.cancelled_feed_ids.forEach((id: number) => {
        console.log(`   - Feed ID: ${id}`);
      });
    }
  } catch (error) {
    console.error('❌ Error cancelling all feeds:', error);
  }
}

// Main
const args = process.argv.slice(2);
const command = args[0];

(async () => {
  switch (command) {
    case 'check':
      await checkActiveFeeds();
      break;
    
    case 'cancel':
      const feedId = parseInt(args[1], 10);
      if (isNaN(feedId)) {
        console.error('❌ Invalid feed ID. Usage: cancel <feedId>');
        process.exit(1);
      }
      await cancelFeed(feedId);
      break;
    
    case 'cancel-all':
      await cancelAllFeeds();
      break;
    
    default:
      console.log('Usage:');
      console.log('  npx ts-node scripts/check-active-feeds.ts check           # List active feeds');
      console.log('  npx ts-node scripts/check-active-feeds.ts cancel <feedId> # Cancel specific feed');
      console.log('  npx ts-node scripts/check-active-feeds.ts cancel-all      # Cancel all active feeds');
      process.exit(1);
  }
})();

