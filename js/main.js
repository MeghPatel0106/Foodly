// Foodly Main Logic

// --- State ---
let cart = []; // Initialize empty, load after auth
let activeCategory = 'all';

// --- Firebase Data Cache Utility ---
const FoodlyCache = {
    // Cache TTL in milliseconds (5 minutes)
    TTL: 5 * 60 * 1000,

    // Get cached data if valid
    get: function (key) {
        try {
            const cached = localStorage.getItem(`foodly_cache_${key}`);
            if (!cached) return null;

            const { data, timestamp } = JSON.parse(cached);
            const age = Date.now() - timestamp;

            // Return data if within TTL
            if (age < this.TTL) {
                console.log(`[Cache] HIT: ${key} (${Math.round(age / 1000)}s old)`);
                return data;
            }

            console.log(`[Cache] STALE: ${key} (expired)`);
            return null;
        } catch (e) {
            console.warn('[Cache] Error reading:', e);
            return null;
        }
    },

    // Get stale data (for stale-while-revalidate pattern)
    getStale: function (key) {
        try {
            const cached = localStorage.getItem(`foodly_cache_${key}`);
            if (!cached) return null;

            const { data } = JSON.parse(cached);
            return data;
        } catch (e) {
            return null;
        }
    },

    // Set cache with timestamp
    set: function (key, data) {
        try {
            const cacheEntry = {
                data: data,
                timestamp: Date.now()
            };
            localStorage.setItem(`foodly_cache_${key}`, JSON.stringify(cacheEntry));
            console.log(`[Cache] SET: ${key}`);
        } catch (e) {
            console.warn('[Cache] Error writing:', e);
        }
    },

    // Clear specific cache
    clear: function (key) {
        localStorage.removeItem(`foodly_cache_${key}`);
    },

    // Clear all Foodly caches
    clearAll: function () {
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('foodly_cache_')) {
                localStorage.removeItem(key);
            }
        });
    },

    // Cache keys
    KEYS: {
        USER_PROFILE: 'user_profile',
        QUICK_MEALS: 'quick_meals',
        USER_ORDERS: 'user_orders',
        FOOD_ITEMS: 'food_items'
    }
};


// --- Anti-Flicker: Mark auth as ready ---
function markAuthReady() {
    const mainContent = document.getElementById('main-app-content');
    if (mainContent) {
        mainContent.classList.add('auth-ready');
    }
    // Also mark body as ready
    document.body.classList.add('auth-ready');
}

// Fallback: Show content after 500ms even if auth is slow
setTimeout(markAuthReady, 500);

// --- Immediate UI State Restoration (Before Auth) ---
// This runs synchronously on page load to prevent flickering
(function restoreUIState() {
    // 1. Restore cart badge immediately from cached user
    try {
        // Try to get cart from last known user
        const lastUserId = sessionStorage.getItem('foodly_last_user_id');
        if (lastUserId) {
            const savedCart = localStorage.getItem(`foodly_cart_${lastUserId}`);
            if (savedCart) {
                const cachedCart = JSON.parse(savedCart);
                const totalItems = cachedCart.reduce((sum, item) => sum + item.quantity, 0);

                // Update badge immediately (before auth)
                const badge = document.getElementById('cart-count');
                if (badge) {
                    badge.innerText = totalItems;
                    badge.style.display = totalItems > 0 ? '' : 'none';
                }
            }
        }
    } catch (e) {
        console.warn('[UIRestore] Cart restore failed:', e);
    }

    // 2. Restore profile info immediately from cache
    try {
        const cachedProfile = sessionStorage.getItem('foodly_user_profile_v2');
        if (cachedProfile) {
            const profile = JSON.parse(cachedProfile);
            const nameEl = document.getElementById('top-nav-name');
            const avatarEl = document.getElementById('top-nav-avatar');
            if (nameEl && profile.name) nameEl.innerText = profile.name;
            if (avatarEl && profile.avatar) avatarEl.src = profile.avatar;
        }
    } catch (e) {
        console.warn('[UIRestore] Profile restore failed:', e);
    }

    // 3. Restore auth button state immediately from cache to prevent flicker
    try {
        const cachedAuthState = sessionStorage.getItem('foodly_auth_state');
        const authBtn = document.getElementById('sidebar-auth-btn');
        const authText = document.getElementById('sidebar-auth-text');

        if (authBtn) {
            if (cachedAuthState === 'logged_in') {
                // User was logged in - show Logout immediately
                if (authText) authText.innerText = 'Logout';
                authBtn.style.color = '#ef4444';
                authBtn.style.visibility = 'visible';
            } else if (cachedAuthState === 'logged_out') {
                // User was logged out - show Login immediately
                if (authText) authText.innerText = 'Login';
                authBtn.style.color = 'var(--primary-color)';
                authBtn.style.visibility = 'visible';
            } else {
                // No cached state - hide button until auth is confirmed
                authBtn.style.visibility = 'hidden';
            }
        }
    } catch (e) {
        console.warn('[UIRestore] Auth state restore failed:', e);
    }
})();

// --- Functions ---
function trackPage(pageName) {
    gtag('event', 'page_view', {
        page_title: pageName,
        page_location: window.location.href
    });
}

function saveCart() {
    const user = firebase.auth().currentUser;
    // Only save if user is logged in
    if (user) {
        localStorage.setItem(`foodly_cart_${user.uid}`, JSON.stringify(cart));
    }
    updateCartBadge();
}

// Initialize Cart based on Auth
function initCartListener() {
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            // Save user ID for immediate UI restoration on next page
            sessionStorage.setItem('foodly_last_user_id', user.uid);

            // Load User Cart
            const savedCart = localStorage.getItem(`foodly_cart_${user.uid}`);
            if (savedCart) {
                cart = JSON.parse(savedCart);
            } else {
                cart = [];
            }
        } else {
            // Clear Cart on Logout
            cart = [];
            sessionStorage.removeItem('foodly_last_user_id');
        }
        updateCartBadge();
        // meaningful update if on cart page
        if (typeof renderCartPage === 'function') {
            renderCartPage();
        }
        // Mark auth as ready to show content
        markAuthReady();
    });
}

function updateCartBadge() {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const badge = document.getElementById('cart-count');
    const mobileBadge = document.getElementById('mobile-cart-count');
    const mobileBtn = document.getElementById('mobile-cart-btn');

    if (badge) {
        badge.innerText = totalItems;
        badge.style.display = totalItems > 0 ? 'flex' : 'none';
    }
    if (mobileBadge) {
        mobileBadge.innerText = totalItems;
        mobileBadge.style.display = totalItems > 0 ? 'flex' : 'none';
    }

    if (mobileBtn) {
        mobileBtn.style.display = totalItems > 0 ? 'block' : 'none';
    }

    // Update shared layout badge if available
    if (typeof updateSharedCartBadge === 'function') {
        updateSharedCartBadge(totalItems);
    }
}

// Quantity limits per item type
const CART_LIMITS = {
    meal: 5,
    quick: 10,
    'quick-snack': 10
};

