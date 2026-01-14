
// --- ANALYTICS LOGIC ---

async function renderAnalytics() {
    const topSellingContainer = document.getElementById('analytics-top-selling');
    const leastOrderedContainer = document.getElementById('analytics-least-ordered');
    const demandContainer = document.getElementById('analytics-demand');
    const categoryContainer = document.getElementById('analytics-categories');

    // 1. Fetch All Completed Orders (Optimized: Single Fetch, In-Memory Filter)
    // For production with massive data, this should be server-side or paginated/limited.
    // For this app size, fetching all completed is fine.
    let orders = [];
    try {
        const snapshot = await db.collection('orders').where('status', '==', 'Completed').get();
        snapshot.forEach(doc => orders.push({ ...doc.data(), createdAtDate: doc.data().createdAt ? doc.data().createdAt.toDate() : new Date() }));
    } catch (e) {
        console.error("Analytics fetch error", e);
        topSellingContainer.innerHTML = '<p class="text-danger">Error loading data</p>';
        return;
    }

    // 2. Process Data
    processTopSelling(orders, topSellingContainer);
    processLeastOrdered(orders, leastOrderedContainer);
    processDemand(orders, demandContainer);r
    processCategories(orders, categoryContainer);
}

function processTopSelling(orders, container) {
    const period = document.getElementById('filter-top-selling').value;
    const now = new Date();
    let filteredOrders = orders;

    if (period === 'today') {
        filteredOrders = orders.filter(o => o.createdAtDate.toDateString() === now.toDateString());
    } else if (period === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(now.getDate() - 7);
        filteredOrders = orders.filter(o => o.createdAtDate >= weekAgo);
    } else if (period === 'month') {
        const monthAgo = new Date();
        monthAgo.setDate(now.getDate() - 30);
        filteredOrders = orders.filter(o => o.createdAtDate >= monthAgo);
    }

    const itemMap = {};

    filteredOrders.forEach(order => {
        if (order.items) {
            order.items.forEach(item => {
                if (!itemMap[item.name]) {
                    itemMap[item.name] = { name: item.name, qty: 0, revenue: 0 };
                }
                itemMap[item.name].qty += item.quantity;
                itemMap[item.name].revenue += (item.price * item.quantity);
            });
        }
    });

    const sortedItems = Object.values(itemMap).sort((a, b) => b.qty - a.qty).slice(0, 5); // Top 5

    if (sortedItems.length === 0) {
        container.innerHTML = '<p class="text-muted text-center" style="padding: 20px;">No sales in this period.</p>';
        return;
    }

    container.innerHTML = `<ul style="list-style: none; padding: 0;">` +
        sortedItems.map((item, index) => `
                    <li style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f0f0;">
                        <span><span style="font-weight: bold; margin-right: 8px; color: #888;">#${index + 1}</span> ${item.name}</span>
                        <div style="text-align: right;">
                            <span style="display: block; font-weight: 600;">${item.qty} orders</span>
                            <span style="font-size: 0.8rem; color: #888;">₹${item.revenue.toFixed(2)}</span>
                        </div>
                    </li>
                `).join('') + `</ul>`;
}

async function processLeastOrdered(orders, container) {
    const days = parseInt(document.getElementById('filter-least-ordered').value);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const recentOrders = orders.filter(o => o.createdAtDate >= cutoff);

    // Count recent sales
    const salesMap = {};
    recentOrders.forEach(order => {
        if (order.items) {
            order.items.forEach(item => {
                const name = item.name; // Normalize?
                salesMap[name] = (salesMap[name] || 0) + item.quantity;
            });
        }
    });

    // Compare with Menu
    // Need allMenuItems (already defined in global scope or need fetch?)
    // We have `allMenuItems` global but likely empty if not on menu tab?
    // Safer to re-fetch or use existing if loaded. 
    // Let's safe fetch 'food_items' and 'quick_meals'.

    let allItems = [];
    try {
        const fSnap = await db.collection('food_items').get();
        const qSnap = await db.collection('quick_meals').get();
        fSnap.forEach(d => allItems.push(d.data().name));
        qSnap.forEach(d => allItems.push(d.data().name));
    } catch (e) { console.error(e); }

    const zeroSales = allItems.filter(name => !salesMap[name]);
    const lowSales = Object.keys(salesMap).filter(name => salesMap[name] < 5).sort((a, b) => salesMap[a] - salesMap[b]); // < 5 arbitrary threshold

    const displayList = [...zeroSales.map(n => ({ name: n, count: 0 })), ...lowSales.map(n => ({ name: n, count: salesMap[n] }))].slice(0, 5);

    if (displayList.length === 0) {
        container.innerHTML = '<p class="text-success text-center">All items are performing well!</p>';
        return;
    }

    container.innerHTML = `<ul style="list-style: none; padding: 0;">` +
        displayList.map(item => `
                    <li style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f0f0;">
                         <span>${item.name}</span>
                         <span class="badge ${item.count === 0 ? 'status-cancelled' : 'status-preparing'}" 
                               style="background: ${item.count === 0 ? '#ffebee' : '#fff3cd'}; color: ${item.count === 0 ? '#c62828' : '#856404'}; padding: 2px 8px; border-radius: 10px; font-size: 0.8rem;">
                            ${item.count} orders
                         </span>
                    </li>
                `).join('') + `</ul>`;
}

