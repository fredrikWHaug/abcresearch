# RSS Feed Processing Admin Guide

This guide covers how to monitor and manage active RSS feed processing operations.

## Overview

When users add or refresh RSS feeds, the backend processes them asynchronously. Each processing operation can take several minutes depending on:
- Number of trials in the RSS feed
- Puppeteer scraping for version history
- LLM calls for generating summaries

Sometimes you may need to:
- Check what feeds are currently being processed
- Cancel a stuck or long-running feed
- Kill all active processing operations

## Architecture

### Cancellation System

The RSS feed processing system uses **AbortController** for graceful cancellation:

```typescript
// Global tracking of active operations
const activeFeedProcessing = new Map<number, AbortController>();

// Register processing operation
const controller = registerFeedProcessing(feedId);

// Process with cancellation support
await processFeedUpdates(feedId, feedUrl, apiKey, supabase, true, controller.signal);

// Cancel from anywhere
cancelFeedProcessing(feedId); // Stops processing at next checkpoint
```

### Cancellation Checkpoints

Processing checks for cancellation at these points:
1. ✅ Before starting
2. ✅ After RSS feed parsing (15+ seconds)
3. ✅ Before filtering entries
4. ✅ Before each batch of 5 trials
5. ✅ After each batch completes
6. ✅ Between batch delays (2 seconds)
7. ✅ Before each database write

This ensures processing stops within 2-15 seconds after cancellation is triggered.

---

## API Endpoints

### 1. Check Active Processing

**GET** `/api/rss-feeds?action=admin`

Returns list of currently processing feeds.

**Response:**
```json
{
  "active_count": 2,
  "active_feed_ids": [15, 18],
  "active_feeds": [
    {
      "id": 15,
      "label": "Semaglutide trials",
      "feed_url": "https://clinicaltrials.gov/api/rss?intr=Semaglutide...",
      "created_at": "2024-11-28T10:30:00Z"
    }
  ],
  "timestamp": "2024-11-28T10:35:22Z"
}
```

### 2. Cancel Specific Feed

**POST** `/api/rss-feeds?action=admin`

**Body:**
```json
{
  "feedId": 15
}
```

**Response:**
```json
{
  "success": true,
  "message": "Cancelled processing for feed 15",
  "cancelled": true,
  "feed_id": 15
}
```

### 3. Cancel All Active Processing

**POST** `/api/rss-feeds?action=admin`

**Body:**
```json
{
  "cancelAll": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Cancelled 2 active feed processing operations",
  "cancelled_feed_ids": [15, 18],
  "count": 2
}
```

---

## Using the Admin Scripts

### Method 1: Bash Script (Recommended)

**Prerequisites:**
- `curl` installed
- `jq` installed (for JSON formatting)
- Auth token from Supabase

**Setup:**
1. Set API base URL:
```bash
# For local development
export API_BASE='http://localhost:3000'

# For production
export API_BASE='https://your-app.vercel.app'
```

2. Get your auth token:
   - Open the app in browser and login
   - Open DevTools (F12) → Application → Local Storage
   - Copy the `sb-<project>-auth-token` value

3. Export the token:
```bash
export AUTH_TOKEN='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

**Commands:**

```bash
# Check active feeds
./scripts/feed-admin.sh check

# Cancel specific feed
./scripts/feed-admin.sh cancel 15

# Cancel all active feeds
./scripts/feed-admin.sh cancel-all
```

### Method 2: TypeScript Script

```bash
# Install dependencies first
npm install

# Set environment variables
export API_BASE='http://localhost:3000'
export AUTH_TOKEN='your_token'

# Check active feeds
npx ts-node scripts/check-active-feeds.ts check

# Cancel specific feed
npx ts-node scripts/check-active-feeds.ts cancel 15

# Cancel all
npx ts-node scripts/check-active-feeds.ts cancel-all
```

### Method 3: Direct API Calls (curl)

```bash
AUTH_TOKEN='your_token'
API_BASE='https://your-app.vercel.app'

# Check active feeds
curl -X GET "$API_BASE/api/rss-feeds?action=admin" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json"

# Cancel specific feed
curl -X POST "$API_BASE/api/rss-feeds?action=admin" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"feedId": 15}'

# Cancel all
curl -X POST "$API_BASE/api/rss-feeds?action=admin" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cancelAll": true}'
```

---

## Common Scenarios

### Scenario 1: User Deletes Feed While Processing

**What Happens:**
1. User adds "Semaglutide" feed → Processing starts
2. User immediately clicks "Remove" → DELETE request sent
3. Backend calls `cancelFeedProcessing(feedId)` before deleting
4. AbortController triggers cancellation
5. Processing checks cancellation at next checkpoint → throws error
6. Feed is deleted from database
7. Processing stops gracefully ✅

**Logs:**
```
[CANCELLATION] Registered feed 15 for processing
[PROCESS_FEED] Starting for feed 15...
[CANCELLATION] Aborting processing for feed 15
[CANCELLATION] Processing cancelled for feed 15
[PROCESS_FEED] 🛑 Processing cancelled for feed 15
[CANCELLATION] Unregistered feed 15
```

### Scenario 2: Processing Hung on Network Request

**Symptoms:**
- Feed shows "Processing studies... 3 / 10" for > 5 minutes
- No new progress updates

**Solution:**
```bash
# Check what's running
./scripts/feed-admin.sh check