function addToCart(itemId, name, price, image, type = 'meal') {
    const user = firebase.auth().currentUser;
    if (!user) {
        toast.warning("Please login to add items to your cart.");
        window.location.href = "index.html";
        return;
    }

    let item = null;
    if (typeof foodItems !== 'undefined') {
        item = foodItems.find(i => i.id === itemId);
    }

    // Support for Quick Meals OR Fallback if foodItems missing (Dashboard context)
    if (!item && name && price !== undefined) {
        item = { id: itemId, name, price, image, type };
    } else if (item) {
        // Ensure type is set for regular items from foodItems
        item.type = type;
    }

    if (!item) return;

    // Determine the max limit based on item type
    const itemType = item.type || type || 'meal';
    const isQuickItem = itemType === 'quick' || itemType === 'quick-snack';
    const maxLimit = isQuickItem ? CART_LIMITS.quick : CART_LIMITS.meal;

    const existingItem = cart.find(i => i.id === itemId);

    // Check if adding this item would exceed the limit
    if (existingItem) {
        if (existingItem.quantity >= maxLimit) {
            // Show friendly toast warning
            const itemTypeName = isQuickItem ? 'Quick Snack' : 'Meal';
            toast.warning(`Whoa there! 🛑 You can only order ${maxLimit} of this ${itemTypeName} item. Save some for others! 😄`);
            return;
        }
        existingItem.quantity += 1;
    } else {
        cart.push({ ...item, quantity: 1 });
    }

    saveCart();

    // ✅ GOOGLE ANALYTICS: Track Add to Cart
    gtag('event', 'add_to_cart', {
        item_name: item.name,
        item_category: item.type === 'quick' ? 'quick_snack' : 'meal',
        price: item.price
    });

    // Show simple feedback
    const btn = document.querySelector(`button[onclick="addToCart('${itemId}')"]`);
    if (btn) {
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i data-lucide="check"></i>';
        lucide.createIcons();
        btn.style.backgroundColor = 'var(--success-color)';
        btn.style.color = 'white';
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.style.backgroundColor = '';
            btn.style.color = '';
        }, 1000);
    }
}

function renderCategories() {
    const container = document.getElementById('categories');
    if (!container) return;

    container.innerHTML = categories.map(cat => `
        <button class="category-chip ${activeCategory === cat.id ? 'active' : ''}" 
                onclick="setCategory('${cat.id}')">
            ${cat.name}
        </button>
    `).join('');
}

function setCategory(id) {
    activeCategory = id;
    renderCategories();
    renderMenu();
}

// Deterministic Rating Generator
function getAutoRating(seed) {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = ((hash << 5) - hash) + seed.charCodeAt(i);
        hash |= 0;
    }
    // Generate range 3.8 to 5.0
    const rating = ((Math.abs(hash) % 13) / 10 + 3.8).toFixed(1);
    const starCount = Math.round(rating);
    const stars = '★'.repeat(starCount) + '☆'.repeat(5 - starCount);

    return `<div class="food-rating"><span>${stars}</span> <span class="rating-val">(${rating})</span></div>`;
}

// Global User Data
let userFavourites = [];

function toggleFavourite(itemId) {
    const user = firebase.auth().currentUser;
    if (!user) {
        toast.warning("Please login to save favourites!");
        return;
    }

    const index = userFavourites.indexOf(itemId);
    if (index > -1) {
        userFavourites.splice(index, 1);
    } else {
        userFavourites.push(itemId);
    }

    // Update Local Storage immediately
    localStorage.setItem(`foodly_favs_${user.uid}`, JSON.stringify(userFavourites));

    // Update UI immediately (Optimistic)
    renderMenu();
    renderQuickMenu();

    // Sync to Firestore
    db.collection('users').doc(user.uid).set({
        favourites: userFavourites
    }, { merge: true });
}

// Init Favourites from Cache
let menuAlreadyRendered = false; // Track if menu has been rendered to prevent flicker

function initFavourites(user) {
    const cached = localStorage.getItem(`foodly_favs_${user.uid}`);
    if (cached) {
        userFavourites = JSON.parse(cached);
        // Only render if menu hasn't been rendered yet (prevents initial flicker)
        if (!menuAlreadyRendered && document.getElementById('menu-grid')) {
            renderMenu();
        }
        if (document.getElementById('quick-meals-grid')) renderQuickMenu();
    }
}



// Track last rendered content to avoid unnecessary flicker
let lastMenuHTML = '';

function renderMenu() {
    const container = document.getElementById('menu-grid');
    const searchInput = document.getElementById('searchInput');

    if (!container) return;

    let items = foodItems;

    // Filter by Category
    if (activeCategory !== 'all') {
        items = items.filter(i => (i.category || '').toLowerCase() === activeCategory.toLowerCase());
    }

    // Filter by Search
    if (searchInput && searchInput.value.trim() !== '') {
        const term = searchInput.value.toLowerCase();
        items = items.filter(i => i.name.toLowerCase().includes(term) || i.description.toLowerCase().includes(term));
    }

    // Only use animation on first render to prevent flicker
    const animClass = menuAlreadyRendered ? '' : 'animate-fade-in';

    const newHTML = items.map(item => {
        const isFav = userFavourites.includes(item.id);
        return `
        <div class="meal-card ${animClass}">
            <div class="meal-img-box">
                <img loading="lazy" src="${item.image}" alt="${item.name}" onerror="this.src='https://via.placeholder.com/300x200?text=Food'">
                <button class="meal-fav-btn" onclick="toggleFavourite('${item.id}')">
                    ${isFav ? '<i data-lucide="heart" fill="red" class="text-red-500" style="color: red;"></i>' : '<i data-lucide="heart"></i>'}
                </button>
            </div>
            <div class="meal-info">
                <h3 class="meal-title">${item.name}</h3>
                <div class="meal-rating">${getAutoRating(item.id + item.name)}</div>
                <p class="meal-desc">${item.description}</p>
                <div class="meal-footer">
                    <span class="meal-price">₹${item.price.toFixed(2)}</span>
                    <button class="meal-add-btn" onclick="addToCart('${item.id}', '${item.name}', ${item.price}, '${item.image}', 'meal')">Add +</button>
                </div>
            </div>
        </div>
    `}).join('');

    // Only update DOM if content actually changed (prevents flicker)
    if (newHTML !== lastMenuHTML) {
        container.innerHTML = newHTML;
        lastMenuHTML = newHTML;
        lucide.createIcons();
    }

    menuAlreadyRendered = true;
}

// Search Listener
let searchTimeout;
const searchInput = document.getElementById('searchInput');
if (searchInput) {
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(renderMenu, 300);
    });
}

// Quick Search Listener (Debounced)
let quickSearchTimeout;
const quickSearchInput = document.getElementById('quickSearchInput');
// Clean up inline handler if present to avoid double-firing
if (quickSearchInput) {
    quickSearchInput.oninput = null;
    quickSearchInput.addEventListener('input', () => {
        clearTimeout(quickSearchTimeout);
        quickSearchTimeout = setTimeout(renderQuickMenu, 300);
    });
}

// --- Cart Page Functions ---

