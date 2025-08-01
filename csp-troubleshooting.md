# Content Security Policy (CSP) Troubleshooting Guide

## 🔧 Fixed Issues

### ✅ Google Analytics Script Blocking
**Problem:** `Refused to load the script 'https://www.googletagmanager.com/gtag/js?id=G-NXHN9M6GQX'`

**Solution:** Added `https://www.googletagmanager.com` to the CSP `script-src` directive

## 📋 Current CSP Configuration

```html
<meta http-equiv="Content-Security-Policy" content="
  script-src 'self' 'unsafe-inline' 
    https://www.gstatic.com 
    https://www.google.com 
    https://www.gstatic.com/recaptcha/ 
    https://www.googletagmanager.com;
  style-src 'self' 'unsafe-inline' 
    https://fonts.googleapis.com;
  font-src 
    https://fonts.gstatic.com;
  img-src 'self' 
    https://bmir.org 
    data:;
  frame-src 'self' 
    https://www.google.com 
    https://www.gstatic.com;
  connect-src 'self' 
    https://www.gstatic.com 
    https://firestore.googleapis.com 
    https://identitytoolkit.googleapis.com 
    https://content-firebaseappcheck.googleapis.com 
    https://securetoken.googleapis.com 
    https://www.google.com 
    https://www.gstatic.com/recaptcha/ 
    https://www.google.com/recaptcha/ 
    https://www.googletagmanager.com;
">
```

## 🚨 Common CSP Errors & Solutions

### 1. Script Loading Errors
**Error:** `Refused to load the script '...' because it violates the following Content Security Policy directive`

**Solutions:**
- Add the domain to `script-src` directive
- Check if the script is from an allowed domain
- Verify the script URL is correct

### 2. Style Loading Errors
**Error:** `Refused to load the stylesheet '...' because it violates the following Content Security Policy directive`

**Solutions:**
- Add the domain to `style-src` directive
- Include `'unsafe-inline'` for inline styles
- Add `https://fonts.googleapis.com` for Google Fonts

### 3. Font Loading Errors
**Error:** `Refused to load the font '...' because it violates the following Content Security Policy directive`

**Solutions:**
- Add the domain to `font-src` directive
- Include `https://fonts.gstatic.com` for Google Fonts

### 4. Image Loading Errors
**Error:** `Refused to load the image '...' because it violates the following Content Security Policy directive`

**Solutions:**
- Add the domain to `img-src` directive
- Include `data:` for data URLs
- Add `https://bmir.org` for external images

### 5. Network Request Errors
**Error:** `Refused to connect to '...' because it violates the following Content Security Policy directive`

**Solutions:**
- Add the domain to `connect-src` directive
- Include Firebase domains for API calls
- Add Google Analytics domains

## 🔍 Debugging CSP Issues

### 1. Check Browser Console
- Open Developer Tools (F12)
- Look for CSP violation messages
- Note the specific directive that's failing

### 2. Use CSP Evaluator
- Install "CSP Evaluator" Chrome extension
- Analyzes your CSP for potential issues
- Provides recommendations

### 3. Test CSP Online
- Use online CSP validators
- Check for syntax errors
- Verify directive combinations

## 📊 Allowed Domains

### Script Sources (`script-src`)
- ✅ `'self'` - Same origin
- ✅ `'unsafe-inline'` - Inline scripts
- ✅ `https://www.gstatic.com` - Firebase
- ✅ `https://www.google.com` - Google services
- ✅ `https://www.gstatic.com/recaptcha/` - reCAPTCHA
- ✅ `https://www.googletagmanager.com` - Google Analytics

### Style Sources (`style-src`)
- ✅ `'self'` - Same origin
- ✅ `'unsafe-inline'` - Inline styles
- ✅ `https://fonts.googleapis.com` - Google Fonts

### Font Sources (`font-src`)
- ✅ `https://fonts.gstatic.com` - Google Fonts

### Image Sources (`img-src`)
- ✅ `'self'` - Same origin
- ✅ `https://bmir.org` - BMIR images
- ✅ `data:` - Data URLs

### Connect Sources (`connect-src`)
- ✅ `'self'` - Same origin
- ✅ `https://www.gstatic.com` - Firebase
- ✅ `https://firestore.googleapis.com` - Firestore
- ✅ `https://identitytoolkit.googleapis.com` - Auth
- ✅ `https://content-firebaseappcheck.googleapis.com` - App Check
- ✅ `https://securetoken.googleapis.com` - Auth tokens
- ✅ `https://www.google.com` - Google services
- ✅ `https://www.gstatic.com/recaptcha/` - reCAPTCHA
- ✅ `https://www.google.com/recaptcha/` - reCAPTCHA
- ✅ `https://www.googletagmanager.com` - Google Analytics
- ✅ `https://*.google-analytics.com` - Google Analytics data collection
- ✅ `https://analytics.google.com` - Google Analytics

## 🛠️ Adding New Services

### For New Scripts
1. Identify the domain (e.g., `https://cdn.example.com`)
2. Add to `script-src` directive
3. Test in browser console

### For New APIs
1. Identify the domain (e.g., `https://api.example.com`)
2. Add to `connect-src` directive
3. Test API calls

### For New Styles/Fonts
1. Identify the domain
2. Add to `style-src` or `font-src` directive
3. Test loading

## ✅ Testing Checklist

- [ ] Google Analytics loads without errors
- [ ] Firebase services work properly
- [ ] Google Fonts load correctly
- [ ] reCAPTCHA functions normally
- [ ] No CSP violations in console
- [ ] All external resources load
- [ ] Inline scripts/styles work

## 🚨 Emergency CSP Disable

If CSP is causing critical issues, temporarily disable it:

```html
<!-- Comment out the CSP meta tag -->
<!-- <meta http-equiv="Content-Security-Policy" content="..."> -->
```

**⚠️ Warning:** Only use this for debugging, not in production! 