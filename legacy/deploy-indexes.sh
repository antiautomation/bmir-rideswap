#!/bin/bash

echo "🚀 Deploying Firestore indexes..."

# Deploy indexes
firebase deploy --only firestore:indexes

echo "✅ Indexes deployed successfully!"
echo "⏳ Indexes will be built in the background (usually takes 1-5 minutes)"
echo "📊 Check status at: https://console.firebase.google.com/project/bmir-rideshare/firestore/indexes" 