function renderCartPage() {
    const container = document.getElementById('cart-items');
    const subtotalEl = document.getElementById('subtotal');

    const totalEl = document.getElementById('total');
    const emptyState = document.getElementById('empty-state');
    const cartState = document.getElementById('cart-content');

    if (!container) return;

    if (cart.length === 0) {
        if (cartState) cartState.style.display = 'none';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }

    if (cartState) cartState.style.display = 'block';
    if (emptyState) emptyState.style.display = 'none';

    // Hide the shared summary if it exists (we will render per-section summaries)
    const defaultSummary = document.querySelector('.cart-summary');
    if (defaultSummary) defaultSummary.style.display = 'none';

    // Split Items
    const meals = cart.filter(i => i.type !== 'quick' && i.type !== 'quick-snack');
    const snacks = cart.filter(i => i.type === 'quick' || i.type === 'quick-snack');

    let html = '';

    // Helper to render a section
    const renderSection = (title, items, orderType, btnLabel) => {
        if (items.length === 0) return '';
        const sectionTotal = items.reduce((sum, i) => sum + (i.price * i.quantity), 0);

        const listHtml = items.map(item => `
            <div class="cart-item">
                <div class="cart-item-info">
                    <img loading="lazy" src="${item.image}" alt="${item.name}" class="cart-item-img">
                    <div>
                        <h4 class="cart-item-title">${item.name}</h4>
                        <span class="cart-item-price">₹${item.price.toFixed(2)}</span>
                    </div>
                </div>
                <div class="cart-controls">
                    <button class="qty-btn" onclick="updateQty('${item.id}', -1)">-</button>
                    <span class="qty-val">${item.quantity}</span>
                    <button class="qty-btn" onclick="updateQty('${item.id}', 1)">+</button>
                </div>
            </div>
        `).join('');

        return `
            <div class="cart-section-card">
                <h3 class="cart-section-title">${title}</h3>
                <div class="cart-list-scroll">
                    ${listHtml}
                </div>
                <div class="cart-section-footer">
                    <div class="cart-total-row">
                        <span>Total:</span>
                        <span class="cart-total-price">₹${sectionTotal.toFixed(2)}</span>
                    </div>
                    <button onclick="submitOrder('${orderType}')" class="btn btn-primary cart-order-btn">
                        ${btnLabel}
                    </button>
                </div>
            </div>
        `;
    };

    let sectionsHtml = '';
    sectionsHtml += renderSection('🍛 MEALS SECTION', meals, 'meal', 'Place Meal Order');
    sectionsHtml += renderSection('🍟 QUICK SNACKS SECTION', snacks, 'quick-snack', 'Place Quick Snack Order');

    container.innerHTML = `<div class="cart-sections-grid">${sectionsHtml}</div>`;

    // Initialize QR Codes after rendering

}

function updateQty(itemId, change) {
    const item = cart.find(i => i.id === itemId);
    if (!item) return;

    // Check limit when increasing quantity
    if (change > 0) {
        const itemType = item.type || 'meal';
        const isQuickItem = itemType === 'quick' || itemType === 'quick-snack';
        const maxLimit = isQuickItem ? CART_LIMITS.quick : CART_LIMITS.meal;

        if (item.quantity >= maxLimit) {
            const itemTypeName = isQuickItem ? 'Quick Snack' : 'Meal';
            toast.warning(`Maximum limit reached! 🛑 You can only order ${maxLimit} of this ${itemTypeName} item.`);
            return;
        }
    }

    item.quantity += change;

    if (item.quantity <= 0) {
        cart = cart.filter(i => i.id !== itemId);
    }

    saveCart();
    renderCartPage();
}

function clearCart() {
    if (confirm("Are you sure you want to clear your cart?")) {
        cart = [];
        saveCart();
        renderCartPage();
    }
}

async function placeOrder() {
    if (cart.length === 0) return;

    const user = firebase.auth().currentUser;
    if (!user) {
        toast.warning("Please log in to place an order.");
        window.location.href = "index.html";
        return;
    }

    const btn = document.querySelector('.btn-checkout');
    if (btn) {
        btn.disabled = true;
        btn.innerText = "Processing...";
    }

    try {
        const orderId = 'ORD-' + Math.floor(1000 + Math.random() * 9000); // Friendly ID
        const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        const orderData = {
            orderNumber: orderId, // Store friendly ID
            userId: user.uid,
            userName: user.displayName || 'Costumer', // Fixed typo 'Customer' if wanted, but preserving logic
            userEmail: user.email,
            items: cart,
            total: totalAmount.toFixed(2),
            status: 'Preparing',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdAtDate: new Date().toISOString(), // For local sorting if needed
            feedbackSubmitted: false
        };

        // Write to Firestore
        await db.collection('orders').add(orderData);

        // Clear cart
        cart = [];
        saveCart();

        // Redirect
        window.location.href = 'orders.html';

    } catch (error) {
        console.error("Order Error:", error);
        toast.error("Failed to place order. Please try again.");
        if (btn) {
            btn.disabled = false;
            btn.innerText = "Checkout";
        }
    }
}

function logout() {
    firebase.auth().signOut().then(() => {
        // Clear cached avatar on logout
        localStorage.removeItem('cachedAvatar');
        // Clear all session caches
        sessionStorage.removeItem('foodly_auth_state');
        sessionStorage.removeItem('foodly_user_profile_v2');
        sessionStorage.removeItem('foodly_last_user_id');
        window.location.href = 'index.html';
    }).catch((error) => {
        console.error('Logout error:', error);
        toast.error('Error logging out');
    });
}

function updateSidebarAuthUI(user) {
    const authBtn = document.getElementById('sidebar-auth-btn');
    const authText = document.getElementById('sidebar-auth-text');
    // const authIcon = document.getElementById('sidebar-auth-icon'); // ID removed in refactor

    if (!authBtn) return;

    if (user) {
        // LOGGED IN: Show Logout
        sessionStorage.setItem('foodly_auth_state', 'logged_in'); // Cache auth state
        if (authText) authText.innerText = "Logout";
        authBtn.onclick = logout;
        authBtn.classList.add('text-danger');
        authBtn.style.color = '#ef4444';
        authBtn.style.visibility = 'visible'; // Ensure visible after auth confirmed

        const existingIcon = authBtn.querySelector('svg, i[data-lucide]');
        if (existingIcon) {
            const newIcon = document.createElement('i');
            newIcon.setAttribute('data-lucide', 'log-out');
            newIcon.setAttribute('width', '16');
            newIcon.setAttribute('height', '16');
            existingIcon.replaceWith(newIcon);
            lucide.createIcons();
        } else {
            // Fallback if no icon found
            authBtn.insertAdjacentHTML('afterbegin', '<i data-lucide="log-out" width="16" height="16"></i>');
            lucide.createIcons();
        }
    } else {
        // GUEST: Show Login
        sessionStorage.setItem('foodly_auth_state', 'logged_out'); // Cache auth state
        if (authText) authText.innerText = "Login";
        authBtn.onclick = () => window.location.href = 'index.html';
        authBtn.classList.remove('text-danger');
        authBtn.style.color = 'var(--primary-color)';
        authBtn.style.visibility = 'visible'; // Ensure visible after auth confirmed

        const existingIcon = authBtn.querySelector('svg, i[data-lucide]');
        if (existingIcon) {
            const newIcon = document.createElement('i');
            newIcon.setAttribute('data-lucide', 'log-in');
            newIcon.setAttribute('width', '16');
            newIcon.setAttribute('height', '16');
            existingIcon.replaceWith(newIcon);
            lucide.createIcons();
        } else {
            authBtn.insertAdjacentHTML('afterbegin', '<i data-lucide="log-in" width="16" height="16"></i>');
            lucide.createIcons();
        }
    }
}

// --- Profile Logic (Centralized & Optimized) ---

