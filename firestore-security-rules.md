# Production-Ready Firestore Security Rules for BMIR Rideshare App

## PRODUCTION RULES (SECURE):
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Main rideshare data (drivers, riders, flags)
    match /artifacts/bmir-rideshare/public/data/{collection}/{document} {
      // Allow read access to everyone (needed for the app to work)
      allow read: if true;
      
      // Allow create with strict validation
      allow create: if 
        // Must be authenticated
        request.auth != null &&
        // Must include required fields
        request.resource.data.keys().hasAll(['authorId', 'timestamp', 'name', 'direction']) &&
        // Author ID must match authenticated user
        request.resource.data.authorId == request.auth.uid &&
        // Timestamp must be recent (within last hour)
        request.resource.data.timestamp is timestamp &&
        request.resource.data.timestamp < timestamp.date(2025, 12, 31) &&
        request.resource.data.timestamp > timestamp.date(2024, 1, 1) &&
        // Data validation
        request.resource.data.name is string &&
        request.resource.data.name.size() > 0 &&
        request.resource.data.name.size() <= 100 &&
        request.resource.data.direction in ['to-brc', 'from-brc'] &&
        // Rate limiting: max 10 entries per user per hour
        getCountFromTime('users', request.auth.uid, duration.value(1, 'h')) < 10;
      
      // Allow updates only by the author with validation
      allow update: if 
        request.auth != null &&
        resource.data.authorId == request.auth.uid &&
        request.resource.data.authorId == request.auth.uid &&
        // Prevent changing authorId
        request.resource.data.authorId == resource.data.authorId &&
        // Data validation
        request.resource.data.name is string &&
        request.resource.data.name.size() > 0 &&
        request.resource.data.name.size() <= 100;
      
      // Allow deletion only by the author
      allow delete: if 
        request.auth != null &&
        resource.data.authorId == request.auth.uid;
    }
    
    // Session tracking (more permissive but with rate limiting)
    match /artifacts/bmir-rideshare/public/data/sessions/{document} {
      allow read: if true;
      allow create: if 
        request.auth != null &&
        request.resource.data.keys().hasAll(['sessionId', 'userId', 'timestamp']) &&
        request.resource.data.userId == request.auth.uid &&
        // Rate limiting: max 5 sessions per user per hour
        getCountFromTime('sessions', request.auth.uid, duration.value(1, 'h')) < 5;
      allow update: if 
        request.auth != null &&
        resource.data.userId == request.auth.uid;
      allow delete: if 
        request.auth != null &&
        resource.data.userId == request.auth.uid;
    }
    
    // Stats (read-only for most users, limited writes)
    match /artifacts/bmir-rideshare/public/data/stats/{document} {
      allow read: if true;
      allow write: if 
        request.auth != null &&
        // Only allow specific operations
        (request.resource.data.keys().hasAll(['totalVisitors', 'lastUpdated']) ||
         request.resource.data.keys().hasAll(['lastUpdated'])) &&
        // Rate limiting: max 10 updates per user per hour
        getCountFromTime('stats', request.auth.uid, duration.value(1, 'h')) < 10;
    }
    
    // User visits tracking (for unique visitor counting)
    match /artifacts/bmir-rideshare/public/data/userVisits/{document} {
      allow read: if true;
      allow create: if 
        request.auth != null &&
        request.resource.data.keys().hasAll(['userId', 'firstVisit', 'lastVisit']) &&
        request.resource.data.userId == request.auth.uid;
      allow update: if 
        request.auth != null &&
        resource.data.userId == request.auth.uid;
    }
  }
}
```

## Additional Production Security Measures:

### 1. Enable Firebase App Check
Add this to your HTML to prevent automated attacks:
```html
<script src="https://www.gstatic.com/firebasejs/11.6.1/firebase-app-check.js"></script>
<script>
  const appCheck = initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider('your-recaptcha-site-key'),
    isTokenAutoRefreshEnabled: true
  });
</script>
```

### 2. Content Security Policy
Add this meta tag to your HTML:
```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self' https://www.gstatic.com https://firestore.googleapis.com https://identitytoolkit.googleapis.com; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://www.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' https://bmir.org data:;">
```

### 3. Environment Variables
Store sensitive config in environment variables:
```javascript
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  // ... etc
};
```

### 4. Error Handling
Implement proper error handling and logging.

### 5. Monitoring
Set up Firebase usage alerts and monitoring.

## Implementation Checklist:
- [ ] Update Firestore rules with production rules above
- [ ] Add App Check with reCAPTCHA
- [ ] Add Content Security Policy
- [ ] Test all functionality with new rules
- [ ] Set up monitoring and alerts
- [ ] Document deployment process 