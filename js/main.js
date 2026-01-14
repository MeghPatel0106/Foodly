// Foodly Main Logic

// --- State ---
let cart = []; // Initialize empty, load after auth
let activeCategory = 'all';

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
        }
        updateCartBadge();
        // meaningful update if on cart page
        if (typeof renderCartPage === 'function') {
            renderCartPage();
        }
    });
}

function updateCartBadge() {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const badge = document.getElementById('cart-count');
    const mobileBadge = document.getElementById('mobile-cart-count');
    const mobileBtn = document.getElementById('mobile-cart-btn');

    if (badge) {
        badge.innerText = totalItems;
        badge.style.display = totalItems > 0 ? '' : 'none';
    }
    if (mobileBadge) {
        mobileBadge.innerText = totalItems;
        mobileBadge.style.display = totalItems > 0 ? '' : 'none';
    }

    if (mobileBtn) {
        mobileBtn.style.display = totalItems > 0 ? 'block' : 'none';
    }
}

function addToCart(itemId, name, price, image, type = 'meal') {
    const user = firebase.auth().currentUser;
    if (!user) {
        alert("Please login to add items to your cart.");
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

    const existingItem = cart.find(i => i.id === itemId);

    if (existingItem) {
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
        btn.innerHTML = '✓';
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
// Global User Data
let userFavourites = [];

function toggleFavourite(itemId) {
    const user = firebase.auth().currentUser;
    if (!user) {
        alert("Please login to save favourites!");
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
function initFavourites(user) {
    const cached = localStorage.getItem(`foodly_favs_${user.uid}`);
    if (cached) {
        userFavourites = JSON.parse(cached);
        // Render immediately with cached data
        if (document.getElementById('menu-grid')) renderMenu();
        if (document.getElementById('quick-meals-grid')) renderQuickMenu();
    }
}



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

    container.innerHTML = items.map(item => {
        const isFav = userFavourites.includes(item.id);
        return `
        <div class="meal-card animate-fade-in">
            <div class="meal-img-box">
                <img src="${item.image}" alt="${item.name}" onerror="this.src='https://via.placeholder.com/300x200?text=Food'">
                <button class="meal-fav-btn" onclick="toggleFavourite('${item.id}')">
                    ${isFav ? '❤️' : '🤍'}
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
}

// Search Listener
const searchInput = document.getElementById('searchInput');
if (searchInput) {
    searchInput.addEventListener('input', renderMenu);
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
                    <img src="${item.image}" alt="${item.name}" class="cart-item-img">
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

        // Unique ID for this section's QR
        const qrCanvasId = `qr-${orderType}`;

        return `
            <div class="cart-section" style="margin-bottom: 0; background: #fff; padding: 1.5rem; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); flex: 1; min-width: 300px;">
                <h3 style="margin-bottom: 1rem; border-bottom: 1px solid #eee; padding-bottom: 0.5rem;">${title}</h3>
                <div class="cart-list">
                    ${listHtml}
                </div>
                <div style="margin-top: 1rem; display: flex; justify-content: space-between; align-items: center; font-weight: 700;">
                    <span>Total:</span>
                    <span style="font-size: 1.2rem; color: var(--primary-color);">₹${sectionTotal.toFixed(2)}</span>
                </div>



                <button onclick="submitOrder('${orderType}')" class="btn btn-primary" style="width: 100%; margin-top: 1rem;">
                    ${btnLabel}
                </button>
            </div>
        `;
    };

    let sectionsHtml = '';
    sectionsHtml += renderSection('🍛 MEALS SECTION', meals, 'meal', 'Place Meal Order');
    sectionsHtml += renderSection('🍟 QUICK SNACKS SECTION', snacks, 'quick-snack', 'Place Quick Snack Order');

    container.innerHTML = `<div style="display: flex; gap: 2rem; flex-wrap: wrap; align-items: flex-start;">${sectionsHtml}</div>`;

    // Initialize QR Codes after rendering

}

function updateQty(itemId, change) {
    const item = cart.find(i => i.id === itemId);
    if (!item) return;

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
        alert("Please log in to place an order.");
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
        alert("Failed to place order. Please try again.");
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
        window.location.href = 'index.html';
    }).catch((error) => {
        console.error('Logout error:', error);
        alert('Error logging out');
    });
}

function updateSidebarAuthUI(user) {
    const authBtn = document.getElementById('sidebar-auth-btn');
    const authText = document.getElementById('sidebar-auth-text');
    const authIcon = document.getElementById('sidebar-auth-icon');

    if (!authBtn) return;

    if (user) {
        // LOGGED IN: Show Logout
        if (authText) authText.innerText = "Logout";
        authBtn.onclick = logout;
        authBtn.classList.add('text-danger');
        authBtn.style.color = '#ef4444';
        if (authIcon) authIcon.innerHTML = '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line>';
    } else {
        // GUEST: Show Login
        if (authText) authText.innerText = "Login";
        authBtn.onclick = () => window.location.href = 'index.html';
        authBtn.classList.remove('text-danger');
        authBtn.style.color = 'var(--primary-color)';
        if (authIcon) authIcon.innerHTML = '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line>';
    }
}

// --- Profile Logic (Centralized) ---

const AVATARS = [
    "https://cdn-icons-png.flaticon.com/512/4140/4140048.png",
    "https://cdn-icons-png.flaticon.com/512/4140/4140037.png",
    "https://cdn-icons-png.flaticon.com/512/4140/4140047.png",
    "https://cdn-icons-png.flaticon.com/512/4140/4140051.png",
    "https://cdn-icons-png.flaticon.com/512/4140/4140040.png",
    "https://cdn-icons-png.flaticon.com/512/4140/4140039.png"
];
// Default transparent silhouette or generic user icon
const DEFAULT_AVATAR = "https://cdn-icons-png.flaticon.com/512/1077/1077114.png";
let selectedAvatar = "";
let isProfileMandatory = false;

function initProfileListener() {
    // 1. IMMEDIATE LOAD from Cache (Fixes lagging)
    const cachedAvatar = localStorage.getItem('cachedAvatar');
    if (cachedAvatar) {
        updateNavbarAvatar(cachedAvatar);
    }

    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            // Initialize Favourites from Cache first
            initFavourites(user);

            db.collection('users').doc(user.uid).get().then(doc => {
                if (doc.exists) {
                    const data = doc.data();

                    // Sync Favourites (And update cache)
                    if (data.favourites) {
                        userFavourites = data.favourites;
                        localStorage.setItem(`foodly_favs_${user.uid}`, JSON.stringify(userFavourites));
                        // Optimistic update if needed, though initFavourites handled it
                        if (document.getElementById('menu-grid')) renderMenu();
                        if (document.getElementById('quick-meals-grid')) renderQuickMenu();
                    }

                    // Redirect Admin to Admin Panel
                    if (data.role === 'admin' && !window.location.href.includes('admin.html')) {
                        window.location.href = 'admin.html';
                        return;
                    }

                    // Protect Admin Panel: Kick out non-admins
                    if (window.location.href.includes('admin.html') && data.role !== 'admin') {
                        window.location.href = 'menu.html';
                        return;
                    }

                    // Update Top Nav Info (Robust Fallback)
                    // Use Firestore data, or Auth data, or default
                    const pName = data.name || user.displayName || 'User';
                    const pEmail = data.email || user.email || '';
                    updateTopNavInfo(pName, pEmail);

                    // Update Avatar
                    const pAvatar = data.avatar || user.photoURL || null;
                    if (pAvatar) {
                        localStorage.setItem('cachedAvatar', pAvatar);
                        updateNavbarAvatar(pAvatar);
                    }

                    // Check if we need to setup profile
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
                    // Doc doesn't exist? Use basic Auth data
                    updateTopNavInfo(user.displayName || 'User', user.email || '');
                    if (user.photoURL) updateNavbarAvatar(user.photoURL);
                }
            });
        }
    });
}

function updateNavbarAvatar(url) {
    const finalUrl = url || DEFAULT_AVATAR;

    // Sidebar Avatar
    const img = document.getElementById('nav-avatar-img');
    if (img) {
        img.src = finalUrl;
        img.style.display = 'block';
    }

    // Top Nav Avatar
    const topImg = document.getElementById('top-nav-avatar');
    if (topImg) {
        topImg.src = finalUrl;
    }
}

function updateTopNavInfo(name, email) {
    const nameEl = document.getElementById('top-nav-name');
    const emailEl = document.getElementById('top-nav-email');

    if (nameEl) nameEl.innerText = name || 'User';
    if (emailEl) emailEl.innerText = email || '';
}

function openProfile(mandatory = false) {
    const user = firebase.auth().currentUser;
    if (!user) return;

    isProfileMandatory = mandatory;
    const closeBtn = document.querySelector('.close-btn');

    // Manage Close Button visibility based on mandatory flag
    if (closeBtn) {
        closeBtn.style.display = mandatory ? 'none' : 'block';
    }

    const modal = document.getElementById('profile-modal');
    if (!modal) return; // Guard if modal HTML missing on page

    const grid = document.getElementById('avatar-grid');

    // Populate avatars if empty
    if (grid && grid.children.length === 0) {
        grid.innerHTML = AVATARS.map(url =>
            `<img src="${url}" class="avatar-option" onclick="selectAvatar('${url}')" id="avatar-${url.slice(-8)}">`
        ).join('');
    }

    // Fetch User Data to populate form
    // Fetch User Data to populate form
    db.collection('users').doc(user.uid).get().then(doc => {
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val || "";
        };

        if (doc.exists) {
            const data = doc.data();
            // Sync Favourites
            if (data.favourites) {
                userFavourites = data.favourites;
                // Update Cache
                localStorage.setItem(`foodly_favs_${user.uid}`, JSON.stringify(userFavourites));

                // Re-render
                if (document.getElementById('menu-grid')) renderMenu();
                if (document.getElementById('quick-meals-grid')) renderQuickMenu();
            }

            setVal('profile-name', data.name || user.displayName);
            setVal('profile-email', data.email || user.email);
            setVal('profile-phone', data.phoneNumber || user.phoneNumber);
            setVal('profile-gender', data.gender);

            if (data.avatar) {
                selectAvatar(data.avatar);
            } else {
                // Show Auth photo if available, else default
                if (user.photoURL) {
                    const preview = document.getElementById('avatar-preview');
                    if (preview) preview.src = user.photoURL;
                    selectedAvatar = user.photoURL;
                    document.querySelectorAll('.avatar-option').forEach(img => img.classList.remove('selected'));
                } else {
                    const preview = document.getElementById('avatar-preview');
                    if (preview) preview.src = DEFAULT_AVATAR;
                    selectedAvatar = "";
                }
            }
        } else {
            // New User / No Firestore Doc yet
            setVal('profile-name', user.displayName);
            setVal('profile-email', user.email);
            setVal('profile-phone', user.phoneNumber);

            // Set Default Avatar
            const preview = document.getElementById('avatar-preview');
            if (preview) preview.src = DEFAULT_AVATAR;
            selectedAvatar = "";
            document.querySelectorAll('.avatar-option').forEach(img => img.classList.remove('selected'));
        }
    });

    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('show'), 10);
}

function closeProfile() {
    if (isProfileMandatory) return;

    const modal = document.getElementById('profile-modal');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => modal.style.display = 'none', 300);
    }
}

function selectAvatar(url) {
    selectedAvatar = url;
    const preview = document.getElementById('avatar-preview');
    if (preview) preview.src = url;

    document.querySelectorAll('.avatar-option').forEach(img => {
        if (img.src === url) img.classList.add('selected');
        else img.classList.remove('selected');
    });
}

async function saveProfile() {
    const user = firebase.auth().currentUser;
    if (!user) return;

    const name = document.getElementById('profile-name').value;
    const phone = document.getElementById('profile-phone').value;
    const gender = document.getElementById('profile-gender').value;

    if (!name || !phone || !gender) {
        alert("Please fill in all details (Name, Phone, and Gender).");
        return;
    }
    if (!selectedAvatar) {
        alert("Please select an avatar.");
        return;
    }

    try {
        const newData = {
            name: name,
            phoneNumber: phone,
            gender: gender,
            avatar: selectedAvatar
        };

        // 1. Sync to Auth Profile (Important for Fallbacks)
        await user.updateProfile({
            displayName: name,
            photoURL: selectedAvatar
        });

        // 2. Save to Firestore (Merge to create if missing)
        await db.collection('users').doc(user.uid).set(newData, { merge: true });


        // Update UI and Cache
        updateNavbarAvatar(selectedAvatar);
        updateTopNavInfo(name, user.email);
        localStorage.setItem('cachedAvatar', selectedAvatar);

        // EXTRA: Update Dashboard Welcome if on dashboard
        const welcomeEl = document.getElementById('dash-welcome');
        if (welcomeEl) {
            const firstName = name.trim().split(/\s+/)[0];
            welcomeEl.innerText = `Welcome back, ${firstName}!`;
        }

        isProfileMandatory = false;
        closeProfile();
        // Optional: nice feedback
        // alert("Profile updated!"); 
    } catch (error) {
        console.error("Error updating profile:", error);
        alert("Failed to update profile.");
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

    // If already loaded, just render
    if (quickFoodItems.length > 0) {
        renderQuickCategories();
        renderQuickMenu();
        return;
    }

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
                <img src="${item.image || 'https://via.placeholder.com/150'}" alt="${item.name}" onerror="this.src='https://via.placeholder.com/150'">
                <button class="meal-fav-btn" onclick="toggleFavourite('${item.id}')">
                    ${isFav ? '❤️' : '🤍'}
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
}

// Initialize Cart listener
initCartListener();

// --- ORDERS LOGIC ---
function renderOrders(userId) {
    const container = document.getElementById('orders-list');
    if (!container) return; // Guard clause for non-order pages

    // 1. CACHE READ
    const cacheKey = `cachedOrders_${userId}`;
    const cachedData = localStorage.getItem(cacheKey);

    // Only use cache if we have it and it's not "empty" state
    if (cachedData) {
        const orders = JSON.parse(cachedData);
        if (orders.length > 0 && typeof generateOrdersHTML === 'function') {
            container.innerHTML = generateOrdersHTML(orders);
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

            // Render
            if (orders.length === 0) {
                container.innerHTML = `
                    <div class="text-center text-muted" style="margin-top: 4rem;">
                        <p>No orders yet.</p>
                        <a href="menu.html" style="color: var(--primary-color)">Start ordering</a>
                    </div>
                `;
            } else {
                if (typeof generateOrdersHTML === 'function') {
                    container.innerHTML = generateOrdersHTML(orders);
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
        alert("Failed to save settings.");
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
        alert("Please fill in all fields.");
        return;
    }

    if (newPass !== confirmPass) {
        alert("New passwords do not match.");
        return;
    }

    if (newPass.length < 6) {
        alert("New password must be at least 6 characters long.");
        return;
    }

    // 1. Re-authenticate
    const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPass);

    user.reauthenticateWithCredential(credential).then(() => {
        // 2. Update Password
        return user.updatePassword(newPass);
    }).then(() => {
        alert("Password updated successfully!");
        togglePasswordForm(false);
    }).catch(error => {
        console.error("Error changing password:", error);
        if (error.code === 'auth/wrong-password') {
            alert("Current password is incorrect.");
        } else {
            alert("Error: " + error.message);
        }
    });
}

function submitSupport() {
    const user = firebase.auth().currentUser;
    const msgEl = document.getElementById('support-msg');
    const statusEl = document.getElementById('support-status');
    const msg = msgEl.value.trim();

    if (!msg) {
        alert("Please describe your issue.");
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
        alert("Failed to send ticket.");
    });
}

function handleForgotPassword() {
    const email = prompt("Please enter your registered email address:");
    if (email) {
        if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
            alert("Please enter a valid email address.");
            return;
        }

        firebase.auth().sendPasswordResetEmail(email)
            .then(() => {
                alert("Password reset email sent! Please check your inbox.");
            })
            .catch((error) => {
                console.error("Error sending reset email:", error);
                if (error.code === 'auth/user-not-found') {
                    alert("No user found with this email address.");
                } else {
                    alert("Error: " + error.message);
                }
            });
    }
}