const AVATARS = [
    "https://cdn-icons-png.flaticon.com/512/4140/4140048.png",
    "https://cdn-icons-png.flaticon.com/512/4140/4140037.png",
    "https://cdn-icons-png.flaticon.com/512/4140/4140047.png",
    "https://cdn-icons-png.flaticon.com/512/4140/4140051.png",
    "https://cdn-icons-png.flaticon.com/512/4140/4140040.png",
    "https://cdn-icons-png.flaticon.com/512/4140/4140039.png"
];
const DEFAULT_AVATAR = "https://cdn-icons-png.flaticon.com/512/1077/1077114.png";
const PROFILE_CACHE_KEY = 'foodly_user_profile_v2'; // Cache Key

let selectedAvatar = "";
let isProfileMandatory = false;
let isProfileListenerAttached = false; // Prevent duplicate listeners

function initProfileListener() {
    if (isProfileListenerAttached) return; // STRICT SINGLE EXECUTION
    isProfileListenerAttached = true;

    // 1. FAST RENDER from Session Cache
    const cachedProfile = sessionStorage.getItem(PROFILE_CACHE_KEY);
    if (cachedProfile) {
        try {
            const profile = JSON.parse(cachedProfile);
            updateNavbarAvatar(profile.avatar);
            updateTopNavInfo(profile.name, profile.email);
            // Don't return, we still might need to auth check, but UI is ready
        } catch (e) {
            console.warn("Profile cache parse error", e);
            sessionStorage.removeItem(PROFILE_CACHE_KEY);
        }
    }

    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            // ALWAYS initialize favourites first (separate logic)
            initFavourites(user);

            // If we have a robust cache, we can SKIP the Firestore read to save cost/time
            // UNLESS it's a hard refresh or empty cache.
            // For safety, we'll do a "Stale-While-Revalidate" approach:
            // If cache exists, we already showed it. We can optionally fetch in background to sync.

            if (!sessionStorage.getItem(PROFILE_CACHE_KEY)) {
                fetchUserProfile(user);
            } else {
                // Background sync (Optional: Remove if you want STRICT single read per session)
                // For "STRICT SINGLE READ" requirement: Do NOT fetch again if cached.
                console.log("Profile loaded from cache.");
            }
        } else {
            // Logout cleanup
            sessionStorage.removeItem(PROFILE_CACHE_KEY);
            localStorage.removeItem('cachedAvatar'); // Legacy cleanup
        }
    });
}

async function fetchUserProfile(user) {
    try {
        const doc = await db.collection('users').doc(user.uid).get();
        if (doc.exists) {
            const data = doc.data();

            // Sync Favourites - only re-render if favourites changed
            if (data.favourites) {
                const prevFavs = JSON.stringify(userFavourites);
                const newFavs = JSON.stringify(data.favourites);

                // Only update and re-render if favourites actually changed
                if (prevFavs !== newFavs) {
                    userFavourites = data.favourites;
                    localStorage.setItem(`foodly_favs_${user.uid}`, JSON.stringify(userFavourites));
                    if (document.getElementById('menu-grid')) renderMenu();
                    if (document.getElementById('quick-meals-grid')) renderQuickMenu();
                }
            }

            // Admin Logic - Check for both old admin.html and new admin/ folder
            const isAdminPage = window.location.href.includes('admin.html') || window.location.href.includes('/admin/');
            if (data.role === 'admin' && !isAdminPage) {
                window.location.href = 'admin/active-orders.html';
                return;
            }
            if (isAdminPage && data.role !== 'admin') {
                window.location.href = 'menu.html';
                return;
            }

            // Prepare Profile Data Object
            const profile = {
                name: data.name || user.displayName || 'Costumer',
                email: data.email || user.email || '',
                avatar: data.avatar || user.photoURL || null,
                role: data.role || 'user',
                gender: data.gender || '',
                phoneNumber: data.phoneNumber || ''
            };

            // Update UI
            updateTopNavInfo(profile.name, profile.email);
            if (profile.avatar) {
                updateNavbarAvatar(profile.avatar);
            }

            // CACHE IT (Session)
            sessionStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));

            // Setup Check
            const urlParams = new URLSearchParams(window.location.search);
            const isSetupUrl = urlParams.get('setupProfile') === 'true';
            const missingData = !data.gender || !data.avatar || !data.phoneNumber;

            if (isSetupUrl || missingData) {
                openProfile(true);
                if (isSetupUrl) {
                    window.history.replaceState({}, document.title, window.location.pathname);
                }
            }

        } else {
            // New/No Doc -> Use Auth Defaults
            const profile = {
                name: user.displayName || 'Costumer',
                email: user.email || '',
                avatar: user.photoURL || null
            };
            updateTopNavInfo(profile.name, profile.email);
            if (profile.avatar) updateNavbarAvatar(profile.avatar);
            sessionStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
        }
    } catch (error) {
        console.error("Profile fetch error:", error);
    }
}

function updateNavbarAvatar(url) {
    const finalUrl = url || DEFAULT_AVATAR;

    const updateImg = (id) => {
        const img = document.getElementById(id);
        if (img) {
            // Only update if changed to prevent flicker
            if (img.src !== finalUrl) {
                img.src = finalUrl;
            }
            if (img.style.display === 'none') img.style.display = 'block';

            // Optimization: Attributes
            if (!img.getAttribute('width')) img.setAttribute('width', '40');
            if (!img.getAttribute('height')) img.setAttribute('height', '40');
            img.setAttribute('loading', 'lazy');
        }
    };

    updateImg('nav-avatar-img');
    updateImg('top-nav-avatar');
}

function updateTopNavInfo(name, email) {
    const nameEl = document.getElementById('top-nav-name');
    const emailEl = document.getElementById('top-nav-email');

    // Only update textContent if changed
    if (nameEl && nameEl.innerText !== (name || 'Costumer')) {
        nameEl.innerText = name || 'Costumer';
    }
    if (emailEl && emailEl.innerText !== (email || '')) {
        emailEl.innerText = email || '';
    }
}

function openProfile(mandatory = false) {
    const user = firebase.auth().currentUser;
    if (!user) return;

    if (mandatory) {
        window.location.href = 'profile.html?setupProfile=true';
    } else {
        window.location.href = 'profile.html';
    }
}

function closeProfile() {
    // Deprecated for new page, keeping for legacy modal safety
    const modal = document.getElementById('profile-modal');
    if (modal) modal.style.display = 'none';
}

function selectAvatar(url) {
    selectedAvatar = url;

    // Update Profile Page if active
    const pagePreview = document.getElementById('profile-page-avatar');
    if (pagePreview) pagePreview.src = url;

    // Update Modal (Legacy or Admin)
    const modalPreview = document.getElementById('avatar-preview');
    if (modalPreview) modalPreview.src = url;

    document.querySelectorAll('.avatar-option').forEach(img => {
        img.classList.toggle('selected', img.src === url);
    });
}

function triggerAvatarUpload() {
    document.getElementById('avatar-upload-input').click();
}

