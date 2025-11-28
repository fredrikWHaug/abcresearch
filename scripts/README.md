# Admin Scripts

Scripts for managing and monitoring RSS feed processing operations.

## Quick Start

### Setup

1. **Set API Base URL:**
```bash
# For local development
export API_BASE='http://localhost:3000'

# For production
export API_BASE='https://your-app.vercel.app'
```

2. **Set Auth Token:**
```bash
export AUTH_TOKEN='your_supabase_auth_token'
```

### Check Active Feeds

```bash
# Using bash script (recommended)
./scripts/feed-admin.sh check

# Using TypeScript
npx ts-node scripts/check-active-feeds.ts check
```

### Cancel a Specific Feed

```bash
./scripts/feed-admin.sh cancel 15
```

### Cancel All Active Feeds

```bash
./scripts/feed-admin.sh cancel-all
```

## Getting Your Auth Token

1. Open your app in browser and login
2. Open DevTools (F12) → Application → Local Storage
3. Find `sb-<your-project>-auth-token`
4. Copy the token value (starts with `eyJ...`)
5. Export it: `export AUTH_TOKEN='eyJ...'`

## Scripts

### `feed-admin.sh`
Bash script for quick admin operations. Requires `curl` and `jq`.

**Usage:**
```bash
./scripts/feed-admin.sh [check|cancel|cancel-all] [feedId]
```

### `check-active-feeds.ts`
TypeScript script with detailed output and error handling.

**Usage:**
```bash
AUTH_TOKEN='token' npx ts-node scripts/check-active-feeds.ts [check|cancel|cancel-all] [feedId]
```

## Environment Variables

- `AUTH_TOKEN` - Your Supabase authentication token (required)
- `API_BASE` - API base URL (default: production URL)
- `VITE_SUPABASE_URL` - Supabase project URL (from .env)
- `VITE_SUPABASE_ANON_KEY` - Supabase anon key (from .env)

## Examples

### Development (Local)
```bash
export API_BASE='http://localhost:3000'
export AUTH_TOKEN='your_token'
./scripts/feed-admin.sh check
```

### Production
```bash
export API_BASE='https://your-app.vercel.app'
export AUTH_TOKEN='your_token'
./scripts/feed-admin.sh check
```

### Monitoring Script
Create a monitoring script to check for stuck feeds:

```bash
#!/bin/bash
# monitor-feeds.sh

RESPONSE=$(AUTH_TOKEN='your_token' ./scripts/feed-admin.sh check)
ACTIVE=$(echo "$RESPONSE" | jq -r '.active_count')

if [ "$ACTIVE" -gt 5 ]; then
  echo "⚠️  Warning: $ACTIVE feeds processing!"
  # Send alert (Slack, email, etc.)
fi
```

## See Also

- [RSS Feed Admin Guide](../documentation/rss-feed-admin.md) - Complete documentation
- [API Documentation](../documentation/2-backend.md) - Backend API reference

