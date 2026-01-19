/**
 * Foodly Shared Layout - Sidebar & Navbar
 * This file injects the sidebar and top navbar into all user pages
 * ensuring consistent UI across the application with no flickering.
 */

(function () {
    'use strict';

    // Get current page for active link highlighting
    const currentPage = window.location.pathname.split('/').pop() || 'menu.html';
    const urlParams = new URLSearchParams(window.location.search);
    const section = urlParams.get('section');

    // Determine active link
    function isActive(page, sectionMatch = null) {
        // For pages with sections (like menu.html?section=meal)
        if (sectionMatch) {
            // Only active if section matches exactly
            return currentPage.includes('menu') && section === sectionMatch;
        }

        // For regular pages without section parameter
        return currentPage === page;
    }

    // Special check for menu page - Meal is default when no section specified
    function isMealActive() {
        return currentPage.includes('menu') && (section === 'meal' || !section);
    }

    function isSnackActive() {
        return currentPage.includes('menu') && section === 'snack';
    }

    // Get cached cart count immediately
    function getCachedCartCount() {
        try {
            const lastUserId = sessionStorage.getItem('foodly_last_user_id');
            if (lastUserId) {
                const savedCart = localStorage.getItem(`foodly_cart_${lastUserId}`);
                if (savedCart) {
                    const cart = JSON.parse(savedCart);
                    return cart.reduce((sum, item) => sum + item.quantity, 0);
                }
            }
        } catch (e) { }
        return 0;
    }

    // Get cached profile info
    function getCachedProfile() {
        try {
            const cached = sessionStorage.getItem('foodly_user_profile_v2');
            if (cached) {
                return JSON.parse(cached);
            }
        } catch (e) { }
        return { name: 'User', email: '', avatar: 'https://cdn-icons-png.flaticon.com/512/1077/1077114.png' };
    }

    const cartCount = getCachedCartCount();
    const profile = getCachedProfile();

    // Sidebar HTML Template
    const sidebarHTML = `
    <aside class="user-sidebar" id="shared-sidebar">
        <div class="user-sidebar-header">
            <button class="sidebar-close-btn" onclick="toggleSidebar()" aria-label="Close Sidebar">×</button>
            <a href="menu.html" class="user-sidebar-logo">
                <img src="../images/logo.png" alt="Logo" width="30">
                Foodly
            </a>
        </div>

        <ul class="user-sidebar-menu">
            <li>
                <a href="dashboard.html" class="user-sidebar-link ${isActive('dashboard.html') ? 'active' : ''}">
                    <span class="user-sidebar-icon">
                        <i data-lucide="layout-dashboard"></i>
                    </span>
                    Dashboard
            </a>
            </li>
            <li>
                <a href="menu.html?section=meal" class="user-sidebar-link ${isMealActive() ? 'active' : ''}" id="link-meal">
                    <span class="user-sidebar-icon">
                        <i data-lucide="utensils"></i>
                    </span>
                    Meal
                </a>
            </li>
            <li>
                <a href="menu.html?section=snack" class="user-sidebar-link ${isSnackActive() ? 'active' : ''}" id="link-snack">
                    <span class="user-sidebar-icon">
                        <i data-lucide="coffee"></i>
                    </span>
                    Quick Snacks
                </a>
            </li>
            <li>
                <a href="orders.html" class="user-sidebar-link ${isActive('orders.html') ? 'active' : ''}">
                    <span class="user-sidebar-icon">
                        <i data-lucide="package"></i>
                    </span>
                    Order
                </a>
            </li>
            <li>
                <a href="invoices.html" class="user-sidebar-link ${isActive('invoices.html') ? 'active' : ''}">
                    <span class="user-sidebar-icon">
                        <i data-lucide="indian-rupee"></i>
                    </span>
                    Invoice
                </a>
            </li>
            <li>
                <a href="cart.html" class="user-sidebar-link ${isActive('cart.html') ? 'active' : ''}">
                    <span class="user-sidebar-icon cart-icon-wrapper">
                        <i data-lucide="shopping-cart"></i>
                        <span class="cart-badge-overlay" id="cart-count" style="${cartCount > 0 ? '' : 'display: none;'}">${cartCount}</span>
                    </span>
                    Cart
                </a>
            </li>
            <li>
                <a href="analytics.html" class="user-sidebar-link ${isActive('analytics.html') ? 'active' : ''}">
                    <span class="user-sidebar-icon">
                        <i data-lucide="trending-up"></i>
                    </span>
                    Analytics
                </a>
            </li>
            <li>
                <a href="settings.html" class="user-sidebar-link ${isActive('settings.html') ? 'active' : ''}">
                    <span class="user-sidebar-icon">
                        <i data-lucide="settings"></i>
                    </span>
                    Setting
                </a>
            </li>
        </ul>

        <div class="user-sidebar-footer">
            <button id="sidebar-auth-btn" class="btn btn-sm text-danger"
                style="margin-top: 10px; padding-left: 0; color: #ef4444; display: flex; align-items: center; gap: 5px; background: none; border: none; cursor: pointer;">
                <i data-lucide="log-out" width="16" height="16"></i>
                <span id="sidebar-auth-text">Logout</span>
            </button>
        </div>
    </aside>
    <div id="sidebar-overlay" onclick="toggleSidebar()"></div>
    `;

    // Top Navbar HTML Template
    const topNavbarHTML = `
    <nav class="user-top-navbar" id="shared-top-navbar">
        <button class="hamburger-btn" onclick="toggleSidebar()" aria-label="Toggle Sidebar">
            <i data-lucide="menu"></i>
        </button>
        <div class="navbar-content-end">
            <div class="notification-icon-wrapper" onclick="toggleNotifications ? toggleNotifications() : null">
                <span class="icon">
                    <i data-lucide="bell"></i>
                </span>
                <span class="badge" id="nav-notification-badge" style="display: none;"></span>
            </div>
            <div class="user-profile-widget" onclick="openProfile ? openProfile() : (window.location.href = 'profile.html')"
                style="border: none; box-shadow: none; background: transparent; cursor: pointer;">
                <div class="user-info-text">
                    <span class="user-name" id="top-nav-name">${profile.name || 'User'}</span>
                    <span class="user-email" id="top-nav-email"
                        style="font-size: 0.75rem; color: var(--text-light);">${profile.email || ''}</span>
                </div>
                <img id="top-nav-avatar" src="${profile.avatar || 'https://cdn-icons-png.flaticon.com/512/1077/1077114.png'}"
                    class="user-avatar-circle" alt="Profile">
            </div>
        </div>
    </nav>
    `;

    // CSS for cart badge on icon
    const badgeStyles = `
    <style id="shared-layout-styles">
        /* Cart icon wrapper for badge positioning */
        .cart-icon-wrapper {
            position: relative;
            display: inline-flex;
        }
        
        /* Cart badge overlay - positioned on top of icon */
        .cart-badge-overlay {
            position: absolute;
            top: -8px;
            right: -8px;
            background: var(--primary-color, #FF6B6B);
            color: white;
            font-size: 0.65rem;
            font-weight: 700;
            min-width: 18px;
            height: 18px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0 4px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            z-index: 10;
        }
        
        /* Ensure sidebar and navbar show immediately */
        #shared-sidebar,
        #shared-top-navbar {
            opacity: 1 !important;
            visibility: visible !important;
        }
        
        /* Fix sidebar link cart text alignment */
        .user-sidebar-link {
            display: flex;
            align-items: center;
        }
    </style>
    `;

    // Toggle sidebar function (global)
    window.toggleSidebar = function () {
        const sidebar = document.querySelector('.user-sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        if (sidebar && overlay) {
            sidebar.classList.toggle('show');
            overlay.classList.toggle('show');
        }
    };

    // Inject shared layout
    function injectSharedLayout() {
        // Add styles first
        if (!document.getElementById('shared-layout-styles')) {
            document.head.insertAdjacentHTML('beforeend', badgeStyles);
        }

        // Find or create sidebar container
        const existingSidebar = document.querySelector('.user-sidebar');
        if (existingSidebar) {
            // Replace existing sidebar
            existingSidebar.outerHTML = sidebarHTML.split('<div id="sidebar-overlay"')[0];

            // Add overlay if not exists
            if (!document.getElementById('sidebar-overlay')) {
                document.body.insertAdjacentHTML('beforeend', '<div id="sidebar-overlay" onclick="toggleSidebar()"></div>');
            }
        } else {
            // Insert at the beginning of body
            document.body.insertAdjacentHTML('afterbegin', sidebarHTML);
        }

        // Find main-app-content and inject navbar if needed
        const mainContent = document.getElementById('main-app-content');
        if (mainContent) {
            const existingNav = mainContent.querySelector('.user-top-navbar');
            if (existingNav) {
                existingNav.outerHTML = topNavbarHTML;
            } else {
                mainContent.insertAdjacentHTML('afterbegin', topNavbarHTML);
            }
        }

        // Initialize Lucide icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }

        // Setup auth button
        setupAuthButton();
    }

    // Setup auth button based on current state
    function setupAuthButton() {
        const authBtn = document.getElementById('sidebar-auth-btn');
        const authText = document.getElementById('sidebar-auth-text');

        if (!authBtn) return;

        // Check if we have a cached user
        const lastUserId = sessionStorage.getItem('foodly_last_user_id');

        if (lastUserId) {
            // Assume logged in
            authText.innerText = 'Logout';
            authBtn.style.color = '#ef4444';
            authBtn.onclick = function () {
                if (typeof logout === 'function') {
                    logout();
                } else if (typeof firebase !== 'undefined' && firebase.auth) {
                    firebase.auth().signOut().then(() => {
                        sessionStorage.clear();
                        window.location.href = 'index.html';
                    });
                }
            };
        } else {
            // Guest
            authText.innerText = 'Login';
            authBtn.style.color = 'var(--primary-color)';
            authBtn.onclick = function () {
                window.location.href = 'index.html';
            };
        }
    }

    // Update cart badge (called from main.js)
    window.updateSharedCartBadge = function (count) {
        const badge = document.getElementById('cart-count');
        if (badge) {
            badge.innerText = count;
            badge.style.display = count > 0 ? 'flex' : 'none';
        }
    };

    // Update profile info (called from main.js)
    window.updateSharedProfile = function (name, email, avatar) {
        const nameEl = document.getElementById('top-nav-name');
        const emailEl = document.getElementById('top-nav-email');
        const avatarEl = document.getElementById('top-nav-avatar');

        if (nameEl && name) nameEl.innerText = name;
        if (emailEl) emailEl.innerText = email || '';
        if (avatarEl && avatar) avatarEl.src = avatar;
    };

    // Run on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectSharedLayout);
    } else {
        injectSharedLayout();
    }

})();