function handleAvatarUpload(input) {
    // Skip if on profile page (it has its own handler)
    if (window.location.pathname.includes('profile.html')) {
        return;
    }

    const file = input.files[0];
    if (!file) return;

    const user = firebase.auth().currentUser;
    if (!user) return;

    // Show loading state on image
    const preview = document.getElementById('profile-page-avatar');
    const statusMsg = document.getElementById('profile-upload-status');
    const originalSrc = preview.src;
    preview.style.opacity = '0.5';
    if (statusMsg) statusMsg.style.display = 'block';

    // 1. Try Firebase Storage
    const storageRef = firebase.storage().ref();
    const fileRef = storageRef.child(`users/${user.uid}/profile_${Date.now()}.jpg`);

    fileRef.put(file).then(snapshot => {
        return snapshot.ref.getDownloadURL();
    }).then(url => {
        selectAvatar(url);
        preview.style.opacity = '1';
        if (statusMsg) statusMsg.style.display = 'none';

        // Close the avatar modal if it's open
        const avatarModal = document.getElementById('avatarModal');
        if (avatarModal) avatarModal.classList.remove('active');

        toast.success('Photo uploaded! Click Save Changes to confirm.');
    }).catch(error => {
        console.warn("Storage upload failed, attempting local fallback:", error);

        // 2. Fallback: Client-side resize & base64
        // This handles cases where Storage Rules deny access or CORS fails
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_SIZE = 250; // Keep small for Firestore (limit 1MB doc size)
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_SIZE) {
                        height *= MAX_SIZE / width;
                        width = MAX_SIZE;
                    }
                } else {
                    if (height > MAX_SIZE) {
                        width *= MAX_SIZE / height;
                        height = MAX_SIZE;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                selectAvatar(dataUrl);
                preview.style.opacity = '1';
                if (statusMsg) statusMsg.style.display = 'none';

                // Close the avatar modal if it's open
                const avatarModal = document.getElementById('avatarModal');
                if (avatarModal) avatarModal.classList.remove('active');

                toast.success('Photo uploaded! Click Save Changes to confirm.');
            };
            img.onerror = () => {
                toast.error("Failed to process image.");
                preview.src = originalSrc;
                preview.style.opacity = '1';
                if (statusMsg) statusMsg.style.display = 'none';
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

async function initProfilePage(user) {
    if (!document.getElementById('profile-page-name')) return;

    // Helper to populate UI
    const populateProfileUI = (data, orderCount) => {
        // Stats
        const statOrders = document.getElementById('stat-total-orders');
        if (statOrders) statOrders.innerText = orderCount || 0;

        const favCount = userFavourites.length;
        const statFav = document.getElementById('stat-favourites');
        if (statFav) statFav.innerText = favCount;

        // Helper
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val || "";
        };

        // Header - Updated for new layout
        document.getElementById('profile-page-name').innerText = data.name || user.displayName || 'User';

        // Email display
        const emailDisplay = document.getElementById('profile-page-email-display');
        if (emailDisplay) emailDisplay.innerText = user.email;

        document.getElementById('profile-page-avatar').src = data.avatar || user.photoURL || DEFAULT_AVATAR;

        // Form
        setVal('page-profile-name', data.name || user.displayName);
        setVal('page-profile-email', user.email);
        setVal('page-profile-phone', data.phoneNumber || user.phoneNumber);
        setVal('page-profile-gender', data.gender);

        selectedAvatar = data.avatar || user.photoURL || DEFAULT_AVATAR;
        window.selectedAvatar = selectedAvatar;
    };

    // Try loading from cache first
    const cacheKey = `${FoodlyCache.KEYS.USER_PROFILE}_${user.uid}`;
    const cachedProfile = FoodlyCache.getStale(cacheKey);
    if (cachedProfile) {
        populateProfileUI(cachedProfile.userData, cachedProfile.orderCount);

        // Check if cache is fresh
        if (FoodlyCache.get(cacheKey)) {
            return; // Fresh cache, no refetch needed
        }
    }

    // Fetch from Firestore
    const ordersSnap = await db.collection('orders').where('userId', '==', user.uid).get();
    const userDoc = await db.collection('users').doc(user.uid).get();
    const data = userDoc.exists ? userDoc.data() : {};

    // Cache the profile data
    FoodlyCache.set(cacheKey, {
        userData: data,
        orderCount: ordersSnap.size
    });

    // Populate UI
    populateProfileUI(data, ordersSnap.size);
}

async function saveProfilePage() {
    const user = firebase.auth().currentUser;
    if (!user) return;

    const name = document.getElementById('page-profile-name').value;
    const phone = document.getElementById('page-profile-phone').value;
    const gender = document.getElementById('page-profile-gender').value;

    if (!name || !phone || !gender) {
        toast.warning("Please fill in name, phone, and gender.");
        return;
    }

    const btn = document.querySelector('.save-btn') || document.querySelector('.profile-form-card .btn-primary');
    if (!btn) return;
    const originalText = btn.innerHTML;
    btn.innerHTML = "Saving...";
    btn.disabled = true;

    try {
        const updatePayload = { displayName: name };

        // Fix: Only update Auth photoURL if it is NOT a base64 string
        if (selectedAvatar && !selectedAvatar.startsWith('data:')) {
            updatePayload.photoURL = selectedAvatar;
        }

        await user.updateProfile(updatePayload);

        await db.collection('users').doc(user.uid).set({
            name, phoneNumber: phone, gender, avatar: selectedAvatar
        }, { merge: true });

        // Update Cache/UI

        // Fix: Update Session Storage so other pages see changes immediately
        let cached = {};
        try { cached = JSON.parse(sessionStorage.getItem(PROFILE_CACHE_KEY) || '{}'); } catch (e) { }
        cached.name = name;
        cached.avatar = selectedAvatar;
        cached.phoneNumber = phone;
        cached.gender = gender;
        cached.email = user.email;
        sessionStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(cached));

        updateNavbarAvatar(selectedAvatar);
        updateTopNavInfo(name, user.email);

        // Update Header Text immediately
        document.getElementById('profile-page-name').innerText = name;

        // Invalidate profile cache so next load fetches fresh data
        FoodlyCache.clear(`${FoodlyCache.KEYS.USER_PROFILE}_${user.uid}`);

        toast.success("Profile updated successfully!");
    } catch (e) {
        console.error(e);
        toast.error("Error updating profile.");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}


// Maintain compatibility for Admin/Modal usages if any
function saveProfile() {
    console.warn("Legacy saveProfile called. Redirecting to new profile page.");
    const user = firebase.auth().currentUser;
    if (user) {
        window.location.href = 'profile.html';
    }
}

// --- MENU RESTRUCTURING (Meal vs Snacks) ---

function initMenuSelection() {
    const urlParams = new URLSearchParams(window.location.search);
    const section = urlParams.get('section');

    // STRICT REQUIREMENT: Default to MEAL view.
    // If section is 'snack', show snack. Otherwise (empty or 'meal'), show meal.

    const selector = document.getElementById('section-selector');
    if (selector) selector.classList.add('hidden'); // Hide the card selector always

    if (section === 'snack') {
        selectSection('snack');
    } else {
        selectSection('meal'); // Default
    }

    // Sidebar Active State
    document.querySelectorAll('.user-sidebar-link').forEach(link => link.classList.remove('active'));
    if (section === 'snack') {
        const link = document.getElementById('link-snack');
        if (link) link.classList.add('active');
    } else {
        const link = document.getElementById('link-meal');
        if (link) link.classList.add('active');
    }
}

function selectSection(type) {
    const selector = document.getElementById('section-selector');
    const menuView = document.getElementById('menu-view');
    const quickView = document.getElementById('quick-meals-view');

    // Search Teleportation Elements
    const navbarSlot = document.getElementById('navbar-search-slot');

    // Main Meal Search Elements
    const searchContainer = document.getElementById('menu-search-container');
    const bodyPlaceholder = document.getElementById('body-search-placeholder');

    // Quick Snack Search Elements
    const quickSearchContainer = document.getElementById('quick-search-container');
    const quickSearchPlaceholder = document.getElementById('quick-search-placeholder');

    if (selector) selector.classList.add('hidden');

    if (type === 'meal') {
        if (menuView) menuView.classList.remove('hidden');
        if (window.loadMenu) window.loadMenu();

        // 1. Move Quick Search BACK to Body (Cleanup)
        if (quickSearchContainer && quickSearchPlaceholder) {
            quickSearchPlaceholder.appendChild(quickSearchContainer);
        }

        // 2. Move Meal Search TO Navbar (DESKTOP ONLY)
        const isMobile = window.innerWidth <= 1024;

        if (!isMobile && searchContainer && navbarSlot) {
            navbarSlot.appendChild(searchContainer);
            navbarSlot.style.display = 'block';
        } else if (isMobile && searchContainer && bodyPlaceholder) {
            // Ensure stays in body on mobile
            bodyPlaceholder.appendChild(searchContainer);
            navbarSlot.style.display = 'none';
        }

    } else if (type === 'snack') {
        if (quickView) quickView.classList.remove('hidden');

        // 1. Move Meal Search BACK to Body (Cleanup)
        if (searchContainer && bodyPlaceholder) {
            bodyPlaceholder.appendChild(searchContainer);
        }

        // 2. Move Quick Search TO Navbar (DESKTOP ONLY)
        const isMobile = window.innerWidth <= 1024;

        if (!isMobile && quickSearchContainer && navbarSlot) {
            navbarSlot.appendChild(quickSearchContainer);
            navbarSlot.style.display = 'block';
        } else if (isMobile && quickSearchContainer && quickSearchPlaceholder) {
            quickSearchPlaceholder.appendChild(quickSearchContainer);
            navbarSlot.style.display = 'none';
        }

        // Load data if empty
        const grid = document.getElementById('quick-meals-grid');
        if (grid && grid.children.length <= 1) {
            loadQuickMeals();
        }
    }
}


// --- QUICK SNACKS FILTERING LOGIC ---
let quickFoodItems = [];
let activeQuickCategory = 'all';

function loadQuickMeals() {
    const grid = document.getElementById('quick-meals-grid');
    if (!grid) return;

    // If already loaded in memory, just render
    if (quickFoodItems.length > 0) {
        renderQuickCategories();
        renderQuickMenu();
        return;
    }

    // Try loading from cache first (stale-while-revalidate)
    const cachedData = FoodlyCache.getStale(FoodlyCache.KEYS.QUICK_MEALS);
    if (cachedData && cachedData.length > 0) {
        quickFoodItems = cachedData;
        renderQuickCategories();
        renderQuickMenu();

        // Check if cache is still fresh
        if (FoodlyCache.get(FoodlyCache.KEYS.QUICK_MEALS)) {
            return; // Cache is fresh, no need to refetch
        }
    }

    // Fetch from Firestore (either cache miss or background revalidation)
    db.collection('quick_meals')
        .where('available', '==', true)
        .get()
        .then(snapshot => {
            if (snapshot.empty) {
                grid.innerHTML = '<p class="text-center text-muted" style="grid-column: 1/-1;">No quick meals available right now.</p>';
                return;
            }

            quickFoodItems = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                quickFoodItems.push({
                    id: doc.id,
                    ...data,
                    // Ensure price is number
                    price: Number(data.price || data.Price || 0)
                });
            });

            // Cache the data
            FoodlyCache.set(FoodlyCache.KEYS.QUICK_MEALS, quickFoodItems);

            // Initial Render
            renderQuickCategories();
            renderQuickMenu();
        })
        .catch(error => {
            console.error("Error loading quick meals:", error);
            grid.innerHTML = '<p class="text-center text-danger" style="grid-column: 1/-1;">Failed to load quick meals.</p>';
        });
}

