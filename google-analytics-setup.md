# Google Analytics Setup Guide

## 📊 Current Configuration

**Tracking ID:** `G-NXHN9M6GQX`  
**Property Type:** GA4 (Google Analytics 4)  
**Domain:** `https://rideswap.auerbach.io`

## 🔧 Setup Steps

### 1. Verify GA4 Property Configuration

1. **Go to Google Analytics Console:**
   - Visit: https://analytics.google.com/
   - Sign in with your Google account

2. **Check Property Settings:**
   - Select your property (should show `G-NXHN9M6GQX`)
   - Go to **Admin** → **Property Settings**
   - Verify the tracking ID matches: `G-NXHN9M6GQX`

3. **Check Data Streams:**
   - Go to **Admin** → **Data Streams**
   - Look for your website stream
   - Verify the URL is: `https://rideswap.auerbach.io`

### 2. Configure Domain Settings

1. **Add Authorized Domains:**
   - Go to **Admin** → **Data Streams** → **Web Stream**
   - Click **Configure** → **Authorized Domains**
   - Add: `rideswap.auerbach.io`

2. **Check Measurement Protocol:**
   - Ensure "Enhanced measurement" is enabled
   - Enable "Page views", "Scrolls", "Outbound clicks"

### 3. Test Real-Time Data

1. **Open Real-Time Reports:**
   - Go to **Reports** → **Realtime** → **Overview**
   - This shows data immediately (no delay)

2. **Test Your Site:**
   - Visit your live site: https://rideswap.auerbach.io
   - Perform some actions (click buttons, navigate)
   - Check if you appear in real-time data

### 4. Custom Events Tracking

Your app now tracks these custom events:

- **`entry_saved`** - When users save a ride listing
- **`modal_opened`** - When users open the add/edit modal
- **`direction_changed`** - When users switch between "To/From" Burning Man

## 🚨 Troubleshooting

### Issue: "No data in reports"

**Solutions:**
1. **Check Real-Time First:** Real-time data appears immediately
2. **Wait 24-48 Hours:** Standard reports have processing delay
3. **Verify Domain:** Ensure you're testing on the correct domain
4. **Check Browser Console:** Look for GA errors

### Issue: "Analytics disabled for local development"

**Solutions:**
1. **Test on Live Site:** Visit https://rideswap.auerbach.io
2. **Use Local Server:** Run `./serve-local.sh` for testing
3. **Check Console:** Should show "Analytics enabled for local development"

### Issue: "API key not valid"

**Solutions:**
1. **Verify Tracking ID:** Ensure `G-NXHN9M6GQX` is correct
2. **Check Property:** Make sure you're in the right GA4 property
3. **Domain Authorization:** Add your domain to authorized domains

## 📈 What to Look For

### Real-Time Data (Immediate)
- **Active Users:** Should show 1+ when you visit
- **Events:** Should show custom events being fired
- **Page Views:** Should show your page being viewed

### Standard Reports (24-48 hour delay)
- **Users:** Total unique visitors
- **Sessions:** Total visits to your site
- **Page Views:** Total page loads
- **Events:** Custom events like `entry_saved`

## 🔍 Debugging Steps

1. **Open Browser Console:**
   - Press F12 → Console tab
   - Look for GA-related messages

2. **Check Network Tab:**
   - Press F12 → Network tab
   - Filter by "google" or "gtag"
   - Should see requests to Google Analytics

3. **Use Google Analytics Debugger:**
   - Install Chrome extension: "Google Analytics Debugger"
   - Shows detailed GA information

## 📱 Testing Checklist

- [ ] Visit live site: https://rideswap.auerbach.io
- [ ] Check browser console for GA messages
- [ ] Perform actions (click buttons, add entries)
- [ ] Check real-time reports in GA4
- [ ] Verify custom events are firing
- [ ] Wait 24-48 hours for standard reports

## 🎯 Expected Results

**Immediate (Real-Time):**
- ✅ Active users showing in GA4
- ✅ Custom events appearing
- ✅ Page views being tracked

**Within 24-48 Hours:**
- ✅ Standard reports populated
- ✅ User metrics available
- ✅ Event data in reports

## 📞 Need Help?

If issues persist:
1. Check browser console for errors
2. Verify tracking ID is correct
3. Test on live domain (not localhost)
4. Contact Google Analytics support 