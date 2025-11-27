#!/bin/bash

echo "🛑 Killing Vercel/Node processes..."

# Kill Vercel dev
pkill -f "vercel dev"

# Kill vite
pkill -f "vite --port"

# Kill esbuild
pkill -f "esbuild"

# Kill any tsx processes
pkill -f "tsx"

# Wait a moment for processes to die
sleep 2

echo "✅ Processes killed"
echo ""
echo "🚀 Starting fresh Vercel dev..."

# Start Vercel dev
cd /Users/sofieyang/abcresearch-project
npm exec vercel dev

