// Test script for notifications
// Run this in the browser console to test notifications

console.log('🔔 Notification Test Script Loaded');

// Test function to simulate a new ride notification
function testNotification() {
    console.log('🔔 Testing notification...');
    
    // Check if notifications are supported
    if (!('Notification' in window)) {
        console.error('❌ Notifications not supported');
        return;
    }
    
    // Check permission
    if (Notification.permission === 'granted') {
        console.log('✅ Notification permission granted');
        
        // Create a test notification
        const notification = new Notification('Test Ride Available!', {
            body: 'This is a test notification from BMIR RideSwap',
            icon: '/icon-192x192.png',
            badge: '/icon-192x192.png',
            tag: 'test-notification',
            requireInteraction: false
        });
        
        // Auto-close after 5 seconds
        setTimeout(() => {
            notification.close();
        }, 5000);
        
        console.log('✅ Test notification sent');
    } else if (Notification.permission === 'denied') {
        console.error('❌ Notification permission denied');
        alert('Please enable notifications in your browser settings to test this feature');
    } else {
        console.log('⏳ Requesting notification permission...');
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                testNotification();
            } else {
                console.error('❌ Permission denied');
            }
        });
    }
}

// Test function to check FCM token
function checkFCMToken() {
    console.log('🔍 Checking FCM token...');
    
    if (window.notificationToken) {
        console.log('✅ FCM Token found:', window.notificationToken.substring(0, 20) + '...');
    } else {
        console.log('❌ No FCM token found');
    }
    
    if (window.messaging) {
        console.log('✅ Firebase Messaging initialized');
    } else {
        console.log('❌ Firebase Messaging not initialized');
    }
}

// Test function to check notification preferences
function checkNotificationPreferences() {
    console.log('🔍 Checking notification preferences...');
    
    if (window.notificationPreferences) {
        console.log('✅ Notification preferences:', window.notificationPreferences);
    } else {
        console.log('❌ No notification preferences found');
    }
}

// Test function to show in-app notification
function testInAppNotification() {
    console.log('🔔 Testing in-app notification...');
    
    if (typeof window.testInAppNotification === 'function') {
        window.testInAppNotification({
            notification: {
                title: 'Test In-App Notification',
                body: 'This is a test of the in-app notification system'
            }
        });
        console.log('✅ In-app notification sent');
    } else if (typeof window.showInAppNotification === 'function') {
        window.showInAppNotification({
            notification: {
                title: 'Test In-App Notification',
                body: 'This is a test of the in-app notification system'
            }
        });
        console.log('✅ In-app notification sent');
    } else {
        console.error('❌ showInAppNotification function not found');
    }
}

// Make functions available globally
window.testNotification = testNotification;
window.checkFCMToken = checkFCMToken;
window.checkNotificationPreferences = checkNotificationPreferences;
window.testInAppNotification = testInAppNotification;

console.log('🔔 Test functions available:');
console.log('  - testNotification() - Test browser notification');
console.log('  - checkFCMToken() - Check FCM token status');
console.log('  - checkNotificationPreferences() - Check user preferences');
console.log('  - testInAppNotification() - Test in-app notification toast'); 