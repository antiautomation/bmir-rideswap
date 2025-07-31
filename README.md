# BMIR Rideshare Board

A real-time rideshare coordination platform for Burning Man participants, built with Firebase and modern web technologies.

## 🚀 Live Demo

Visit the live application at: [BMIR Rideshare Board](https://www.rideswap.auerbach.io)

## 📋 Table of Contents

- [User Guide](#user-guide)
  - [Getting Started](#getting-started)
  - [How to Use](#how-to-use)
  - [Features](#features)
  - [Tips & Best Practices](#tips--best-practices)
- [Developer Guide](#developer-guide)
  - [Architecture Overview](#architecture-overview)
  - [Setup & Installation](#setup--installation)
  - [Development](#development)
  - [Deployment](#deployment)
  - [Performance Optimizations](#performance-optimizations)
  - [Security](#security)

---

## 👥 User Guide

### Getting Started

1. **Open the App**: Visit the BMIR Rideshare Board in your web browser
2. **Choose Direction**: Select "To Burning Man" or "From Burning Man"
3. **Browse Listings**: View available rides or people needing rides
4. **Contact Users**: Click on email or phone links to get in touch

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
3. **Click "Save"** to post your listing

#### 🔍 Finding Rides

- **Direction Toggle**: Switch between "To Burning Man" and "From Burning Man"
- **Day Filter**: Filter by specific days of the week
- **Location Filter**: Filter by city/location
- **Favorites**: Click the star (☆) to bookmark interesting listings
- **Show Favorites Only**: Toggle to see only your bookmarked listings

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
- **Delete**: Click the trash (🗑️) icon on your own listings
- **Real-time Updates**: Changes appear immediately

### Features

#### 🎯 Core Features
- **Real-time Updates**: No page refresh needed
- **Anonymous Posting**: No account required
- **Contact Integration**: Click to email or call
- **Mobile Responsive**: Works on all devices
- **Offline Support**: Basic functionality when disconnected

#### 🔧 Advanced Features
- **Smart Expiration**: Listings automatically hide after 12 hours
- **Flexible Time Slots**: "Flexible Time" option for open schedules
- **City Autocomplete**: 500+ US cities with smart search
- **Rate Limiting**: Prevents spam (5 submissions per hour)
- **God Mode**: Administrative features for moderators

#### 📊 User Experience
- **Loading States**: Visual feedback during data loading
- **Error Handling**: Graceful failure recovery
- **Pagination**: Browse large lists efficiently
- **Search & Filter**: Multiple ways to find relevant listings

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

#### ⚡ Performance Tips
- **Stable Connection**: Better experience with good internet
- **Refresh if Needed**: If the app seems stuck, refresh the page
- **Clear Cache**: If you experience issues, clear browser cache

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

#### 📁 Project Structure
```
bmirrideshare/
├── bmirrideshare.html          # Main application file
├── firestore-rules.txt         # Firestore security rules
├── firestore.indexes.json      # Database indexes
├── deploy-indexes.sh           # Index deployment script
├── package.json                # Dependencies (if any)
└── README.md                   # This file
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
   cd bmirrideshare
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

#### 🛠️ Development Features

- **Debug Mode**: Automatic detection of localhost
- **Console Logging**: Detailed logs for debugging
- **Error Handling**: Graceful fallbacks for all operations
- **Performance Monitoring**: Built-in performance tracking

#### 🔍 Debugging Tips

- **Check Console**: Detailed error messages and logs
- **Network Tab**: Monitor Firebase requests
- **Firebase Console**: Real-time database monitoring
- **Security Rules**: Test in Firebase console

### Deployment

#### 🚀 Production Deployment

1. **Build and Test**
   ```bash
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

3. **Caching Strategy**
   - localStorage for favorites and flags
   - Session-based rate limiting
   - Optimistic UI updates

#### 📈 Performance Metrics

- **Initial Load**: < 2 seconds
- **Real-time Updates**: < 100ms
- **Search Response**: < 200ms
- **Memory Usage**: < 50MB for 1000 entries

#### 🔧 Scaling Considerations

- **Database Indexes**: Required for complex queries
- **Rate Limiting**: Prevents abuse
- **Pagination**: Handles large datasets
- **Caching**: Reduces server load

### Security

#### 🛡️ Security Features

1. **Firestore Security Rules**
   ```javascript
   // Users can only edit their own entries
   allow update: if resource.data.authorId == request.auth.uid;
   
   // God mode bypass for admins
   allow update: if isGodMode();
   ```

2. **Client-Side Validation**
   - Input sanitization
   - Rate limiting
   - Data validation

3. **Anonymous Authentication**
   - No personal data required
   - Session-based tracking
   - Device-specific storage

#### 🔒 Security Best Practices

- **Input Validation**: All user inputs are validated
- **Rate Limiting**: Prevents spam and abuse
- **Content Moderation**: Community flagging system
- **Data Privacy**: No personal data stored on server
- **HTTPS Only**: All connections are encrypted

#### 🚨 Security Monitoring

- **Firebase Console**: Monitor database activity
- **Error Logging**: Track security rule violations
- **Rate Limit Monitoring**: Watch for abuse patterns
- **Content Moderation**: Review flagged content

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
```

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
```

### Contributing

#### 🤝 Development Guidelines

1. **Code Style**
   - Use ES6+ features
   - Follow existing naming conventions
   - Add comments for complex logic

2. **Testing**
   - Test all user flows
   - Verify performance with large datasets
   - Check mobile responsiveness

3. **Security**
   - Validate all inputs
   - Test security rules
   - Review for potential vulnerabilities

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

*Last updated: August 2025* 
