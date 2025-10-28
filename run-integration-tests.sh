#!/bin/bash

# Integration test runner script
# This script starts the dev server and runs integration tests against it

echo "🚀 Starting Integration Tests"
echo "=============================="

# Check if server is already running
if curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo "✅ Dev server already running at http://localhost:5173"
    SERVER_ALREADY_RUNNING=true
else
    echo "🔄 Starting dev server..."
    npm run dev &
    SERVER_PID=$!
    SERVER_ALREADY_RUNNING=false
    
    # Wait for server to start
    echo "⏳ Waiting for server to be ready..."
    for i in {1..30}; do
        if curl -s http://localhost:5173 > /dev/null 2>&1; then
            echo "✅ Server is ready!"
            break
        fi
        if [ $i -eq 30 ]; then
            echo "❌ Server failed to start after 30 seconds"
            kill $SERVER_PID 2>/dev/null
            exit 1
        fi
        sleep 1
        echo "   Attempt $i/30..."
    done
fi

echo ""
echo "🧪 Running integration tests..."
echo "================================"

# Run the tests
TEST_SERVER_URL=http://localhost:5173 npm run test:run -- search-clinical-trials.test.ts

TEST_EXIT_CODE=$?

# Cleanup: stop server if we started it
if [ "$SERVER_ALREADY_RUNNING" = false ]; then
    echo ""
    echo "🛑 Stopping dev server..."
    kill $SERVER_PID 2>/dev/null
fi

echo ""
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "✅ Integration tests passed!"
else
    echo "❌ Integration tests failed!"
fi

exit $TEST_EXIT_CODE

