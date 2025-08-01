# reCAPTCHA & App Check Troubleshooting Guide

## 🚨 Current Issue

**Error:** `FirebaseError: AppCheck: ReCAPTCHA error. (appCheck/recaptcha-error)`

**Status:** ✅ **FIXED** - App Check now waits for reCAPTCHA to be ready before initializing.

## 🔍 Diagnostic Steps

### 1. Check reCAPTCHA Console Configuration

1. **Visit reCAPTCHA Admin Console:**
   - Go to: https://www.google.com/recaptcha/admin
   - Sign in with your Google account

2. **Verify Site Key:**
   - Find site key: `6Lf3vZMrAAAAAPxqjxRRc9RyAV8smuu1UIMOv4Y5`
   - Check that it's a **reCAPTCHA v3** key (not v2)

3. **Check Authorized Domains:**
   - Add: `rideswap.auerbach.io`
   - Add: `localhost` (for testing)
   - Add: `127.0.0.1` (for testing)

### 2. Test reCAPTCHA Manually

Open browser console and run:
```javascript
grecaptcha.ready(function() {
    grecaptcha.execute('6Lf3vZMrAAAAAPxqjxRRc9RyAV8smuu1UIMOv4Y5', {action: 'submit'})
    .then(function(token) {
        console.log('✅ reCAPTCHA token:', token);
    })
    .catch(function(error) {
        console.error('❌ reCAPTCHA error:', error);
    });
});
```

### 3. Check Network Requests

1. **Open Developer Tools** (F12)
2. **Go to Network tab**
3. **Filter by "recaptcha"**
4. **Look for failed requests** to `google.com/recaptcha`

## 🛠️ Common Solutions

### Solution 1: Domain Configuration
```javascript
// Ensure domain is exactly correct
// Should be: rideswap.auerbach.io (not rideshare.auerbach.io)
```

### Solution 2: Site Key Verification
```javascript
// Verify the site key is correct
// Current: 6Lf3vZMrAAAAAPxqjxRRc9RyAV8smuu1UIMOv4Y5
```

### Solution 3: reCAPTCHA Script Loading
```html
<!-- Make sure this script loads before App Check -->
<script src="https://www.google.com/recaptcha/api.js?render=YOUR_SITE_KEY"></script>
```

## 📊 Current Configuration

| **Component** | **Status** | **Details** |
|---------------|------------|-------------|
| **App Check** | ✅ Initializes | Firebase App Check loads |
| **reCAPTCHA Script** | ✅ Loaded | Script included in HTML |
| **Site Key** | ✅ Working | `6Lf3vZMrAAAAAPxqjxRRc9RyAV8smuu1UIMOv4Y5` |
| **Domain** | ✅ Authorized | `rideswap.auerbach.io` |
| **Token Generation** | ✅ Working | Auth requests now succeed |

## 🔧 Debugging Steps

### Step 1: Check reCAPTCHA Console
1. Visit: https://www.google.com/recaptcha/admin
2. Find your site key
3. Check domain configuration
4. Verify it's reCAPTCHA v3

### Step 2: Test Token Generation
```javascript
// Run this in browser console
if (typeof grecaptcha !== 'undefined') {
    grecaptcha.ready(function() {
        grecaptcha.execute('6Lf3vZMrAAAAAPxqjxRRc9RyAV8smuu1UIMOv4Y5', {action: 'submit'})
        .then(function(token) {
            console.log('✅ Token:', token.substring(0, 20) + '...');
        })
        .catch(function(error) {
            console.error('❌ Error:', error);
        });
    });
} else {
    console.error('❌ reCAPTCHA not loaded');
}
```

### Step 3: Check Network Tab
1. Open Developer Tools → Network
2. Filter by "recaptcha"
3. Look for failed requests
4. Check response status codes

### Step 4: Verify Domain Match
```javascript
// Check current domain
console.log('Current domain:', window.location.hostname);
// Should be: rideswap.auerbach.io
```

## 🚀 Alternative Solutions

### Option 1: Use Different Site Key
1. Create new reCAPTCHA v3 site key
2. Update the code with new key
3. Test immediately

### Option 2: Disable App Check Temporarily
```javascript
// Comment out App Check initialization
// const appCheck = initializeAppCheck(firebaseApp, {
//     provider: new ReCaptchaV3Provider('YOUR_SITE_KEY'),
//     isTokenAutoRefreshEnabled: true
// });
```

### Option 3: Use Custom Token Provider
```javascript
// Alternative to reCAPTCHA
const appCheck = initializeAppCheck(firebaseApp, {
    provider: new CustomTokenProvider(),
    isTokenAutoRefreshEnabled: true
});
```

## 📋 Checklist

- [ ] reCAPTCHA site key is v3 (not v2)
- [ ] Domain `rideswap.auerbach.io` is authorized
- [ ] reCAPTCHA script loads without errors
- [ ] Token generation works in console
- [ ] No network errors in Developer Tools
- [ ] Firebase App Check is enabled in console
- [ ] Site key matches exactly

## 🎯 Expected Results

**Success:**
```
✅ App Check initialized successfully
✅ reCAPTCHA token generated successfully
✅ Firebase Auth works without errors
```

**Minor Issues (Fixed):**
```
manifest.json:1 Manifest: property 'start_url' ignored...
Unhandled promise rejection: null (manifest warnings)
```

**Failure:**
```
⚠️ reCAPTCHA token generation failed: [error]
❌ FirebaseError: AppCheck: ReCAPTCHA error
```

## 📞 Next Steps

1. **Check reCAPTCHA console** for domain configuration
2. **Test token generation** manually in console
3. **Verify site key** is correct and v3
4. **Check network requests** for errors
5. **Consider alternative** if issues persist

## 🔗 Useful Links

- **reCAPTCHA Admin:** https://www.google.com/recaptcha/admin
- **Firebase Console:** https://console.firebase.google.com/
- **reCAPTCHA Documentation:** https://developers.google.com/recaptcha/docs/v3 