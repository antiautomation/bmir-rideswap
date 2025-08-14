# BMIR RideSwap

A real-time rideshare coordination platform for Burning Man participants, built with Firebase and modern web technologies. Features a dark theme, session management, soft deletes, and full PWA capabilities.

## 🚀 Live Demo

Visit the live application at: [BMIR RideSwap](https://rideswap.auerbach.io)

## 📋 Table of Contents

- [User Guide](#user-guide)
  - [Getting Started](#getting-started)
  - [How to Use](#how-to-use)
  - [Features](#features)
  - [Session Management](#session-management)
  - [Tips & Best Practices](#tips--best-practices)
- [Developer Guide](#developer-guide)
  - [Architecture Overview](#architecture-overview)
  - [Setup & Installation](#setup--installation)
  - [Configuration](#configuration)
  - [Development](#development)
  - [Deployment](#deployment)
  - [Performance Optimizations](#performance-optimizations)
  - [Security](#security)

---

## 👥 User Guide

### Getting Started

1. **Open the App**: Visit the BMIR RideSwap in your web browser
2. **Choose Direction**: Select "To Burning Man" or "From Burning Man"
3. **Browse Listings**: View available rides or people needing rides
4. **Contact Users**: Click on email or phone links to get in touch
5. **Save Your Session**: Screenshot your session code for cross-device access

### How to Use

#### 📝 Creating a Listing

1. **Click "Offer a Ride"** or **"Need a Ride"**
2. **Fill out the form**:
   - **Name**: Your name (required)
   - **Email/Phone**: At least one contact method (required)
   - **Location**: Your city or destination
   - **Date**: When you're traveling
   - **Time Slot**: Specific time or "Flexible Time"
   - **Details**: Additional information (pickup location, luggage, etc.)
3. **Click "Save"** to post your listing (button will show "Saving..." during submission)

#### 🔍 Finding Rides

- **Direction Toggle**: Switch between "To Burning Man" and "From Burning Man"
- **Day Filter**: Filter by specific days of the week
- **Location Filter**: Filter by city/location
- **Favorites**: Click the star (☆) to bookmark interesting listings
- **Show Favorites Only**: Toggle to see only your bookmarked listings
- **Mobile Filters**: Collapsible filter section on mobile devices

#### 🔑 Session Management

- **Session Code**: Automatically generated for new users
- **Cross-Device Access**: Use your session code to access listings from any device
- **Change Session**: Click "Change" button in header to enter a different session code
- **Screenshot Recommended**: Save your session code for future access

#### ⭐ Favorites System

- **Add to Favorites**: Click the star (☆) on any listing
- **Remove from Favorites**: Click the filled star (⭐) to remove
- **Filter by Favorites**: Use the "Show favorites only" checkbox
- **Local Storage**: Favorites are saved on your device

#### 🚩 Flagging System

- **Flag Inappropriate Content**: Click the flag (🚩) button
- **Hide Flagged Content**: Flagged listings are hidden from you
- **Community Moderation**: Multiple flags hide content from everyone

#### ✏️ Managing Your Listings

- **Edit**: Click the pencil (✏️) icon on your own listings
- **Delete**: Click the trash (🗑️) icon on your own listings (soft delete)
- **Restore**: God mode users can restore deleted entries with 🔄 button
- **Real-time Updates**: Changes appear immediately

#### 💬 Real-time Messaging

**Requirements to Message:**
- You must have created at least one listing (driver or rider)
- The recipient must have messaging enabled
- You must have messaging enabled

**Starting a Conversation:**
1. **Find a listing** you're interested in
2. **Click the message button (💬)** on the listing card
3. **Type your message** and click "Send"
4. **Auto-favorite**: The listing is automatically added to your favorites

**Managing Conversations:**
- **Access Messages**: Click "💬 Messages" in the header
- **View Conversations**: See all your active conversations
- **Real-time Updates**: Messages appear instantly
- **Status Indicators**: 
  - ✓ Sent (message delivered to server)
  - ✓✓ Delivered (recipient received the message)
  - ✓✓ Read (recipient opened the conversation)

**Privacy & Settings:**
- **Disable Messaging**: Uncheck "Allow others to message me" in Messages
- **Hide Message Button**: When disabled, others won't see the message button on your listings
- **Notification Settings**: Control push notifications in your browser settings

**Push Notifications:**
- **Permission Request**: App will ask for notification permission on first use
- **Background Notifications**: Receive alerts even when app is closed
- **Click to Open**: Click notification to open the conversation
- **Graceful Degradation**: Works without notifications if permission denied

### Features

#### 🎯 Core Features
- **Real-time Updates**: No page refresh needed
- **Anonymous Posting**: No account required
- **Contact Integration**: Click to email or call
- **Mobile Responsive**: Works on all devices
- **Offline Support**: Basic functionality when disconnected
- **Dark Theme**: Modern dark interface
- **PWA Support**: Install as app on mobile/desktop

#### 🔧 Advanced Features
- **Smart Expiration**: Listings automatically hide after 12 hours
- **Real-time Messaging**: Private conversations between users
- **Push Notifications**: Get notified of new messages
- **Auto-favorites**: Automatically favorite listings when messaging
- **Privacy Controls**: Disable messaging to prevent unwanted contact
- **Flexible Time Slots**: "Flexible Time" option for open schedules
- **City Autocomplete**: 500+ US cities with smart search
- **Rate Limiting**: Prevents spam (5 submissions per hour)
- **Soft Deletes**: Deleted entries can be restored by admins
- **God Mode**: Administrative features for moderators
- **Duplicate Prevention**: Prevents accidental multiple submissions

#### 📊 User Experience
- **Loading States**: Visual feedback during data loading
- **Error Handling**: Graceful failure recovery
- **Pagination**: Browse large lists efficiently
- **Search & Filter**: Multiple ways to find relevant listings
- **Collapsible Filters**: Space-saving mobile interface
- **Session Persistence**: Access your listings from any device

#### 🎨 Design Features
- **Dark Theme**: Modern dark interface throughout
- **BMIR Branding**: Custom header with logo and taglines
- **Responsive Design**: Optimized for all screen sizes
- **Smooth Animations**: Enhanced user experience
- **Accessibility**: Screen reader friendly

### Session Management

#### 🔑 Session Code System

- **Automatic Generation**: New users get a unique 8-character session code
- **Cross-Device Access**: Use your session code on any device
- **No Registration**: No account creation required
- **Secure**: Session codes are unique and private

#### 📱 How to Use Sessions

1. **New User**: Session code appears automatically
2. **Screenshot**: Save your session code for future use
3. **Returning User**: Click "Change" to enter your session code
4. **Cross-Device**: Enter your session code on any device to access your listings

#### 🔄 Session Features

- **Edit Listings**: Modify your existing posts
- **Delete Listings**: Remove your posts (soft delete)
- **View History**: See all your previous submissions
- **Device Independent**: Works on any browser or device

### Tips & Best Practices

#### 📝 Writing Good Listings
- **Be Specific**: Include exact pickup/dropoff locations
- **Include Details**: Mention luggage, tent space, special needs
- **Use Flexible Time**: If your schedule is open
- **Provide Contact**: Email AND phone for best response

#### 🔍 Finding the Right Ride
- **Check Multiple Days**: Don't limit yourself to one day
- **Use Location Filters**: Focus on your area
- **Bookmark Favorites**: Star interesting listings to review later
- **Contact Quickly**: Good rides fill up fast

#### 🔑 Session Management Tips
- **Save Your Code**: Screenshot your session code immediately
- **Use Same Code**: Enter the same session code on all devices
- **Keep It Private**: Don't share your session code publicly
- **Backup**: Store your session code in multiple places

#### ⚡ Performance Tips
- **Stable Connection**: Better experience with good internet
- **Refresh if Needed**: If the app seems stuck, refresh the page
- **Clear Cache**: If you experience issues, clear browser cache
- **Install PWA**: Add to home screen for app-like experience

---

## 👨‍💻 Developer Guide

### Architecture Overview

#### 🏗️ Technology Stack
- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **Backend**: Firebase Firestore (NoSQL database)
- **Authentication**: Firebase Anonymous Auth
- **Hosting**: Firebase Hosting
- **Security**: Firestore Security Rules
- **Performance**: Client-side caching, pagination, debounced rendering
- **PWA**: Service Worker, Web App Manifest
- **SEO**: Meta tags, Open Graph, Twitter Cards, JSON-LD

#### 📁 Project Structure
```
bmir-rideswap/
├── index.html                 # Main application file
├── styles.css                 # External CSS styles
├── app.js                     # External JavaScript
├── config.js                  # Firebase configuration (not in git)
├── config.js.example          # Example configuration file
├── manifest.json              # PWA manifest
├── sw.js                      # Service worker
├── firestore.rules            # Firestore security rules
├── firestore.indexes.json     # Database indexes
├── build.sh                   # Simple build script
├── distribution/              # Production-ready files
│   ├── index.html            # Main application
│   ├── app.js                # Application logic
│   ├── styles.css            # Stylesheets
│   ├── config.js             # Firebase configuration
│   ├── manifest.json         # PWA manifest
│   ├── sw.js                 # Service worker
│   ├── logo.png              # Application logo
│   ├── firestore.rules       # Database security rules
│   ├── firestore.indexes.json # Database indexes
│   ├── .htaccess             # Server configuration
│   ├── LICENSE               # License information
│   └── README.md             # Distribution documentation
├── deploy-indexes.sh          # Index deployment script
├── package.json               # Dependencies
└── README.md                  # This file
```

#### 🔄 Data Flow
1. **User Interaction** → JavaScript event handlers
2. **Form Validation** → Client-side validation
3. **Firebase Write** → Firestore security rules
4. **Real-time Updates** → Firestore listeners
5. **UI Updates** → DOM manipulation with optimizations

### Setup & Installation

#### 🚀 Prerequisites
- **Node.js** (v14+)
- **Firebase CLI** (`npm install -g firebase-tools`)
- **Git** for version control

#### 📦 Installation Steps

1. **Clone the Repository**
   ```bash
   git clone <repository-url>
   cd bmir-rideswap
   ```

2. **Install Firebase CLI**
   ```bash
   npm install -g firebase-tools
   ```

3. **Login to Firebase**
   ```bash
   firebase login
   ```

4. **Initialize Firebase Project**
   ```bash
   firebase init
   # Select: Hosting, Firestore
   # Choose existing project: bmir-rideshare
   ```

5. **Deploy Indexes** (Required for performance)
   ```bash
   chmod +x deploy-indexes.sh
   ./deploy-indexes.sh
   ```

6. **Configure Firebase Settings**
   ```bash
   # Copy the sample configuration file
   cp config.js.example config.js
   
   # Edit config.js with your Firebase project settings
   # See Configuration section below for details
   ```

### Configuration

#### 🔐 Secure Configuration System

The application uses a secure configuration system to protect sensitive API keys and Firebase settings. **Never commit `config.js` to version control** - it's already in `.gitignore`.

1. **Create Configuration File**
   ```bash
   # Copy the sample configuration file
   cp config.js.example config.js
   ```

2. **Configure Firebase Settings**
   
   Edit `config.js` with your Firebase project settings:
   
   ```javascript
   // Firebase Configuration
   const FIREBASE_CONFIG = {
       apiKey: "your-firebase-api-key",
       authDomain: "your-project-id.firebaseapp.com",
       projectId: "your-project-id",
       storageBucket: "your-project-id.appspot.com",
       messagingSenderId: "your-sender-id",
       appId: "your-app-id",
       measurementId: "your-measurement-id"
   };
   
   // App Configuration
   const APP_CONFIG = {
       appId: "your-project-id",
       projectId: "your-project-id",
       collectionPath: "artifacts/your-project-id/public/data"
   };
   
   // Google Analytics Configuration
   const ANALYTICS_CONFIG = {
       trackingId: "your-google-analytics-tracking-id",
       gtagUrl: "https://www.googletagmanager.com/gtag/js"
   };
   
   // reCAPTCHA Configuration
   const RECAPTCHA_CONFIG = {
       siteKey: "your-recaptcha-site-key",
       apiUrl: "https://www.google.com/recaptcha/api.js"
   };
   ```

3. **Get Firebase Configuration**
   
   To get your Firebase configuration:
   
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Select your project
   - Click the gear icon ⚙️ → Project Settings
   - Scroll down to "Your apps" section
   - Click the web app (</>) icon
   - Copy the configuration object

4. **Get Google Analytics Tracking ID**
   
   To get your Google Analytics tracking ID:
   
   - Go to [Google Analytics](https://analytics.google.com/)
   - Select your property
   - Go to Admin → Data Streams → Web
   - Copy the Measurement ID (starts with "G-")

5. **Get reCAPTCHA Site Key**
   
   To get your reCAPTCHA site key:
   
   - Go to [reCAPTCHA Admin Console](https://www.google.com/recaptcha/admin)
   - Create a new site or select existing
   - Choose reCAPTCHA v3
   - Add your domain (e.g., `rideswap.auerbach.io`)
   - Copy the Site Key

6. **Security Notes**
   
   - **Never commit `config.js` to version control**
   - The file is already in `.gitignore`
   - Use environment variables in production
   - Rotate API keys regularly
   - Monitor Firebase usage in console

#### 🔧 Environment Variables (Optional)

For production deployments, you can use environment variables:

```bash
# Set environment variables
export FIREBASE_API_KEY="your-api-key"
export FIREBASE_PROJECT_ID="your-project-id"
export FIREBASE_APP_ID="your-app-id"
export ANALYTICS_TRACKING_ID="your-google-analytics-id"
export RECAPTCHA_SITE_KEY="your-recaptcha-site-key"

# The app will automatically use these if available
```

### Development

#### 🔧 Local Development

1. **Start Local Server**
   ```bash
   # Using Python
   python -m http.server 8000
   
   # Using Node.js
   npx serve .
   
   # Using Firebase
   firebase serve
   ```

2. **Access Development Mode**
   - Visit `http://localhost:8000`
   - Development mode is automatically detected
   - Rate limiting is disabled in development

3. **God Mode Testing**
   - Add `?god=true` to URL for admin features
   - Allows editing/deleting any entry
   - Bypasses rate limiting
   - Shows deleted entries toggle

#### 🛠️ Development Features

- **Debug Mode**: Automatic detection of localhost
- **Console Logging**: Detailed logs for debugging
- **Error Handling**: Graceful fallbacks for all operations
- **Performance Monitoring**: Built-in performance tracking
- **Soft Delete Testing**: God mode can view/restore deleted entries

#### 🔍 Debugging Tips

- **Check Console**: Detailed error messages and logs
- **Network Tab**: Monitor Firebase requests
- **Firebase Console**: Real-time database monitoring
- **Security Rules**: Test in Firebase console
- **PWA Testing**: Use Chrome DevTools Application tab

### Deployment

#### 🚀 Simple Deployment

The project includes a simple build system for easy deployment:

1. **Create Distribution**
   ```bash
   # Run the build script
   ./build.sh
   ```

2. **Local Testing**
   - Open `distribution/index.html` in your browser
   - Works with file:// protocol (no server needed)
   - Perfect for ChromeBook usage

3. **Web Server Deployment**
   - Upload all files from `distribution/` to your web server root
   - Configure Firebase settings in `distribution/config.js`
   - Deploy Firestore rules using Firebase CLI

#### 🚀 Production Deployment

1. **Build and Test**
   ```bash
   # Create distribution
   ./build.sh
   
   # Test locally first
   firebase serve
   ```

2. **Deploy to Firebase**
   ```bash
   firebase deploy
   ```

3. **Deploy Security Rules**
   ```bash
   firebase deploy --only firestore:rules
   ```

4. **Deploy Indexes** (if needed)
   ```bash
   firebase deploy --only firestore:indexes
   ```

#### 📊 Post-Deployment Checklist

- [ ] **Test Core Features**: Create, edit, delete entries
- [ ] **Test Performance**: Load with many entries
- [ ] **Test Security**: Verify rules are working
- [ ] **Test PWA**: Install and test offline functionality
- [ ] **Test Session Codes**: Verify cross-device access
- [ ] **Test Soft Deletes**: Verify god mode restore functionality
- [ ] **Monitor Logs**: Check Firebase console for errors
- [ ] **Update Documentation**: Keep README current

### Performance Optimizations

#### ⚡ Current Optimizations

1. **Server-Side Filtering**
   - Direction filtering at database level
   - Date range filtering (last 7 days)
   - Result limiting (100-200 entries)

2. **Client-Side Optimizations**
   - Pagination (20 items per page)
   - Debounced rendering (300ms delay)
   - Virtual scrolling for large lists
   - Local storage for user preferences
   - Duplicate submission prevention

3. **Caching Strategy**
   - localStorage for favorites and flags
   - Session-based rate limiting
   - Optimistic UI updates
   - Service worker for offline support

4. **PWA Features**
   - Service worker caching
   - Offline functionality
   - App-like installation
   - Background sync capabilities

#### 📈 Performance Metrics

- **Initial Load**: < 2 seconds
- **Real-time Updates**: < 100ms
- **Search Response**: < 200ms
- **Memory Usage**: < 50MB for 1000 entries
- **PWA Install Time**: < 30 seconds

#### 🔧 Scaling Considerations

- **Database Indexes**: Required for complex queries
- **Rate Limiting**: Prevents abuse
- **Pagination**: Handles large datasets
- **Caching**: Reduces server load
- **Soft Deletes**: Preserves data integrity

### Security

#### 🛡️ Security Features

1. **Firestore Security Rules**
   ```javascript
   // Users can only edit their own entries
   allow update: if resource.data.authorId == request.auth.uid;
   
   // God mode bypass for admins
   allow update: if isGodMode();
   
   // Soft delete support
   allow update: if resource.data.deleted == true;
   ```

2. **Client-Side Validation**
   - Input sanitization
   - Rate limiting
   - Data validation
   - Duplicate submission prevention

3. **Anonymous Authentication**
   - No personal data required
   - Session-based tracking
   - Device-specific storage
   - Session code system

#### 🔒 Security Best Practices

- **Input Validation**: All user inputs are validated
- **Rate Limiting**: Prevents spam and abuse
- **Content Moderation**: Community flagging system
- **Data Privacy**: No personal data stored on server
- **HTTPS Only**: All connections are encrypted
- **Soft Deletes**: Prevents accidental data loss

#### 🚨 Security Monitoring

- **Firebase Console**: Monitor database activity
- **Error Logging**: Track security rule violations
- **Rate Limit Monitoring**: Watch for abuse patterns
- **Content Moderation**: Review flagged content
- **Session Monitoring**: Track session code usage

### Configuration

#### ⚙️ Environment Variables

```javascript
// Firebase Configuration
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  // ... other config
};
```

#### 🔧 Feature Flags

```javascript
// Development mode
window.DEBUG_MODE = location.hostname === 'localhost';

// God mode
const isGodMode = urlParams.get('god') === 'true';

// Rate limiting
const RATE_LIMIT_CONFIG = {
  MAX_SUBMISSIONS_PER_HOUR: 5,
  RATE_LIMIT_WINDOW: 60 * 60 * 1000
};

// Session management
const SESSION_CODE_LENGTH = 8;
```

#### 🔔 FCM Configuration (Messaging)

For push notifications to work, you need to configure Firebase Cloud Messaging:

1. **Get VAPID Key**:
   - Go to Firebase Console > Project Settings > Cloud Messaging
   - Generate a new Web Push certificate
   - Copy the public key

2. **Update config.js**:
   ```javascript
   const FCM_CONFIG = {
     vapidKey: "YOUR_VAPID_KEY_HERE",
     fcmServerKey: "YOUR_SERVER_KEY" // Optional
   };
   ```

3. **Update manifest.json**:
   ```json
   {
     "gcm_sender_id": "YOUR_SENDER_ID"
   }
   ```

4. **Test Notifications**:
   - Grant notification permission in browser
   - Send a test message between users
   - Verify background notifications work

### Troubleshooting

#### 🐛 Common Issues

1. **Index Errors**
   - **Symptom**: "The query requires an index"
   - **Solution**: Deploy indexes using `./deploy-indexes.sh`

2. **Permission Denied**
   - **Symptom**: "Missing or insufficient permissions"
   - **Solution**: Check Firestore security rules

3. **Slow Performance**
   - **Symptom**: Long loading times
   - **Solution**: Check network, verify indexes are built

4. **Real-time Updates Not Working**
   - **Symptom**: Changes don't appear immediately
   - **Solution**: Check Firebase connection, refresh page

5. **Session Code Issues**
   - **Symptom**: Can't access listings from other devices
   - **Solution**: Use the same session code on all devices

6. **PWA Installation Issues**
   - **Symptom**: Can't install as app
   - **Solution**: Check HTTPS, verify manifest.json

7. **Messaging Issues**
   - **Symptom**: Can't send messages
   - **Solution**: Ensure you have created a listing, check messaging is enabled
   - **Symptom**: No push notifications
   - **Solution**: Check FCM configuration, verify notification permissions
   - **Symptom**: Messages not appearing in real-time
   - **Solution**: Check Firestore rules, verify conversation permissions

#### 🔧 Debug Commands

```bash
# Check Firebase status
firebase projects:list

# View logs
firebase functions:log

# Test security rules
firebase firestore:rules:test

# Monitor performance
firebase hosting:channel:list

# Test PWA
lighthouse https://your-site.com
```

### Contributing

#### 🤝 Development Guidelines

1. **Code Style**
   - Use ES6+ features
   - Follow existing naming conventions
   - Add comments for complex logic
   - Maintain dark theme consistency

2. **Testing**
   - Test all user flows
   - Verify performance with large datasets
   - Check mobile responsiveness
   - Test PWA functionality
   - Verify session code system

3. **Security**
   - Validate all inputs
   - Test security rules
   - Review for potential vulnerabilities
   - Test soft delete functionality

#### 📝 Pull Request Process

1. **Fork the repository**
2. **Create feature branch**
3. **Make changes with tests**
4. **Update documentation**
5. **Submit pull request**

---

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Support

For support, please contact the BMIR team or create an issue in the repository.

---

*Last updated: August 2024* 
