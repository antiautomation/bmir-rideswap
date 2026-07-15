# 🚀 FCM Testing Guide - BMIR RideSwap

## Overview

This guide provides step-by-step instructions for testing the Firebase Cloud Messaging (FCM) feature in an isolated environment before rolling out to production. This approach ensures your live database remains unaffected while thoroughly testing all FCM functionality.

## 📋 Prerequisites

- Firebase CLI installed: `npm install -g firebase-tools`
- Access to Firebase Console
- Your current live project configuration
- Git repository access

## 🎯 Testing Strategy

### Option 1: Firebase Project Duplication (Recommended)

This approach creates a completely isolated testing environment with:
- ✅ Separate Firebase project
- ✅ Independent database
- ✅ Isolated FCM configuration
- ✅ Same API credentials (reCAPTCHA, Analytics)
- ✅ Zero risk to live data

---

## 📁 File Structure

```
bmir-rideswap/
├── config.js                    # Live configuration (current)
├── config-test.js.example       # Test config template
├── config-test.js              # Test configuration (create this)
├── setup-test-env.sh           # Switch to test environment
├── restore-live-env.sh         # Switch back to live environment
├── firebase.json               # Live Firebase config
├── firebase-test.json          # Test Firebase config
├── FCM_TESTING_GUIDE.md        # This file
└── firestore-rules-fcm-addition.txt  # Additional FCM rules
```

---

## 🚀 Phase 1: Environment Setup

### Step 1: Create Test Firebase Project

