/* === ADMIN ANALYTICS JAVASCRIPT === */

// Cache for analytics data
let analyticsCache = {
    orders: null,
    lastFetch: 0,
    menuMap: null
};

const ANALYTICS_TTL = 5 * 60 * 1000; // 5 minutes
let trendChartInstance = null;

async function renderAnalytics(forceRefresh = false) {
    const now = Date.now();

    const topSellingContainer = document.getElementById('analytics-top-selling');
    const leastOrderedContainer = document.getElementById('analytics-least-ordered');
    const demandContainer = document.getElementById('analytics-demand');
    const categoryContainer = document.getElementById('analytics-categories');
    const insightsContainer = document.getElementById('analytics-insights');

    let orders = [];

    try {
        if (forceRefresh || !analyticsCache.orders || (now - analyticsCache.lastFetch > ANALYTICS_TTL)) {

            const lastUpdated = document.getElementById('analytics-last-updated');
            if (lastUpdated) lastUpdated.innerText = 'Updating...';

            const [ordersSnap, foodSnap, quickSnap] = await Promise.all([
                db.collection('orders').where('status', '==', 'Completed').get(),
                db.collection('food_items').get(),
                db.collection('quick_meals').get()
            ]);

            orders = [];
            ordersSnap.forEach(doc => orders.push({ ...doc.data(), createdAtDate: doc.data().createdAt ? doc.data().createdAt.toDate() : new Date() }));

            const menuMap = {};
            foodSnap.forEach(doc => { const d = doc.data(); menuMap[d.name] = d; menuMap[doc.id] = d; });
            quickSnap.forEach(doc => { const d = doc.data(); menuMap[d.name] = d; menuMap[doc.id] = d; });

            analyticsCache.orders = orders;
            analyticsCache.menuMap = menuMap;
            analyticsCache.lastFetch = now;
        } else {
            orders = analyticsCache.orders;
        }

        const date = new Date(analyticsCache.lastFetch);
        const lastUpdated = document.getElementById('analytics-last-updated');
        if (lastUpdated) lastUpdated.innerText = `Last updated: ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    } catch (e) {
        console.error("Analytics fetch error", e);
        if (topSellingContainer) topSellingContainer.innerHTML = '<p class="text-danger">Error loading data. Check console.</p>';
        return;
    }

    calculateKPIs(orders);
    renderTrendChart(orders);
    processTopSelling(orders, topSellingContainer, analyticsCache.menuMap);
    processLeastOrdered(orders, leastOrderedContainer, analyticsCache.menuMap);
    processDemand(orders, demandContainer);
    processCategories(orders, categoryContainer, analyticsCache.menuMap);
    generateInsights(orders, analyticsCache.menuMap, insightsContainer);
}

function renderTrendChart(orders) {
    const ctx = document.getElementById('revenueTrendChart');
    if (!ctx) return;

    const days = [];
    const revenueData = [];
    const ordersData = [];

    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        days.push(d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' }));

        const dayStart = new Date(d.setHours(0, 0, 0, 0));
        const dayEnd = new Date(d.setHours(23, 59, 59, 999));

        const dayOrders = orders.filter(o => o.createdAtDate >= dayStart && o.createdAtDate <= dayEnd);

        const totalRev = dayOrders.reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0);
        revenueData.push(totalRev);
        ordersData.push(dayOrders.length);
    }

    if (trendChartInstance) {
        trendChartInstance.destroy();
    }

    trendChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: days,
            datasets: [
                {
                    label: 'Revenue (₹)',
                    data: revenueData,
                    borderColor: '#ff5722',
                    backgroundColor: 'rgba(255, 87, 34, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    yAxisID: 'y'
                },
                {
                    label: 'Orders',
                    data: ordersData,
                    borderColor: '#28a745',
                    backgroundColor: 'rgba(40, 167, 69, 0.1)',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    tension: 0.4,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: { position: 'top' },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.y !== null) {
                                label += context.datasetIndex === 0 ? '₹' + context.parsed.y : context.parsed.y;
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    beginAtZero: true,
                    grid: { drawOnChartArea: false }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    beginAtZero: true,
                    grid: { drawOnChartArea: false }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

function calculateKPIs(orders) {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    let thisMonthOrders = 0;
    let lastMonthOrders = 0;
    let thisMonthRevenue = 0;
    let lastMonthRevenue = 0;

    let totalOrders = orders.length;
    let totalRevenue = 0;

    orders.forEach(o => {
        const total = parseFloat(o.total || 0);
        totalRevenue += total;

        const month = o.createdAtDate.getMonth();
        const year = o.createdAtDate.getFullYear();

        if (month === currentMonth && year === currentYear) {
            thisMonthOrders++;
            thisMonthRevenue += total;
        } else if (month === lastMonth && year === lastMonthYear) {
            lastMonthOrders++;
            lastMonthRevenue += total;
        }
    });

    const avgOrderValue = totalOrders > 0 ? (totalRevenue / totalOrders) : 0;

    const uniqueDates = new Set(orders.map(o => o.createdAtDate.toDateString())).size || 1;
    const avgOrdersPerHour = totalOrders / (uniqueDates * 14);

    const kpiRevenue = document.getElementById('kpi-revenue');
    if (kpiRevenue) kpiRevenue.innerText = `₹${formatNumber(totalRevenue)}`;

    const kpiOrders = document.getElementById('kpi-orders');
    if (kpiOrders) kpiOrders.innerText = formatNumber(totalOrders);

    const kpiAov = document.getElementById('kpi-aov');
    if (kpiAov) kpiAov.innerText = `₹${Math.round(avgOrderValue)}`;

    const kpiRate = document.getElementById('kpi-rate');
    if (kpiRate) kpiRate.innerText = avgOrdersPerHour.toFixed(1);

    const revTrend = calculateTrend(thisMonthRevenue, lastMonthRevenue);
    const orderTrend = calculateTrend(thisMonthOrders, lastMonthOrders);

    const kpiRevTrend = document.getElementById('kpi-revenue-trend');
    if (kpiRevTrend) kpiRevTrend.innerHTML = formatTrend(revTrend, 'vs last mo');

    const kpiOrderTrend = document.getElementById('kpi-orders-trend');
    if (kpiOrderTrend) kpiOrderTrend.innerHTML = formatTrend(orderTrend, 'vs last mo');

    lucide.createIcons();
}

function calculateTrend(curr, prev) {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return ((curr - prev) / prev) * 100;
}

function formatTrend(percent, label) {
    const color = percent >= 0 ? '#28a745' : '#dc3545';
    const arrow = percent >= 0 ? '<i data-lucide="arrow-up" style="width:14px; height:14px;"></i>' : '<i data-lucide="arrow-down" style="width:14px; height:14px;"></i>';
    return `<span style="color: ${color}; font-weight: bold; display: inline-flex; align-items: center; gap: 2px;">${arrow} ${Math.abs(percent.toFixed(1))}%</span> ${label}`;
}

function processTopSelling(orders, container, menuMap) {
    if (!container) return;
    const periodEl = document.getElementById('filter-top-selling');
    const period = periodEl ? periodEl.value : 'month';
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
    let periodTotalRev = 0;

    filteredOrders.forEach(order => {
        if (order.items) {
            order.items.forEach(item => {
                const name = item.name || (menuMap[item.id] ? menuMap[item.id].name : 'Unknown Item');

                if (!itemMap[name]) {
                    itemMap[name] = { name: name, qty: 0, revenue: 0 };
                }
                itemMap[name].qty += item.quantity;
                const itemRev = (parseFloat(item.price) * item.quantity);
                itemMap[name].revenue += itemRev;
                periodTotalRev += itemRev;
            });
        }
    });

    const sortedItems = Object.values(itemMap).sort((a, b) => b.qty - a.qty).slice(0, 5);
    const topOneQty = sortedItems.length > 0 ? sortedItems[0].qty : 1;

    if (sortedItems.length === 0) {
        container.innerHTML = '<p class="text-muted text-center" style="padding: 20px;">No sales in this period.</p>';
        return;
    }

    container.innerHTML = `<div style="display: flex; flex-direction: column; gap: 12px;">` +
        sortedItems.map((item, index) => {
            const pct = (item.qty / topOneQty) * 100;
            return `
            <div style="display: flex; flex-direction: column; gap: 4px;">
                <div style="display: flex; justify-content: space-between; font-size: 0.9rem;">
                    <span style="font-weight: 500;">${index + 1}. ${item.name}</span>
                    <span style="font-weight: 600; color: var(--dark-color);">${item.qty} <span style="font-size: 0.75rem; color: #888; font-weight: normal;">orders</span></span>
                </div>
                <div class="progress-bg">
                    <div class="progress-fill" style="width: ${pct}%; background: var(--primary-color);"></div>
                </div>
                <div style="text-align: right; font-size: 0.75rem; color: #888;">₹${formatNumber(item.revenue)} revenue</div>
            </div>
        `;
        }).join('') + `</div>`;
}

async function processLeastOrdered(orders, container, menuMap) {
    if (!container) return;
    const daysEl = document.getElementById('filter-least-ordered');
    const days = daysEl ? parseInt(daysEl.value) : 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const recentOrders = orders.filter(o => o.createdAtDate >= cutoff);

    const salesMap = {};
    recentOrders.forEach(order => {
        if (order.items) {
            order.items.forEach(item => {
                const name = item.name || (menuMap[item.id] ? menuMap[item.id].name : 'Unknown Item');
                salesMap[name] = (salesMap[name] || 0) + item.quantity;
            });
        }
    });

    const uniqueItems = new Set(Object.values(menuMap).map(i => i.name));
    const allItems = Array.from(uniqueItems);

    const zeroSales = allItems.filter(name => !salesMap[name]);
    const lowSales = Object.keys(salesMap).filter(name => salesMap[name] < 5).sort((a, b) => salesMap[a] - salesMap[b]);

    const displayList = [...zeroSales.map(n => ({ name: n, count: 0 })), ...lowSales.map(n => ({ name: n, count: salesMap[n] }))].slice(0, 5);

    if (displayList.length === 0) {
        container.innerHTML = '<p class="text-success text-center" style="padding: 20px;">All items are performing well!</p>';
        return;
    }

    container.innerHTML = `<ul style="list-style: none; padding: 0;">` +
        displayList.map(item => `
                <li style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #f0f0f0;">
                        <span style="font-weight: 500; color: #555;">${item.name}</span>
                        <span style="background: ${item.count === 0 ? '#ffebee' : '#fff3cd'}; color: ${item.count === 0 ? '#c62828' : '#856404'}; padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 600;">
                            ${item.count === 0 ? 'NO ORDERS' : item.count + ' orders'}
                        </span>
                </li>
            `).join('') + `</ul>`;
}

function processDemand(orders, container) {
    if (!container) return;
    const hours = new Array(24).fill(0);
    const dayCounts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };

    orders.forEach(o => {
        const h = o.createdAtDate.getHours();
        const d = o.createdAtDate.getDay();
        hours[h]++;
        dayCounts[d]++;
    });

    let max = 0;
    let peakHour = 0;
    hours.forEach((count, h) => { if (count > max) { max = count; peakHour = h; } });

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    let maxDay = 0;
    let peakDayIndex = 0;
    Object.keys(dayCounts).forEach(d => { if (dayCounts[d] > maxDay) { maxDay = dayCounts[d]; peakDayIndex = d; } });

    if (max === 0) { container.innerHTML = '<p class="text-muted text-center">No data.</p>'; return; }

    const peakTime = `${peakHour}:00 - ${peakHour + 1}:00`;

    let chartHTML = `<div style="display: flex; align-items: flex-end; height: 100px; gap: 3px; margin-top: 20px;">`;
    for (let i = 8; i <= 21; i++) {
        const h = (hours[i] / max) * 100;
        const isPeak = i === peakHour;
        chartHTML += `
                <div title="${i}:00 - ${hours[i]} orders" 
                        style="flex: 1; background: ${isPeak ? 'var(--primary-color)' : '#e9ecef'}; height: ${h || 2}%; border-radius: 4px 4px 0 0; position: relative;">
                </div>`;
    }
    chartHTML += `</div><div style="display: flex; justify-content: space-between; font-size: 0.7rem; color: #888; margin-top: 6px;"><span>8 AM</span><span>9 PM</span></div>`;

    container.innerHTML = `
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px; align-items: flex-end;">
                <div>
                    <div style="font-size: 0.8rem; color: #888; text-transform: uppercase;">Busiest Hour</div>
                    <div style="font-size: 1.2rem; font-weight: bold; color: var(--primary-color);">${peakTime}</div>
                </div>
                <div style="text-align: right;">
                        <div style="font-size: 0.8rem; color: #888; text-transform: uppercase;">Peak Load</div>
                        <div style="font-weight: 600;">${max} orders</div>
                </div>
            </div>
            ${chartHTML}
        `;

    const dayContainer = document.getElementById('analytics-peak-day');
    if (dayContainer) {
        const dayPct = orders.length > 0 ? Math.round((maxDay / orders.length) * 100) : 0;
        dayContainer.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <div style="background: #e3f2fd; color: #0d47a1; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold;">
                ${dayPct}%
            </div>
            <div>
                <div style="font-weight: 600; color: #333;">${days[peakDayIndex]} is your busiest day</div>
                <div style="font-size: 0.8rem; color: #666;">${maxDay} total orders</div>
            </div>
        </div>
    `;
    }
}

