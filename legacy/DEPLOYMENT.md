# BMIR Rideswap - Deployment Guide

## 🚀 Simple Deployment

### For Local Use (ChromeBook, etc.)
1. Run `./build.sh` to create the distribution
2. Open `distribution/index.html` in your web browser
3. That's it! No server needed.

### For Web Server
1. Run `./build.sh` to create the distribution
2. Upload all files from the `distribution/` folder to your web server root
3. Deploy Firestore rules using Firebase CLI:
   ```bash
   firebase deploy --only firestore:rules
   firebase deploy --only firestore:indexes
   ```

## 📁 What's Included

The `distribution/` folder contains everything needed:
- Complete web application
- All assets and resources
- Firebase configuration
- Server configuration files

## ⚙️ Configuration

Update `distribution/config.js` with your Firebase project settings before deployment.

## 🔧 Build Script

Just run `./build.sh` to create a fresh distribution whenever you make changes.
