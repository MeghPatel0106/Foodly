// Import and configure the Firebase SDK
// These scripts are made available when the app is served locally on localhost:5000 
// or deployed to Firebase Hosting.
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker by passing in
// your app's Firebase config object.
// https://firebase.google.com/docs/web/setup#config-object
firebase.initializeApp({
    apiKey: "AIzaSyBihlwqIg2rvfKC-Tt6sjKYSFKYn7ZBJwg",
    authDomain: "foodly-40d16.firebaseapp.com",
    projectId: "foodly-40d16",
    storageBucket: "foodly-40d16.firebasestorage.app",
    messagingSenderId: "74040922594",
    appId: "1:74040922594:web:667204bc01d84c8db5e9bb"
});

// Retrieve an instance of Firebase Messaging so that it can handle background
// messages.
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);

    // Customize notification here
    const notificationTitle = payload.notification.title || '🍔 Foodly Update';
    const notificationOptions = {
        body: payload.notification.body || 'You have a new update from Foodly.',
        icon: '/images/logo.png' // Adjust path if necessary
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});
