#!/bin/bash

# Simple Build Script for BMIR Rideswap
# Creates a distribution that works both locally (file://) and on web servers

echo "🏗️  Building BMIR Rideswap distribution..."

# Clean up any existing distribution
rm -rf distribution/
mkdir -p distribution/

echo "📁 Copying files..."

# Copy all necessary files to root of distribution (flat structure)
cp index.html distribution/
cp app.js distribution/
cp styles.css distribution/
cp styles-modern.css distribution/
cp design-demo.html distribution/
cp manifest.json distribution/
cp sw.js distribution/
cp config.js distribution/
cp firestore.rules distribution/
cp firestore.indexes.json distribution/
cp .htaccess distribution/
cp LICENSE distribution/

# Copy images
cp logo.png distribution/

echo "✅ Distribution created successfully!"
echo ""
echo "📦 Distribution folder: distribution/"
echo ""
echo "🚀 Usage:"
echo "   - Local: Open distribution/index.html in your browser"
echo "   - Web Server: Upload contents of distribution/ to your web server root"
echo ""
echo "📋 Files included:"
ls -la distribution/
