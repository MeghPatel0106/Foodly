
// User Analytics Logic

function initAnalytics() {
    const user = firebase.auth().currentUser;
    if (!user) {
        setTimeout(initAnalytics, 500);
        return;
    }

    loadAnalyticsData(user.uid);
}

// Data Fetching
// Data Fetching
async function loadAnalyticsData(userId) {
    // 1. Fetch Orders (Fresh Fetch - Detailed History)
    let orders = [];
    try {
        const snapshot = await db.collection('orders')
            .where('userId', '==', userId)
            // .limit(50) // Removed limit for accurate stats
            .get();

        snapshot.forEach(doc => {
            const data = doc.data();
            orders.push({ id: doc.id, ...data });
        });

        // Sort Descending (Newest First)
        orders.sort((a, b) => {
            const dA = a.createdAt ? (a.createdAt.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt).getTime()) : 0;
            const dB = b.createdAt ? (b.createdAt.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt).getTime()) : 0;
            return dB - dA;
        });

    } catch (error) {
        console.error("Orders fetch error:", error);
    }

    // 2. Extract Feedback from Completed Orders
    // We already have the orders, simply filter them client-side to find those with feedback
    let feedbacks = [];
    orders.forEach(order => {
        if (order.feedbackSubmitted === true && order.feedback) {
            feedbacks.push({
                rating: order.feedback.rating,
                comment: order.feedback.comment,
                createdAt: order.feedback.createdAt || order.createdAt // Fallback timestamp
            });
        }
    });

    // 3. Process & Render
    processAnalytics(orders, feedbacks);
}

function processAnalytics(orders, feedbacks) {
    if (!orders) orders = [];
    if (!feedbacks) feedbacks = [];

    renderFrequency(orders);
    renderFavorites(orders);
    renderCategoryPref(orders);
    renderTimePattern(orders);
    renderFeedbackStats(feedbacks);
}

// --- FEATURE 1: ORDER FREQUENCY ---
function renderFrequency(orders) {
    // Calculate This Week & This Month
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Get start of week (Sunday)
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    let weekCount = 0;
    let monthCount = 0;

    orders.forEach(o => {
        if (o.status === 'Cancelled') return;

        const d = getDateObject(o.createdAt);
        if (!d) return;

        // Month Check
        if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
            monthCount++;
        }

        // Week Check
        if (d >= startOfWeek) {
            weekCount++;
        }
    });

    safeSetText('freq-week', weekCount);
    safeSetText('freq-month', monthCount);
}

// --- FEATURE 2: FAVORITE ITEMS ---
function renderFavorites(orders) {
    const itemMap = new Map();

    orders.forEach(o => {
        if (o.status === 'Cancelled' || !o.items) return;
        o.items.forEach(item => {
            const name = item.name;
            const count = itemMap.get(name) || 0;
            itemMap.set(name, count + 1);
        });
    });

    // Sort by count desc
    const sorted = [...itemMap.entries()].sort((a, b) => b[1] - a[1]);
    const top3 = sorted.slice(0, 3);

    const listEl = document.getElementById('fav-items-list');
    if (!listEl) return;

    if (top3.length === 0) {
        listEl.innerHTML = '<div class="text-muted text-sm">No favorite items yet.</div>';
        return;
    }

    listEl.innerHTML = top3.map(([name, count]) => `
        <div class="fav-item-row">
            <span class="fav-name">${name}</span>
            <span class="fav-count">${count} orders</span>
        </div>
    `).join('');
}