function processCategories(orders, container, menuMap) {
    if (!container) return;
    let totalItems = 0;
    const stats = { 'Meal': 0, 'Quick Snack': 0, 'Other': 0 };

    orders.forEach(o => {
        if (o.items) {
            o.items.forEach(i => {
                totalItems += i.quantity;
                let type = i.type;
                if (!type) {
                    const dictItem = menuMap[i.name] || menuMap[i.id];
                    type = dictItem ? dictItem.type : 'meal';
                }

                if (type === 'quick') stats['Quick Snack'] += i.quantity;
                else if (type === 'meal') stats['Meal'] += i.quantity;
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

function generateInsights(orders, menuMap, container) {
    if (!container) return;

    const insights = [];

    const hours = new Array(24).fill(0);
    orders.forEach(o => hours[o.createdAtDate.getHours()]++);
    const maxOrder = Math.max(...hours);
    let peakH = hours.indexOf(maxOrder);

    if (maxOrder > 0) {
        if (peakH >= 11 && peakH <= 14) insights.push({ icon: 'flame', text: "Lunch hours (11AM-2PM) see the highest traffic. Ensure staff is ready." });
        else if (peakH >= 17 && peakH <= 20) insights.push({ icon: 'sunset', text: "Evening snacks drive your peak sales." });
        else insights.push({ icon: 'clock', text: `Peak activity detected around ${peakH}:00.` });
    }

    const daysArr = orders.map(o => o.createdAtDate.getDay());
    const dayCounts = [0, 0, 0, 0, 0, 0, 0];
    daysArr.forEach(d => dayCounts[d]++);
    const minDay = dayCounts.indexOf(Math.min(...dayCounts));
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    if (orders.length > 10 && dayCounts[minDay] < (orders.length / 7) * 0.5) {
        insights.push({ icon: 'trending-down', text: `${dayNames[minDay]}s have very low orders. Consider running a "Happy Hour" promo.` });
    }

    let mealCount = 0; let snackCount = 0;
    orders.forEach(o => {
        if (o.items) o.items.forEach(i => {
            let type = i.type;
            if (!type) {
                const dictItem = menuMap[i.name] || menuMap[i.id];
                type = dictItem ? dictItem.type : 'meal';
            }
            if (type === 'quick') snackCount++; else mealCount++;
        });
    });

    if (snackCount > mealCount * 1.5) insights.push({ icon: 'coffee', text: "Snacks are outselling meals significantly. Consider adding more combo snack options." });
    if (mealCount > snackCount * 2) insights.push({ icon: 'utensils', text: "Full meals are your core driver. Focus on upsizing meal portions." });

    if (insights.length === 0) insights.push({ icon: 'check-circle', text: "Operations look steady. Keep monitoring trends!" });

    container.innerHTML = insights.map(item => `
    <div class="insight-item" style="display: flex; gap: 10px; align-items: flex-start; margin-bottom: 10px; padding: 10px; background: #f8f9fa; border-radius: 8px;">
        <span class="text-primary"><i data-lucide="${item.icon}"></i></span>
        <span style="font-size: 0.9rem; color: #555;">${item.text}</span>
    </div>
`).join('');
    lucide.createIcons();
}