# Cancel the stuck feed
./scripts/feed-admin.sh cancel 15
```

The cancellation will:
- Trigger AbortController
- Processing will check at next checkpoint (within 15 seconds)
- Throw error and stop gracefully
- Refresh status will be updated to error state

### Scenario 3: Multiple Feeds Processing During Cron

**Symptoms:**
- Daily cron job running at 9am ET
- Multiple feeds being processed
- Server load high

**Solution:**
```bash
# Check active processing
./scripts/feed-admin.sh check

# Cancel all if needed (emergency)
./scripts/feed-admin.sh cancel-all
```

**Note:** Cron jobs will resume on next scheduled run (tomorrow at 9am).

### Scenario 4: Orphaned Processing (Feed Deleted But Still Processing)

**Symptoms:**
- Admin endpoint shows feed IDs with no feed details
- These are feeds that were deleted but processing wasn't cancelled

**Detection:**
```bash
./scripts/feed-admin.sh check

# Response shows:
# ⚠️  Orphaned Processing (feeds deleted but still processing):
#    - Feed ID: 15 (feed no longer exists)
```

**Solution:**
```bash
# Cancel the orphaned feed
./scripts/feed-admin.sh cancel 15

# Or cancel all to clean up
./scripts/feed-admin.sh cancel-all
```

---

## Monitoring in Production

### Regular Health Checks

Add a monitoring cron or script to check for stuck processing:

```bash
#!/bin/bash
# Check for feeds processing longer than 10 minutes

RESPONSE=$(AUTH_TOKEN='your_token' ./scripts/feed-admin.sh check)
ACTIVE_COUNT=$(echo "$RESPONSE" | jq -r '.active_count')

if [ "$ACTIVE_COUNT" -gt 0 ]; then
  echo "⚠️  Warning: $ACTIVE_COUNT feeds still processing"
  echo "$RESPONSE" | jq '.active_feeds[] | "Feed \(.id): \(.label) - Created: \(.created_at)"'
  
  # Optionally alert if processing > 10 minutes
  # Send to Slack, PagerDuty, etc.
fi
```

### Vercel Function Logs

Check Vercel logs for cancellation events:

```bash
vercel logs --follow

# Look for:
# [CANCELLATION] Aborting processing for feed 15
# [PROCESS_FEED] 🛑 Processing cancelled for feed 15
```

---

## Troubleshooting

### Issue: "No active processing found"

**Cause:** Processing already completed or never started.

**Check:**
1. Look at feed's `last_checked_at` timestamp in database
2. Check if `refresh_status.in_progress` is false
3. Review Vercel logs for completion/error

### Issue: Cancellation not working

**Cause:** Processing might be stuck in a long-running operation without checkpoints.

**Solutions:**
1. Wait 15-30 seconds (timeout will trigger)
2. Check Vercel function logs
3. If still stuck, function will timeout after 60 seconds (Vercel limit)

### Issue: Feed keeps getting re-added to active list

**Cause:** Multiple API calls or cron jobs starting processing.

**Solutions:**
1. Cancel all processing
2. Check for duplicate cron jobs
3. Review application logs for multiple refresh requests

---

## Security Considerations

### Authentication Required

All admin endpoints require valid Supabase authentication:
- User must be logged in
- Auth token must be valid
- Admin endpoints check user_id for feed ownership

### No Public Access

Admin endpoints are **NOT** exposed to the public:
- Requires `Authorization: Bearer <token>` header
- Token expires after session timeout
- No API key or public access

### Rate Limiting

Consider adding rate limiting to admin endpoints in production:
```typescript
// In api/rss-feeds.ts
if (action === 'admin') {
  // Add rate limiting here
  // Allow max 10 requests per minute per user
}
```

---

## Future Enhancements

Possible improvements:

1. **Admin Dashboard UI**
   - Show active processing in a dashboard
   - Click to cancel individual feeds
   - View processing history

2. **Websocket Monitoring**
   - Real-time updates of processing status
   - Push notifications when processing completes/errors

3. **Processing Metrics**
   - Track average processing time per feed
   - Identify slow feeds
   - Alert on processing > 10 minutes

4. **Auto-Cancellation**
   - Automatically cancel processing after 15 minutes
   - Retry failed feeds with exponential backoff

---

## Summary

The RSS feed cancellation system provides robust control over active processing:

✅ **Register** processing operations with AbortController  
✅ **Check** active operations via API or scripts  
✅ **Cancel** specific feeds or all processing  
✅ **Automatic** cancellation when feeds are deleted  
✅ **Graceful** handling at multiple checkpoints  
✅ **Logs** for debugging and monitoring  

Use the provided scripts to manage processing in development and production!