function renderQuickCategories() {
    const container = document.getElementById('quick-categories');
    if (!container) return;

    // Use quickCategories from menu.html if available, or fallback
    let sourceCats = (typeof quickCategories !== 'undefined') ? quickCategories : [{ id: 'all', name: 'All' }];

    // Fallback if main categories was used previously and quickCategories is missing (safety)
    if (typeof quickCategories === 'undefined' && typeof categories !== 'undefined') {
        // Only use categories if they look like snacks? No, safer to just default to All
        // or hardcode fallback:
        sourceCats = [{ id: 'all', name: 'All' }, { id: 'drinks', name: 'Drinks' }, { id: 'packets', name: 'Packets' }];
    }

    container.innerHTML = sourceCats.map(cat => `
        <button 
            class="category-chip ${activeQuickCategory === cat.id ? 'active' : ''}" 
            onclick="filterQuickCategory('${cat.id}')">
            ${cat.name}
        </button>
    `).join('');
}

function filterQuickCategory(id) {
    activeQuickCategory = id;
    renderQuickCategories(); // Update UI active state
    renderQuickMenu(); // Filter Grid
}

function renderQuickMenu() {
    const grid = document.getElementById('quick-meals-grid');
    const searchInput = document.getElementById('quickSearchInput');

    if (!grid) return;

    let items = quickFoodItems;

    // Filter by Category
    if (activeQuickCategory !== 'all') {
        items = items.filter(i => {
            const cat = i.Category || i.category || '';
            return cat === activeQuickCategory;
        });
    }

    // Filter by Search
    if (searchInput && searchInput.value.trim() !== '') {
        const term = searchInput.value.toLowerCase();
        items = items.filter(i =>
            (i.name && i.name.toLowerCase().includes(term)) ||
            (i.description && i.description.toLowerCase().includes(term))
        );
    }

    if (items.length === 0) {
        grid.innerHTML = '<div class="text-center text-muted" style="grid-column: 1/-1; padding: 2rem;">No items found.</div>';
        return;
    }

    grid.innerHTML = items.map(item => {
        const isFav = userFavourites.includes(item.id);
        return `
        <div class="meal-card animate-fade-in">
            <div class="meal-img-box">
                <img loading="lazy" src="${item.image || 'https://via.placeholder.com/150'}" alt="${item.name}" onerror="this.src='https://via.placeholder.com/150'">
                <button class="meal-fav-btn" onclick="toggleFavourite('${item.id}')">
                    ${isFav ? '<i data-lucide="heart" fill="red" class="text-red-500" style="color: red;"></i>' : '<i data-lucide="heart"></i>'}
                </button>
            </div>
            <div class="meal-info">
                <h3 class="meal-title">${item.name}</h3>
                <div class="meal-rating">${getAutoRating(item.id + item.name)}</div>
                <div class="meal-footer">
                    <span class="meal-price">₹${item.price}</span>
                    <button class="meal-add-btn" onclick="addToCart('${item.id}', '${item.name}', ${item.price}, '${item.image}', 'quick')">Add +</button>
                </div>
            </div>
        </div>
    `}).join('');
    lucide.createIcons();
}

// Initialize Cart listener
initCartListener();

// --- ORDERS LOGIC ---
// Track if we've rendered from cache to avoid flicker
let ordersRenderedFromCache = false;

