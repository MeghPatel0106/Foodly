// Toastify Utility - Centralized Toast Notifications
// Usage: showToast('Message', 'success|error|warning|info')

/**
 * Show a toast notification
 * @param {string} message - The message to display
 * @param {string} type - Type of toast: 'success', 'error', 'warning', 'info'
 * @param {number} duration - Duration in milliseconds (default: 3000)
 */
function showToast(message, type = 'info', duration = 3000) {
    // Ensure Toastify is loaded
    if (typeof Toastify === 'undefined') {
        console.error('Toastify is not loaded!');
        return;
    }

    // Professional color schemes - Center Position
    const colors = {
        success: {
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            icon: '✓',
            color: '#ffffff'
        },
        error: {
            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            icon: '✕',
            color: '#ffffff'
        },
        warning: {
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            icon: '⚠',
            color: '#ffffff'
        },
        info: {
            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            icon: 'ℹ',
            color: '#ffffff'
        }
    };

    const config = colors[type] || colors.info;

    Toastify({
        text: `${config.icon} ${message}`,
        duration: duration,
        close: true,
        gravity: "top",
        position: "center",
        stopOnFocus: true,
        style: {
            background: config.background,
            color: config.color,
            borderRadius: "12px",
            padding: "16px 24px",
            fontSize: "15px",
            fontWeight: "500",
            boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
            fontFamily: "'Inter', sans-serif",
            minWidth: "300px",
            maxWidth: "500px",
            textAlign: "center"
        },
        onClick: function () { }
    }).showToast();
}

// Convenience methods
window.toast = {
    success: (msg, duration) => showToast(msg, 'success', duration),
    error: (msg, duration) => showToast(msg, 'error', duration),
    warning: (msg, duration) => showToast(msg, 'warning', duration),
    info: (msg, duration) => showToast(msg, 'info', duration)
};

window.showToast = showToast;
