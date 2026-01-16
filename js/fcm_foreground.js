// Initialize Firebase Messaging if it hasn't been initialized yet
if (typeof firebase !== 'undefined' && firebase.messaging) {
    const messaging = firebase.messaging();

    // Register Service Worker if not already registered
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('../firebase-messaging-sw.js')
                .then(registration => {
                    console.log('FCM SW registered:', registration);
                    messaging.useServiceWorker(registration);
                })
                .catch(err => console.error('FCM SW registration failed:', err));
        });
    }

    // Handle foreground messages
    messaging.onMessage((payload) => {
        console.log('FCM Message received in foreground:', payload);
        const { title, body } = payload.notification;

        // Show browser notification if permission granted
        if (Notification.permission === 'granted') {
            new Notification(title, {
                body,
                icon: '../images/logo.png'
            });
        }

        // Lightweight visual feedback (Toast if available, else standard alert)
        // Since many pages have their own toast logic, we try to use a common approach
        try {
            if (typeof showDashboardToast === 'function') {
                showDashboardToast(`${title}: ${body}`);
            } else {
                // Background alert if no toast function
                const toast = document.createElement('div');
                toast.style.cssText = 'position:fixed; bottom:20px; right:20px; background:#333; color:#fff; padding:15px; border-radius:8px; z-index:10000; box-shadow:0 4px 12px rgba(0,0,0,0.2); font-family: sans-serif;';
                toast.innerHTML = `<strong>${title}</strong><p style="margin:5px 0 0 0; font-size:0.9rem;">${body}</p>`;
                document.body.appendChild(toast);
                setTimeout(() => toast.remove(), 5000);
            }
        } catch (e) {
            console.error("Error showing notification toast:", e);
        }
    });

    // Handle token refresh or periodic permission request if needed
    // But for "minimal", we rely on the logic in index.html for initial token.
}