function renderOrders(userId) {
    const container = document.getElementById('orders-list');
    if (!container) return; // Guard clause for non-order pages

    // 1. CACHE READ (only if not already rendered)
    const cacheKey = `cachedOrders_${userId}`;
    const cachedData = localStorage.getItem(cacheKey);

    // Only use cache if we have it, it's not empty, AND we haven't rendered yet
    if (cachedData && !ordersRenderedFromCache) {
        const orders = JSON.parse(cachedData);
        if (orders.length > 0 && typeof generateOrdersHTML === 'function') {
            // Check if container already has content (rendered by orders.html)
            if (container.innerHTML.trim() === '' || container.innerHTML.includes('Populated by JS')) {
                container.innerHTML = generateOrdersHTML(orders);
                ordersRenderedFromCache = true;
                if (typeof lucide !== 'undefined') lucide.createIcons();
            } else {
                // Already rendered by orders.html, skip
                ordersRenderedFromCache = true;
            }
        }
    }

    // 2. NETWORK LISTENER
    db.collection('orders')
        .where('userId', '==', userId)
        // .orderBy('createdAt', 'desc') // Removed to avoid composite index requirement
        .onSnapshot(snapshot => {
            let orders = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                // Filter out soft-deleted orders
                if (!data.hiddenFromUser) {
                    orders.push({ id: doc.id, ...data });
                }
            });

            // Client-side Sort (Newest First)
            orders.sort((a, b) => {
                const dateA = a.createdAt ? (a.createdAt.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt).getTime()) : 0;
                const dateB = b.createdAt ? (b.createdAt.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt).getTime()) : 0;
                return dateB - dateA;
            });

            // Update Cache
            localStorage.setItem(cacheKey, JSON.stringify(orders));

            // Render - but only if data changed or first render
            if (orders.length === 0) {
                container.innerHTML = `
                    <div class="text-center text-muted" style="margin-top: 4rem;">
                        <p>No orders yet.</p>
                        <a href="menu.html" style="color: var(--primary-color)">Start ordering</a>
                    </div>
                `;
            } else {
                // Smart update: only re-render if content actually changed
                if (typeof generateOrdersHTML === 'function') {
                    const newHTML = generateOrdersHTML(orders);
                    // Only update if different to prevent flicker
                    if (container.innerHTML !== newHTML) {
                        container.innerHTML = newHTML;
                        if (typeof lucide !== 'undefined') lucide.createIcons();
                    }
                }
            }

            // Check for ready orders to show popup (only if on appropriate page)
            if (typeof checkAndShowReadyPopup === 'function') {
                const readyOrders = orders.filter(o => o.status === 'Ready' && !o.userPickedUp);
                checkAndShowReadyPopup(readyOrders);
            }
        }, error => {
            console.error("Error fetching orders:", error);
            // If cache was empty and error occurs, show error
            if (container.innerHTML.trim() === '') {
                container.innerHTML = `<p class="text-center text-danger">Error loading orders.</p>`;
            }
        });
}

// --- TOP NAVBAR & NOTIFICATION LOGIC ---
function initTopNavbar() {
    // 1. Inject Notification HTML Panels if not present
    if (!document.getElementById('notification-panel')) {
        const topNav = document.querySelector('.user-top-navbar .notification-icon-wrapper');
        if (topNav) {
            // Inject inside wrapper for relative positioning
            topNav.insertAdjacentHTML('beforeend', `
                <div class="notification-panel" id="notification-panel" onclick="event.stopPropagation()">
                    <div class="notification-header">
                        <span>Notifications</span>
                    </div>
                    <div class="notification-list" id="notification-list">
                        <div class="notification-empty">
                            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ddd" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                            </svg>
                            <span>No new notifications</span>
                        </div>
                    </div>
                </div>
            `);

            // Inject Ready Popup inside wrapper
            topNav.insertAdjacentHTML('beforeend', `
                <div id="ready-alert-popup" class="ready-alert-popup" onclick="event.stopPropagation()">
                    <div style="margin-bottom: 0.5rem; color: var(--success-color);">
                        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                             <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                             <polyline points="22 4 12 14.01 9 11.01"></polyline>
                        </svg>
                    </div>
                    <h4 style="margin: 0; color: var(--dark-color); font-size: 1.1rem;">Order Ready!</h4>
                    <p id="ready-popup-message" class="text-sm text-muted" style="margin: 8px 0 16px 0;">
                        Your order is ready.
                    </p>
                    <button onclick="closeReadyPopup()" class="btn btn-primary btn-sm" style="width: 100%;">
                        Okay
                    </button>
                </div>
            `);
        }
    }

    // 2. Initialize Listener if user is logged in
    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            initNotificationListener(user.uid);
        }
    });

    // 3. Close panel on outside click
    document.addEventListener('click', (e) => {
        const wrapper = document.querySelector('.notification-icon-wrapper');
        const panel = document.getElementById('notification-panel');
        if (wrapper && !wrapper.contains(e.target) && panel && panel.classList.contains('show')) {
            panel.classList.toggle('show', false);
        }
    });
}

function toggleNotifications() {
    const panel = document.getElementById('notification-panel');
    if (panel) {
        panel.classList.toggle('show');
    }
}

function initNotificationListener(userId) {
    db.collection('orders')
        .where('userId', '==', userId)
        .where('status', '==', 'Ready')
        .onSnapshot(snapshot => {
            const badge = document.getElementById('nav-notification-badge');
            const list = document.getElementById('notification-list');

            if (!badge || !list) return;

            // CLIENT-SIDE FILTER: Exclude orders that are already picked up
            const activeReadyDocs = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                if (!data.userPickedUp) {
                    activeReadyDocs.push({ id: doc.id, ...data });
                }
            });

            if (activeReadyDocs.length === 0) {
                badge.style.display = 'none';
                badge.innerText = '0';
                list.innerHTML = `
                    <div class="notification-empty">
                        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ddd" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                        </svg>
                        <span>No new notifications</span>
                    </div>
                `;
                return;
            }

            // Populate List
            const count = activeReadyDocs.length;
            badge.innerText = count;
            badge.style.display = 'flex'; // Use flex to center text

            let html = '';

            activeReadyDocs.forEach(data => {
                const orderNum = data.orderNumber || data.id || 'Order';
                html += `
                    <div class="notification-item unread">
                        <div class="notification-title">Your order #${orderNum} is Ready!</div>
                        <div class="notification-time">Please pick it up from the counter.</div>
                    </div>
                `;
            });

            list.innerHTML = html;
            checkAndShowReadyPopup(activeReadyDocs);
        });
}

let recognizedReadyOrders = new Set();

function checkAndShowReadyPopup(orders) {
    // 1. If all Ready orders are picked up (empty list), ensure popup is CLOSED.
    if (!orders || orders.length === 0) {
        closeReadyPopup();
        return;
    }

    const newReadyOrders = orders.filter(o => !recognizedReadyOrders.has(o.id));

    if (newReadyOrders.length > 0) {
        newReadyOrders.forEach(o => recognizedReadyOrders.add(o.id));

        // CONDITIONAL POPUP LOGIC
        // Only show automatically on orders.html or cart.html
        const currentPath = window.location.pathname;
        const isTargetPage = currentPath.includes('orders.html') || currentPath.includes('cart.html');

        if (!isTargetPage) {
            // Do not show popup automatically, just update badge (already done in listener)
            // Maybe show a toast? Reqs say "notification should be shown after we click the bell"
            // So we just return here.
            return;
        }

        const modal = document.getElementById('ready-alert-popup');
        const msg = document.getElementById('ready-popup-message');

        if (modal && msg) {
            if (newReadyOrders.length === 1) {
                const o = newReadyOrders[0];
                const num = o.orderNumber || o.id;
                msg.innerText = `Your Order #${num} is ready for pickup!`;
            } else {
                msg.innerText = `You have ${newReadyOrders.length} orders ready for pickup!`;
            }

            const panel = document.getElementById('notification-panel');
            if (panel) panel.classList.remove('show');

            modal.classList.add('show');
        }
    }
}