// --- FEATURE 3: CATEGORY PREFERENCE (SPENDING SPLIT) ---
function renderCategoryPref(orders) {
    let mealSpend = 0;
    let snackSpend = 0;

    orders.forEach(o => {
        if (o.status === 'Cancelled' || !o.items) return;
        o.items.forEach(item => {
            const price = Number(item.price) || 0;
            const lineTotal = price * (item.quantity || 1);

            if (item.type === 'quick' || item.type === 'snack') {
                snackSpend += lineTotal;
            } else {
                mealSpend += lineTotal;
            }
        });
    });

    const totalSpend = mealSpend + snackSpend;
    const displayTotal = totalSpend === 0 ? 1 : totalSpend;

    // Percentages based on SPEND
    const mealPct = Math.round((mealSpend / displayTotal) * 100);
    const snackPct = Math.round((snackSpend / displayTotal) * 100);

    safeSetText('pref-meal-pct', `${mealPct}%`);
    safeSetText('pref-snack-pct', `${snackPct}%`);

    // Update Progress Bar
    const bar = document.getElementById('pref-bar-fill');
    if (bar) {
        bar.style.width = `${mealPct}%`;
    }

    // EXPOSE: Meal vs Snack Data
    window.analyticsData = window.analyticsData || {};
    window.analyticsData.spendingSplit = { meal: mealSpend, snack: snackSpend, mealPct, snackPct };
}

// --- FEATURE 4: TIME PATTERN (DISTRIBUTION) ---
function renderTimePattern(orders) {
    const buckets = {
        'Morning': 0,   // 5 - 11
        'Afternoon': 0, // 12 - 16
        'Evening': 0,   // 17 - 20
        'Night': 0      // 21 - 4
    };

    let totalCount = 0;

    orders.forEach(o => {
        if (o.status === 'Cancelled') return;
        const d = getDateObject(o.createdAt);
        if (!d) return;

        const h = d.getHours();

        // Strict categorization
        if (h >= 5 && h < 12) buckets['Morning']++;
        else if (h >= 12 && h < 17) buckets['Afternoon']++;
        else if (h >= 17 && h < 21) buckets['Evening']++;
        else buckets['Night']++; // Covers 21-23 and 0-4 (and gaps defaults to Night)

        totalCount++;
    });

    // Find Dominant
    let maxLabel = 'None';
    let maxVal = -1;

    for (const [label, val] of Object.entries(buckets)) {
        if (val > maxVal) {
            maxVal = val;
            maxLabel = label;
        }
    }

    if (maxVal === 0) maxLabel = "No Data";

    safeSetText('time-pattern', maxLabel);

    // EXPOSE: Time Distribution
    window.analyticsData = window.analyticsData || {};
    const distribution = {};
    for (const [k, v] of Object.entries(buckets)) {
        distribution[k] = totalCount > 0 ? ((v / totalCount) * 100).toFixed(1) + '%' : '0%';
    }
    window.analyticsData.timeDistribution = { buckets, distribution, total: totalCount };
}

// --- FEATURE 5: FEEDBACK SUMMARY & TREND ---
function renderFeedbackStats(feedbacks) {
    const count = feedbacks.length;
    let totalRating = 0;

    // Sort feedbacks by date desc if not already
    // Assuming feedbacks might not be sorted
    // We need logic to sort if we want trend, but typically firestore returns predictable order or we sort manually?
    // Let's assume passed feedbacks need sorting for trend.
    // However, existing code didn't sort. Let's sort for Trend.
    // We need timestamp. If not present, we can't sort accurately. 
    // Assuming feedbacks have 'createdAt'.

    // Calculate Average
    feedbacks.forEach(f => {
        totalRating += Number(f.rating || 0);
    });

    const avg = count > 0 ? (totalRating / count).toFixed(1) : "0.0";

    safeSetText('feedback-count', count);
    safeSetText('feedback-avg', avg);

    // CALCULATE TREND (Last 5)
    // 1. Sort
    const sortedFeedbacks = [...feedbacks].sort((a, b) => {
        const dA = a.createdAt ? (a.createdAt.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt).getTime()) : 0;
        const dB = b.createdAt ? (b.createdAt.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt).getTime()) : 0;
        return dB - dA; // Newest first
    });

    const last5 = sortedFeedbacks.slice(0, 5); // Newest 5
    // To see trend, we look at sequence: Newest (idx 0) vs Oldest (idx 4)
    // Or linear regression?
    // Simple logic: Compare Moving Avg or recent vs old.
    // "Determine trend: Improving, Declining, Stable"

    let trend = 'Stable';
    if (last5.length >= 2) {
        // Compare newest half vs oldest half of the 5
        // e.g. [5, 5, 4, 3, 2] -> Improving (Newer are higher)
        // e.g. [2, 3, 4, 5, 5] -> Declining (Newer are lower)

        const recent = last5.slice(0, Math.ceil(last5.length / 2));
        const older = last5.slice(Math.ceil(last5.length / 2));

        const avgRecent = recent.reduce((sum, f) => sum + Number(f.rating || 0), 0) / recent.length;
        const avgOlder = older.reduce((sum, f) => sum + Number(f.rating || 0), 0) / older.length;

        if (avgRecent > avgOlder + 0.5) trend = 'Improving';
        else if (avgRecent < avgOlder - 0.5) trend = 'Declining';
    }

    // EXPOSE
    window.analyticsData = window.analyticsData || {};
    window.analyticsData.feedbackTrend = trend;
}

