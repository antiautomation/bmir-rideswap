# BMIR RideSwap Admin Interface - Local Development Setup

## Quick Start

1. **Configure Firebase** (Required)
   - Copy your Firebase project settings to `config.js`
   - Replace all `YOUR_*` placeholders with actual values

2. **Start Local Server**
   ```bash
   python3 serve-admin.py
   ```

3. **Access Admin Interface**
   - Open: http://localhost:8080/admin/
   - Main app: http://localhost:8080/

## Firebase Configuration

You need to update `config.js` with your actual Firebase project settings:

```javascript
const FIREBASE_CONFIG = {
    apiKey: "your-actual-api-key",
    authDomain: "your-project-id.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project-id.appspot.com",
    messagingSenderId: "your-sender-id",
    appId: "your-app-id",
    measurementId: "your-measurement-id"
};
```

### How to Get Firebase Config:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to Project Settings (gear icon)
4. Scroll down to "Your apps" section
5. Click on your web app or create a new one
6. Copy the config object

## Troubleshooting

### Common Issues:

1. **"Firebase not loaded" error**
   - Make sure `config.js` exists and has valid Firebase config
   - Check browser console for network errors

2. **CORS errors**
   - Always use the local server (`python3 serve-admin.py`)
   - Don't open HTML files directly in browser

3. **"Collection is not a function" error**
   - Firebase SDK not properly loaded
   - Check that all Firebase scripts are loading in browser network tab

4. **Port already in use**
   ```bash
   python3 serve-admin.py --port 8081
   ```

### Browser Console Debugging:

- Open Developer Tools (F12)
- Check Console tab for errors
- Check Network tab to ensure Firebase SDK loads
- Look for CORS errors in red

## File Structure

```
bmir-rideswap/
├── admin/
│   ├── index.html      # Admin interface
│   ├── admin.js        # Admin logic
│   ├── admin.css       # Admin styles
│   └── api/            # PHP API endpoints
├── config.js           # Firebase configuration
├── serve-admin.py      # Local development server
└── ADMIN-SETUP.md      # This file
```

## Security Notes

- `config.js` contains sensitive Firebase keys
- Never commit this file to version control
- Use `.gitignore` to exclude it
- For production, use environment variables

## Alternative Setup Methods

### Using Node.js (if you have it installed):
```bash
npx http-server --cors -p 8080
```

### Using PHP (if you have it installed):
```bash
php -S localhost:8080
```

## Next Steps

Once the admin interface is working:

1. Test all tabs (Posts, Events, Config, Private)
2. Verify Firebase connection
3. Test data loading and saving
4. Check that PHP API endpoints work (if needed)
