// Firebase Messaging Service Worker
importScripts('https://www.gstatic.com/firebasejs/11.6.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.6.1/firebase-messaging-compat.js');

// Firebase configuration (same as in index.html)
const firebaseConfig = {
    apiKey: "AIzaSyCSuS3HjgXbO_II0VXRvho9J84qidSoTw8",
    authDomain: "bmir-rideshare.firebaseapp.com",
    projectId: "bmir-rideshare",
    storageBucket: "bmir-rideshare.appspot.com",
    messagingSenderId: "739664619765",
    appId: "1:739664619765:web:118b5b518d0a9e73383dbc",
    measurementId: "G-NXHN9M6GQX"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firebase Messaging
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
    console.log('🔔 Background message received:', payload);
    
    const notificationTitle = payload.notification?.title || 'New Ride Available';
    const notificationOptions = {
        body: payload.notification?.body || 'Check out this new ride!',
        icon: '/icon-192x192.png',
        badge: '/icon-192x192.png',
        tag: 'bmir-rideshare',
        requireInteraction: false,
        actions: [
            {
                action: 'view',
                title: 'View Ride'
            },
            {
                action: 'dismiss',
                title: 'Dismiss'
            }
        ]
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    console.log('🔔 Notification clicked:', event);
    
    event.notification.close();
    
    if (event.action === 'view') {
        // Open the app to view the ride
        event.waitUntil(
            clients.openWindow('/')
        );
    }
}); 