function closeReadyPopup() {
    const popup = document.getElementById('ready-alert-popup');
    if (popup) popup.classList.remove('show');
}

// Auto-init top navbar & page specific logic
document.addEventListener('DOMContentLoaded', () => {
    initTopNavbar();
    initProfileListener();

    // Auto-init Orders if on orders page
    const ordersContainer = document.getElementById('orders-list');
    if (ordersContainer) {
        firebase.auth().onAuthStateChanged(user => {
            if (user) renderOrders(user.uid);
        });
    }

    // Auto-init Settings if on settings page
    if (window.location.pathname.includes('settings.html')) {
        initSettingsPage();
    }
});

// --- SETTINGS PAGE LOGIC ---

function initSettingsPage() {
    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            loadSettings(user);

            // Improved Auth Provider Check
            // If user has 'password' provider, they can change password regardless of Google link.
            const hasPassword = user.providerData.some(p => p.providerId === 'password');
            const isGoogleOnly = user.providerData.some(p => p.providerId === 'google.com') && !hasPassword;

            const msgEl = document.getElementById('password-managed-msg');
            const btnEl = document.getElementById('password-change-btn');

            if (isGoogleOnly) {
                if (msgEl) msgEl.style.display = 'block';
                if (btnEl) btnEl.style.display = 'none';
            } else {
                // Determine if password form should be shown (Yes for 'password' provider users)
                if (msgEl) msgEl.style.display = 'none';
                if (btnEl) btnEl.style.display = 'flex';
            }

        }
    });
}

function loadSettings(user) {
    db.collection('users').doc(user.uid).get().then(doc => {
        if (!doc.exists) return;
        const data = doc.data();


        // 2. Notifications (Default to TRUE if undefined)
        const setToggle = (id, field) => {
            const el = document.getElementById(id);
            // If field is explicitly false, uncheck. Else default to true.
            if (el) el.checked = data.settings ? (data.settings[field] !== false) : true;
        };
        setToggle('notify-orders', 'notifyOrders');
        setToggle('notify-ready', 'notifyReady');
        setToggle('notify-feedback', 'notifyFeedback');

        // 3. Preferences
        if (data.settings && data.settings.foodPref) {
            const el = document.getElementById('pref-category');
            if (el) el.value = data.settings.foodPref;
        }

        const confirmToggle = document.getElementById('pref-confirm-reorder');
        if (confirmToggle) {
            // Default true
            confirmToggle.checked = data.settings ? (data.settings.confirmReorder !== false) : true;
        }
    });
}

function saveSettings() {
    const user = firebase.auth().currentUser;
    if (!user) return;

    const btn = document.querySelector('.settings-actions button');
    const originalText = btn.innerText;
    btn.innerText = "Saving...";
    btn.disabled = true;

    // 2. Settings Data
    const notifyOrders = document.getElementById('notify-orders').checked;
    const notifyReady = document.getElementById('notify-ready').checked;
    const notifyFeedback = document.getElementById('notify-feedback').checked;

    const foodPref = document.getElementById('pref-category').value;
    const confirmReorder = document.getElementById('pref-confirm-reorder').checked;

    const updates = {
        settings: {
            notifyOrders,
            notifyReady,
            notifyFeedback,
            foodPref,
            confirmReorder
        }
    };

    // Update Firestore
    db.collection('users').doc(user.uid).set(updates, { merge: true }).then(() => {
        // Update Global Cache/UI if needed
        updateTopNavInfo(name, user.email);

        btn.innerText = "Saved!";
        btn.classList.add('btn-success');
        setTimeout(() => {
            btn.innerText = originalText;
            btn.disabled = false;
            btn.classList.remove('btn-success');
        }, 2000);
    }).catch(err => {
        console.error(err);
        toast.error("Failed to save settings.");
        btn.innerText = originalText;
        btn.disabled = false;
    });
}

function togglePasswordForm(show) {
    const btnDiv = document.getElementById('password-change-btn');
    const formDiv = document.getElementById('password-change-container');

    if (show) {
        btnDiv.style.setProperty('display', 'none', 'important');
        formDiv.style.display = 'block';
    } else {
        formDiv.style.display = 'none';
        btnDiv.style.display = 'flex';
        // Clear fields
        document.getElementById('current-password').value = '';
        document.getElementById('new-password').value = '';
        document.getElementById('confirm-password').value = '';
    }
}

function changePassword() {
    const user = firebase.auth().currentUser;
    if (!user) return;

    const currentPass = document.getElementById('current-password').value;
    const newPass = document.getElementById('new-password').value;
    const confirmPass = document.getElementById('confirm-password').value;

    if (!currentPass || !newPass || !confirmPass) {
        toast.warning("Please fill in all fields.");
        return;
    }

    if (newPass !== confirmPass) {
        toast.warning("New passwords do not match.");
        return;
    }

    if (newPass.length < 6) {
        toast.warning("New password must be at least 6 characters.");
        return;
    }

    // 1. Re-authenticate
    const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPass);

    user.reauthenticateWithCredential(credential).then(() => {
        // 2. Update Password
        return user.updatePassword(newPass);
    }).then(() => {
        toast.success("Password updated successfully!");
        togglePasswordForm(false);
    }).catch(error => {
        console.error("Error changing password:", error);
        if (error.code === 'auth/wrong-password') {
            toast.error("Current password is incorrect.");
        } else {
            toast.error("Error: " + error.message);
        }
    });
}

function submitSupport() {
    const user = firebase.auth().currentUser;
    const msgEl = document.getElementById('support-msg');
    const statusEl = document.getElementById('support-status');
    const msg = msgEl.value.trim();

    if (!msg) {
        toast.warning("Please describe your issue.");
        return;
    }

    db.collection('support_tickets').add({
        userId: user ? user.uid : 'anonymous',
        userEmail: user ? user.email : '',
        message: msg,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'open'
    }).then(() => {
        msgEl.value = "";
        statusEl.style.display = 'block';
        setTimeout(() => statusEl.style.display = 'none', 3000);
    }).catch(err => {
        toast.error("Failed to send ticket.");
    });
}

function handleForgotPassword() {
    const email = prompt("Please enter your registered email address:");
    if (email) {
        if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
            toast.warning("Please enter a valid email address.");
            return;
        }

        firebase.auth().sendPasswordResetEmail(email)
            .then(() => {
                toast.success("Password reset email sent! Please check your inbox.");
            })
            .catch((error) => {
                console.error("Error sending reset email:", error);
                if (error.code === 'auth/user-not-found') {
                    toast.error("No user found with this email address.");
                } else {
                    toast.error("Error: " + error.message);
                }
            });
    }
}
