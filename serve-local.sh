#!/bin/bash

echo "🚀 Starting local development server..."
echo "📱 Your app will be available at: http://localhost:8000"
echo "🔧 This will fix the service worker and manifest issues"
echo ""

# Check if Python 3 is available
if command -v python3 &> /dev/null; then
    echo "✅ Using Python 3 HTTP server"
    python3 -m http.server 8000
elif command -v python &> /dev/null; then
    echo "✅ Using Python HTTP server"
    python -m SimpleHTTPServer 8000
else
    echo "❌ Python not found. Please install Python or use another local server."
    echo "Alternative: Use VS Code's Live Server extension"
    exit 1
fi 