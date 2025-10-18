#!/bin/bash
# Fix browser lock issue (run this if you get "ProcessSingleton" error)

echo "🔧 Fixing browser lock..."

# Kill any running instances
pkill -9 -f "electron.*brainbrief" 2>/dev/null
pkill -9 -f "Chromium.*brainbrief" 2>/dev/null

# Remove stale lock file
rm -f browser-data/SingletonLock 2>/dev/null

echo "✅ Lock removed! You can now run: npm run sync"