1. **Go to Firebase Console**
   - Visit [https://console.firebase.google.com/](https://console.firebase.google.com/)
   - Click "Add project"

2. **Create New Project**
   - Project name: `bmir-rideswap-test` (or your preferred name)
   - Enable Google Analytics: ✅ Yes (recommended for testing)
   - Analytics account: Create new or use existing
   - Click "Create project"

3. **Project Setup**
   - Choose analytics location (same as live project)
   - Click "Continue"
   - Wait for project creation to complete

### Step 2: Configure FCM in Test Project

1. **Enable Cloud Messaging**
   - In test project, go to Project Settings
   - Click "Cloud Messaging" tab
   - Click "Generate key pair" under "Web Push certificates"
   - Copy the generated VAPID key

2. **Get Project Configuration**
   - Go to Project Settings → General
   - Scroll to "Your apps" section
   - Click the web app icon (</>)
   - Copy the Firebase configuration object

### Step 3: Set Up Test Configuration

1. **Create Test Config File**
   ```bash
   cp config-test.js.example config-test.js
   ```

2. **Edit Test Configuration**
   ```bash
   # Edit config-test.js with your test project settings
   nano config-test.js
   ```

3. **Update Configuration Values**
   ```javascript
   // Replace these values with your test project settings
   const FIREBASE_CONFIG = {
       apiKey: "your-test-api-key",
       authDomain: "your-test-project-id.firebaseapp.com",
       projectId: "your-test-project-id",
       storageBucket: "your-test-project-id.appspot.com",
       messagingSenderId: "your-test-sender-id",
       appId: "your-test-app-id",
       measurementId: "your-test-measurement-id"
   };

   const APP_CONFIG = {
       appId: "your-test-project-id",
       projectId: "your-test-project-id",
       collectionPath: "artifacts/your-test-project-id/public/data"
   };

   const FCM_CONFIG = {
       vapidKey: "your-test-vapid-key",
       fcmServerKey: "your-test-server-key" // Optional
   };
   ```

### Step 4: Update Test Manifest

1. **Edit manifest.json**
   ```bash
   nano manifest.json
   ```

2. **Update Sender ID**
   ```json
   {
     "gcm_sender_id": "YOUR_TEST_SENDER_ID"
   }
   ```

---

## 📊 Phase 2: Data Migration (Optional)

### Step 1: Export Live Data

```bash
# Export data from live project
firebase firestore:export --project=your-live-project-id ./backup-data

# Verify export completed
ls -la ./backup-data/
```

### Step 2: Import to Test Project

```bash
# Import data to test project
firebase firestore:import --project=your-test-project-id ./backup-data

# Verify import completed
firebase firestore:indexes --project=your-test-project-id
```

### Step 3: Deploy Indexes to Test Project

```bash
# Switch to test project
firebase use your-test-project-id

# Deploy indexes
firebase deploy --only firestore:indexes
```

---

## 🚀 Phase 3: Deploy Test Environment

### Step 1: Switch to Test Environment

```bash
# Run the setup script
./setup-test-env.sh
```

**Expected Output:**
```
🚀 BMIR RideSwap Test Environment Setup
======================================
✅ Backed up current config.js to config.js.backup
✅ Switched to test configuration
📝 Updating manifest.json with test sender ID...
Please manually update the 'gcm_sender_id' in manifest.json with your test project's sender ID
🚀 Deploying to test project...
Make sure you're logged into the correct Firebase project:
🧪 Test Environment Ready!
Your app is now configured to use the test Firebase project.
All FCM testing will be isolated from your live database.
```

### Step 2: Deploy to Test Project

```bash
# Switch Firebase project
firebase use your-test-project-id

# Deploy all resources
firebase deploy
```

**Expected Output:**
```
✔  Deploy complete!

Project Console: https://console.firebase.google.com/project/your-test-project-id/overview
Hosting URL: https://your-test-project-id.web.app
```

### Step 3: Verify Deployment

1. **Check Hosting URL**
   - Visit your test site: `https://your-test-project-id.web.app`
   - Verify the app loads correctly

2. **Check Firebase Console**
   - Go to test project console
   - Verify Firestore database is created
   - Check Authentication is enabled

---

## 🧪 Phase 4: FCM Testing

### Test 1: Basic FCM Setup

1. **Open Test Site**
   - Navigate to your test deployment URL
   - Open browser developer tools (F12)

2. **Check FCM Initialization**
   ```javascript
   // In browser console, check:
   console.log('FCM Config:', window.FCM_CONFIG);
   console.log('Firebase Config:', window.FIREBASE_CONFIG);
   ```

3. **Verify Service Worker**
   - Check Application tab → Service Workers
   - Verify `sw.js` is registered
   - Check for any errors

### Test 2: Notification Permissions

1. **Request Permission**
   - Create a test listing
   - Try to message another user
   - Browser should prompt for notification permission

2. **Grant Permission**
   - Click "Allow" when prompted
   - Verify permission is granted

3. **Check Permission Status**
   ```javascript
   // In browser console:
   Notification.permission
   // Should return "granted"
   ```

### Test 3: Push Notifications

1. **Test Foreground Notifications**
   - Keep app open in foreground
   - Send a message from another browser/device
   - Verify notification appears

2. **Test Background Notifications**
   - Minimize browser or switch tabs
   - Send a message from another device
   - Verify notification appears in system tray

3. **Test Notification Click**
   - Click on a notification
   - Verify it opens the correct conversation
   - Verify app focuses correctly

### Test 4: Multi-Device Testing

1. **Setup Multiple Devices**
   - Open test site on desktop
   - Open test site on mobile
   - Use different browsers if needed

2. **Test Cross-Device Messaging**
   - Create listing on device A
   - Message from device B
   - Verify notifications on device A

3. **Test Notification Synchronization**
   - Send message from device A
   - Check notification on device B
   - Verify conversation updates on both devices

### Test 5: Error Handling

1. **Test Permission Denied**
   - Deny notification permission
   - Verify app still works without notifications
   - Check for graceful degradation

2. **Test Network Issues**
   - Disconnect internet
   - Try to send message
   - Reconnect and verify sync

3. **Test Invalid Tokens**
   - Simulate token refresh issues
   - Verify app handles gracefully

---

## 📋 Testing Checklist

### ✅ Environment Setup
- [ ] Test Firebase project created
- [ ] FCM VAPID key generated
- [ ] Test configuration file created
- [ ] Manifest.json updated with test sender ID
- [ ] Live data exported (if needed)
- [ ] Test data imported (if needed)
- [ ] Indexes deployed to test project

### ✅ Deployment
- [ ] Test environment script executed
- [ ] Firebase project switched to test
- [ ] All resources deployed successfully
- [ ] Test site accessible and functional
- [ ] No console errors on page load

### ✅ FCM Functionality
- [ ] Notification permission request works
- [ ] Permission granted successfully
- [ ] Foreground notifications received
- [ ] Background notifications received
- [ ] Notification clicks open correct conversation
- [ ] Multiple devices receive notifications
- [ ] Cross-device messaging works
- [ ] Notification settings persist

### ✅ Error Handling
- [ ] App works without notification permission
- [ ] Network disconnection handled gracefully
- [ ] Invalid tokens handled properly
- [ ] No memory leaks detected
- [ ] Performance remains acceptable

### ✅ Data Isolation
- [ ] Test environment doesn't affect live data
- [ ] Live environment doesn't affect test data
- [ ] User authentication works in both environments
- [ ] Messaging works independently
- [ ] No data leakage between environments

---

## 🔧 Troubleshooting

### Common Issues

#### Issue: "Firebase not initialized"
**Solution:**
- Check `config-test.js` has correct Firebase config
- Verify `manifest.json` has correct sender ID
- Clear browser cache and reload

#### Issue: "Permission denied"
**Solution:**
- Check browser notification settings
- Reset permissions in browser settings
- Test in incognito mode

#### Issue: "No notifications received"
**Solution:**
- Verify VAPID key is correct
- Check service worker is registered
- Verify FCM token is generated
- Check browser console for errors

#### Issue: "Deployment failed"
**Solution:**
- Verify Firebase CLI is logged in
- Check project ID is correct
- Ensure you have deployment permissions
- Check for syntax errors in configuration

### Debug Commands

```bash
# Check Firebase project status
firebase projects:list

# Check current project
firebase use

# View deployment logs
firebase hosting:channel:list

# Test security rules
firebase firestore:rules:test

# Check indexes
firebase firestore:indexes
```

---

## 🔄 Phase 5: Restore Live Environment

### Step 1: Switch Back to Live

```bash
# Run the restore script
./restore-live-env.sh
```

**Expected Output:**
```
🔄 Restoring Live Environment
============================
✅ Restored live configuration
📝 Updating manifest.json with live sender ID...
Please manually update the 'gcm_sender_id' in manifest.json with your live project's sender ID
🚀 Switching to live project...
✅ Live Environment Restored!
Your app is now configured to use the live Firebase project.
```

### Step 2: Update Live Manifest

1. **Edit manifest.json**
   ```bash
   nano manifest.json
   ```

2. **Restore Live Sender ID**
   ```json
   {
     "gcm_sender_id": "YOUR_LIVE_SENDER_ID"
   }
   ```

### Step 3: Deploy to Live

```bash
# Switch to live project
firebase use your-live-project-id

# Deploy to production
firebase deploy
```

---

## 📊 Performance Monitoring

### Metrics to Track

1. **FCM Performance**
   - Notification delivery rate
   - Token refresh frequency
   - Background notification success rate

2. **App Performance**
   - Page load times
   - Memory usage
   - Battery impact

3. **User Engagement**
   - Notification permission rate
   - Message response rates
   - User retention

### Monitoring Tools

1. **Firebase Console**
   - Cloud Messaging dashboard
   - Analytics events
   - Crash reporting

2. **Browser DevTools**
   - Performance tab
   - Memory tab
   - Network tab

3. **User Feedback**
   - Monitor user reports
   - Track support tickets
   - Gather user surveys

---

## 💰 Cost Management

### Firebase Costs

1. **Free Tier Limits**
   - FCM: 1M messages/month (web apps)
   - Firestore: 1GB storage, 50K reads/day, 20K writes/day
   - Hosting: 10GB storage, 360MB/day transfer

2. **Monitoring Usage**
   - Check Firebase Console → Usage and billing
   - Set up billing alerts
   - Monitor daily usage patterns

3. **Cost Optimization**
   - Clean up test data regularly
   - Use efficient queries
   - Implement proper indexing

---

## 🔒 Security Considerations

### FCM Security

1. **VAPID Key Management**
   - Keep VAPID keys secure
   - Rotate keys periodically
   - Use different keys for test/live

2. **Token Security**
   - Validate FCM tokens
   - Implement token refresh
   - Monitor for suspicious activity

3. **Data Privacy**
   - Follow GDPR guidelines
   - Implement proper consent
   - Provide opt-out mechanisms

---

## 📝 Rollout Plan

### Pre-Rollout Checklist

- [ ] All tests pass in test environment
- [ ] Performance benchmarks met
- [ ] Security review completed
- [ ] Documentation updated
- [ ] Support team trained
- [ ] Rollback plan prepared

### Rollout Steps

1. **Announcement**
   - Notify users of upcoming changes
   - Provide opt-out instructions
   - Share new features

2. **Gradual Rollout**
   - Deploy to 10% of users first
   - Monitor for issues
   - Gradually increase to 100%

3. **Monitoring**
   - Watch error rates
   - Monitor user feedback
   - Track performance metrics

4. **Full Rollout**
   - Deploy to all users
   - Monitor closely for 24-48 hours
   - Address any issues quickly

---

## 🆘 Support Resources

### Documentation
- [Firebase FCM Documentation](https://firebase.google.com/docs/cloud-messaging)
- [Web Push Protocol](https://tools.ietf.org/html/rfc8030)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)

### Community
- [Firebase Community](https://firebase.google.com/community)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/firebase-cloud-messaging)
- [GitHub Issues](https://github.com/firebase/firebase-js-sdk/issues)

### Emergency Contacts
- Firebase Support: [https://firebase.google.com/support](https://firebase.google.com/support)
- Project Maintainer: [Your Contact Info]

---

## 📄 Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | [Current Date] | Initial FCM testing guide |

---

**Last Updated:** [Current Date]  
**Next Review:** [Date + 30 days]  
**Maintainer:** [Your Name]
