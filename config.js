// Secure Configuration File
// This file contains sensitive configuration data
// DO NOT commit this file to version control

// Firebase Configuration
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyCSuS3HjgXbO_II0VXRvho9J84qidSoTw8",
    authDomain: "bmir-rideshare.firebaseapp.com",
    projectId: "bmir-rideshare",
    storageBucket: "bmir-rideshare.appspot.com",
    messagingSenderId: "739664619765",
    appId: "1:739664619765:web:118b5b518d0a9e73383dbc",
    measurementId: "G-NXHN9M6GQX"
};

// App Configuration
const APP_CONFIG = {
    appId: "bmir-rideshare", // Use project ID like the live site
    projectId: "bmir-rideshare",
    collectionPath: "artifacts/bmir-rideshare/public/data"
};

// Google Analytics Configuration
const ANALYTICS_CONFIG = {
    trackingId: "G-NXHN9M6GQX",
    gtagUrl: "https://www.googletagmanager.com/gtag/js"
};

// reCAPTCHA Configuration
const RECAPTCHA_CONFIG = {
    siteKey: "6Lf3vZMrAAAAAPxqjxRRc9RyAV8smuu1UIMOv4Y5",
    apiUrl: "https://www.google.com/recaptcha/api.js"
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { 
        FIREBASE_CONFIG, 
        APP_CONFIG, 
        ANALYTICS_CONFIG, 
        RECAPTCHA_CONFIG 
    };
} else {
    window.FIREBASE_CONFIG = FIREBASE_CONFIG;
    window.APP_CONFIG = APP_CONFIG;
    window.ANALYTICS_CONFIG = ANALYTICS_CONFIG;
    window.RECAPTCHA_CONFIG = RECAPTCHA_CONFIG;
} 