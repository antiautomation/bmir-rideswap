#!/bin/bash

# Production Build Script
# Industry-standard approach for creating production builds

echo "🏗️  Building production version..."

# Create production directory
rm -rf dist/
mkdir -p dist/

# Copy production files
echo "📁 Copying production files..."
cp index.html dist/
cp app.js dist/
cp styles.css dist/
cp manifest.json dist/
cp sw.js dist/
cp top200_us_cities.csv dist/
cp firestore.rules dist/
cp firestore.indexes.json dist/
cp .htaccess dist/
cp LICENSE dist/

# Optional: Add Firebase messaging service worker if needed
if [ -f "firebase-messaging-sw.js" ]; then
    cp firebase-messaging-sw.js dist/
fi

# Optional: Add external config if needed
if [ -f "config.js" ]; then
    cp config.js dist/
fi

echo "✅ Production build complete!"
echo "📦 Files in dist/:"
ls -la dist/

echo ""
echo "🚀 Ready to deploy! Upload the contents of dist/ to your web server." 