// --- NEW DATA COMPUTATION (Expose Only) ---
function computeAndExposeNewData(orders) {
    // 1. Total Spent This Month
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let totalSpentMonth = 0;
    let totalOrderValue = 0;
    let completedOrderCount = 0;

    orders.forEach(o => {
        if (o.status === 'Cancelled' || o.status === 'Unpaid') return;

        const val = Number(o.total) || 0;
        const d = getDateObject(o.createdAt);

        // Month Spend
        if (d && d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
            totalSpentMonth += val;
        }

        // Avg Order Calc (On all valid orders)
        totalOrderValue += val;
        completedOrderCount++;
    });

    // 2. Average Order Value
    const avgOrderValue = completedOrderCount > 0 ? (totalOrderValue / completedOrderCount).toFixed(2) : "0.00";

    // EXPOSE
    window.analyticsData = window.analyticsData || {};
    window.analyticsData.totalSpentThisMonth = totalSpentMonth.toFixed(2);
    window.analyticsData.averageOrderValue = avgOrderValue;

    console.log("Analytics Updated:", window.analyticsData);
}

// UPDATE PROCESS FUNCTION TO CALL NEW LOGIC
const originalProcess = processAnalytics;
processAnalytics = function (orders, feedbacks) {
    // Initialize exposed object
    window.analyticsData = {};

    // Run original renders (which we modified above)
    // Actually, we replaced the functions above, so just calling them works IF we didn't rename them.
    // But wait, the previous code block REPLACED these functions in the file.
    // We just need to ensure `processAnalytics` calls `computeAndExposeNewData` too.

    // Re-implement the body of processAnalytics to allow adding the hook
    if (!orders) orders = [];
    if (!feedbacks) feedbacks = [];

    renderFrequency(orders);
    renderFavorites(orders);
    renderCategoryPref(orders); // Modified
    renderTimePattern(orders);  // Modified
    renderFeedbackStats(feedbacks); // Modified

    computeAndExposeNewData(orders); // New
};


// --- UTILITIES ---

function getDateObject(strOrObj) {
    if (!strOrObj) return null;
    // Handle Firestore Timestamp
    if (typeof strOrObj.toDate === 'function') return strOrObj.toDate();
    if (typeof strOrObj.toMillis === 'function') return new Date(strOrObj.toMillis());
    // Handle Serialized {seconds: ...}
    if (strOrObj.seconds) return new Date(strOrObj.seconds * 1000);
    // Handle String
    const d = new Date(strOrObj);
    if (!isNaN(d.getTime())) return d;
    return null;
}

function safeSetText(id, text) {
    const el = document.getElementById(id);
    if (el) el.innerText = text;
}

// Auto-Init
document.addEventListener('DOMContentLoaded', () => {
    // Wait for main.js / Auth
    setTimeout(initAnalytics, 1000);
});