function processDemand(orders, container) {
    const hours = new Array(24).fill(0);
    orders.forEach(o => {
        const h = o.createdAtDate.getHours();
        hours[h]++;
    });

    // Find Peak
    let max = -1;
    let peakHour = -1;
    hours.forEach((count, h) => {
        if (count > max) { max = count; peakHour = h; }
    });

    // Render Simple Bar Chart with CSS
    // Normalize height to 100px = max
    if (max === 0) {
        container.innerHTML = '<p class="text-muted text-center">No sufficient data.</p>';
        return;
    }

    // Show simplified: Peak Hour string + Mini Chart
    const peakTime = `${peakHour}:00 - ${peakHour + 1}:00`;

    let chartHTML = `<div style="display: flex; align-items: flex-end; height: 80px; gap: 2px; margin-top: 20px;">`;
    // Show only 8am to 10pm (business hours usually?)
    for (let i = 8; i <= 22; i++) {
        const h = (hours[i] / max) * 100; // percent height
        const bg = i === peakHour ? 'var(--primary-color)' : '#e0e0e0';
        chartHTML += `
                    <div title="${i}:00 - ${hours[i]} orders" 
                         style="flex: 1; background: ${bg}; height: ${h}%; border-radius: 2px 2px 0 0; position: relative; min-height: 2px;">
                    </div>`;
    }
    chartHTML += `</div><div style="display: flex; justify-content: space-between; font-size: 0.7rem; color: #888; margin-top: 4px;"><span>8 AM</span><span>10 PM</span></div>`;

    container.innerHTML = `
                <div style="text-align: center; margin-bottom: 10px;">
                    <span style="font-size: 0.9rem; color: #666;">Peak Hour</span>
                    <div style="font-size: 1.4rem; font-weight: bold; color: var(--primary-color);">${peakTime}</div>
                    <div style="font-size: 0.8rem; color: #888;">(${max} orders)</div>
                </div>
                ${chartHTML}
            `;
}

function processCategories(orders, container) {
    let totalItems = 0;
    const stats = { 'Meal': 0, 'Quick Snack': 0, 'Other': 0 };

    orders.forEach(o => {
        if (o.items) {
            o.items.forEach(i => {
                totalItems += i.quantity;
                // Determine Category based on item type or mapping
                // We stored 'type' in cart items? (check main.js addToCart)
                // Yes: item.type = 'meal' or 'quick'
                if (i.type === 'quick') stats['Quick Snack'] += i.quantity;
                else if (i.type === 'meal') stats['Meal'] += i.quantity;
                else stats['Other'] += i.quantity;
            });
        }
    });

    if (totalItems === 0) {
        container.innerHTML = '<p class="text-muted">No data.</p>';
        return;
    }

    const mealPct = Math.round((stats['Meal'] / totalItems) * 100);
    const snackPct = Math.round((stats['Quick Snack'] / totalItems) * 100);

    container.innerHTML = `
                <div style="margin-top: 20px;">
                    <div style="margin-bottom: 15px;">
                        <div style="display: flex; justify-content: space-between; font-size: 0.9rem; margin-bottom: 5px;">
                            <span>Meals</span>
                            <span>${stats['Meal']} (${mealPct}%)</span>
                        </div>
                        <div style="width: 100%; background: #f0f0f0; height: 10px; border-radius: 5px; overflow: hidden;">
                            <div style="width: ${mealPct}%; background: var(--primary-color); height: 100%;"></div>
                        </div>
                    </div>

                    <div>
                        <div style="display: flex; justify-content: space-between; font-size: 0.9rem; margin-bottom: 5px;">
                            <span>Quick Snacks</span>
                            <span>${stats['Quick Snack']} (${snackPct}%)</span>
                        </div>
                        <div style="width: 100%; background: #f0f0f0; height: 10px; border-radius: 5px; overflow: hidden;">
                            <div style="width: ${snackPct}%; background: #6f42c1; height: 100%;"></div>
                        </div>
                    </div>
                </div>
            `;
}
