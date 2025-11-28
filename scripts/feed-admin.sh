#!/bin/bash
# RSS Feed Processing Admin Script
# Usage: ./scripts/feed-admin.sh [check|cancel|cancel-all] [feedId]

set -e

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Check for required environment variables
if [ -z "$VITE_SUPABASE_URL" ] || [ -z "$VITE_SUPABASE_ANON_KEY" ]; then
  echo "❌ Error: Missing environment variables"
  echo "   Make sure .env file exists with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY"
  exit 1
fi

# Get API base URL
# For development: export API_BASE='http://localhost:3000'
# For production: Set your actual Vercel URL
API_BASE="${API_BASE}"

if [ -z "$API_BASE" ]; then
  echo "❌ Error: API_BASE not set"
  echo ""
  echo "Please set the API_BASE environment variable:"
  echo "  For development: export API_BASE='http://localhost:3000'"
  echo "  For production:  export API_BASE='https://your-app.vercel.app'"
  echo ""
  exit 1
fi

# Get auth token from environment or parameter
if [ -z "$AUTH_TOKEN" ]; then
  echo "❌ Error: AUTH_TOKEN not set"
  echo ""
  echo "Get your auth token from:"
  echo "  1. Open your app in browser and login"
  echo "  2. Open DevTools (F12) → Application → Local Storage"
  echo "  3. Copy the 'sb-<project>-auth-token' value"
  echo ""
  echo "Usage: AUTH_TOKEN='your_token' ./scripts/feed-admin.sh check"
  exit 1
fi

COMMAND=$1

case "$COMMAND" in
  check)
    echo "🔍 Checking active feed processing..."
    echo "📡 API: $API_BASE/api/rss-feeds?action=admin"
    echo ""
    
    RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$API_BASE/api/rss-feeds?action=admin" \
      -H "Authorization: Bearer $AUTH_TOKEN" \
      -H "Content-Type: application/json")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    if [ "$HTTP_CODE" != "200" ]; then
      echo "❌ Error: HTTP $HTTP_CODE"
      echo ""
      echo "Response:"
      echo "$BODY"
      exit 1
    fi
    
    # Check if response is valid JSON
    if echo "$BODY" | jq empty 2>/dev/null; then
      echo "$BODY" | jq '.'
    else
      echo "❌ Invalid JSON response:"
      echo "$BODY"
      exit 1
    fi
    ;;
  
  cancel)
    if [ -z "$2" ]; then
      echo "❌ Error: Feed ID required"
      echo "Usage: ./scripts/feed-admin.sh cancel <feedId>"
      exit 1
    fi
    FEED_ID=$2
    echo "🛑 Cancelling processing for feed $FEED_ID..."
    
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/api/rss-feeds?action=admin" \
      -H "Authorization: Bearer $AUTH_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"feedId\": $FEED_ID}")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    if [ "$HTTP_CODE" != "200" ]; then
      echo "❌ Error: HTTP $HTTP_CODE"
      echo "$BODY"
      exit 1
    fi
    
    if echo "$BODY" | jq empty 2>/dev/null; then
      echo "$BODY" | jq '.'
    else
      echo "$BODY"
    fi
    ;;
  
  cancel-all)
    echo "🛑 Cancelling ALL active feed processing..."
    
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/api/rss-feeds?action=admin" \
      -H "Authorization: Bearer $AUTH_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"cancelAll": true}')
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    if [ "$HTTP_CODE" != "200" ]; then
      echo "❌ Error: HTTP $HTTP_CODE"
      echo "$BODY"
      exit 1
    fi
    
    if echo "$BODY" | jq empty 2>/dev/null; then
      echo "$BODY" | jq '.'
    else
      echo "$BODY"
    fi
    ;;
  
  *)
    echo "RSS Feed Processing Admin Script"
    echo ""
    echo "Usage:"
    echo "  ./scripts/feed-admin.sh check           # List active feeds"
    echo "  ./scripts/feed-admin.sh cancel <feedId> # Cancel specific feed"
    echo "  ./scripts/feed-admin.sh cancel-all      # Cancel all active feeds"
    echo ""
    echo "Required Environment Variables:"
    echo "  API_BASE   - API base URL (required)"
    echo "               Development: http://localhost:3000"
    echo "               Production:  https://your-app.vercel.app"
    echo "  AUTH_TOKEN - Your Supabase auth token (required)"
    echo "               Get from: DevTools → Application → Local Storage"
    echo ""
    echo "Example:"
    echo "  export API_BASE='http://localhost:3000'"
    echo "  export AUTH_TOKEN='eyJ...'"
    echo "  ./scripts/feed-admin.sh check"
    exit 1
    ;;
esac

