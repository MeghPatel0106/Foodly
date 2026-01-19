/* === ADMIN ORDER HISTORY JAVASCRIPT === */

function initHistoryOrdersListener() {
    const historyTbody = document.getElementById('history-orders-table-body');
    if (!historyTbody) return;

    db.collection('orders')
        .where('status', '==', 'Completed')
        .limit(100)
        .onSnapshot((snapshot) => {
            let orders = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                if (!data.adminHidden) {
                    orders.push({ id: doc.id, ...data });
                }
            });

            orders.sort((a, b) => {
                const dateA = a.createdAt ? a.createdAt.toMillis() : 0;
                const dateB = b.createdAt ? b.createdAt.toMillis() : 0;
                return dateB - dateA;
            });

            window.cachedHistoryOrders = orders;
            renderHistoryOrders(orders);
        }, (error) => {
            console.error("Error fetching history orders:", error);
            historyTbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Error loading history orders</td></tr>`;
        });
}

async function renderHistoryOrders(orders) {
    const tbody = document.getElementById('history-orders-table-body');
    if (!tbody) return;

    if (orders.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No completed orders</td></tr>`;
        return;
    }

    const ordersWithNames = await Promise.all(orders.map(async (order) => {
        let displayName = order.customerName || order.userName || order.name;

        if (!displayName && order.userId) {
            try {
                const userDoc = await db.collection('users').doc(order.userId).get();
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    displayName = userData.name || userData.email.split('@')[0];
                }
            } catch (e) {
                console.warn('Failed to fetch user name', e);
            }
        }

        if (!displayName && order.userId) displayName = "User " + order.userId.slice(0, 6);
        if (!displayName) displayName = "Guest";

        return { ...order, displayName };
    }));

    tbody.innerHTML = ordersWithNames.map(order => {
        const itemsSummary = order.items
            ? order.items.map(i => `${i.quantity}x ${i.name}`).join(', ')
            : 'No items';

        return `
        <tr>
            <td data-label="Order ID" class="font-bold">${order.orderNumber || order.id}</td>
            <td data-label="Ordered By"><span>${order.displayName}</span></td>
            <td data-label="Items"><span class="text-sm text-muted" style="max-width: 200px; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${itemsSummary}">${itemsSummary}</span></td>
            <td data-label="Status"><span class="status-badge ${getStatusClass(order.status)}">${order.status}</span></td>
            <td data-label="Total">₹${Number(order.total).toFixed(2)}</td>
            <td data-label="Actions">
                <button class="action-btn" style="background: #fee2e2; color: #dc2626;" onclick="deleteOrder('${order.id}')">Delete</button>
            </td>
        </tr>
    `}).join('');
}

async function deleteOrder(orderId) {
    if (!confirm("Are you sure you want to remove this order from history? Revenue stats will remain affected.")) {
        return;
    }

    db.collection('orders').doc(orderId).update({
        adminHidden: true
    })
        .then(() => {
            // Real-time listener handles UI removal
        })
        .catch(error => {
            console.error("Error deleting order:", error);
            alert("Failed to delete order");
        });
}

async function clearAdminHistory() {
    if (!confirm("Are you sure you want to DELETE ALL completed order history? This cannot be undone.")) {
        return;
    }

    try {
        const snapshot = await db.collection('orders')
            .where('status', '==', 'Completed')
            .get();

        if (snapshot.empty) {
            alert("No completed orders to delete.");
            return;
        }

        const batch = db.batch();
        let count = 0;

        snapshot.forEach(doc => {
            batch.update(doc.ref, { adminHidden: true });
            count++;
        });

        if (count > 500) {
            alert("Too many orders to delete at once. Please implement chunking. Deleting first 500.");
        }

        await batch.commit();
        alert(`Successfully deleted ${count} orders.`);

    } catch (error) {
        console.error("Error clearing history:", error);
        alert("Failed to clear history: " + error.message);
    }
}

function downloadAdminHistoryCSV() {
    if (!window.cachedHistoryOrders) {
        alert("Order history not loaded. Please wait and try again.");
        return;
    }

    const orders = window.cachedHistoryOrders;
    if (orders.length === 0) {
        alert("No order history found to export.");
        return;
    }

    const headers = ['Order ID', 'Ordered By', 'Items', 'Status', 'Total', 'Date'];

    const data = orders.map(o => {
        let displayName = o.customerName || o.userName || o.name || "Guest";
        if (displayName === "Guest" && o.userId) displayName = "User " + o.userId.slice(0, 6);

        const itemsStr = o.items ? o.items.map(i => `${i.quantity}x ${i.name}`).join(', ') : 'No items';

        let dateStr = '';
        try {
            if (o.createdAt && typeof o.createdAt.toDate === 'function') {
                dateStr = o.createdAt.toDate().toLocaleString('sv-SE');
            } else if (o.createdAt && o.createdAt.seconds) {
                dateStr = new Date(o.createdAt.seconds * 1000).toLocaleString('sv-SE');
            } else if (o.createdAt) {
                dateStr = new Date(o.createdAt).toLocaleString();
            }
        } catch (e) { console.warn("Date error", e); }

        return [
            o.orderNumber || o.id,
            displayName,
            itemsStr,
            o.status,
            Number(o.total),
            dateStr
        ];
    });

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    exportToCSV(`admin-order-history-${dateStr}.csv`, headers, data);
}

function initStatsListener() {
    db.collection('orders').onSnapshot((snapshot) => {
        const orders = [];
        snapshot.forEach(doc => {
            orders.push({ id: doc.id, ...doc.data() });
        });
        updateStats(orders);
    }, (error) => {
        console.error("Error fetching stats:", error);
    });
}

function updateStats(orders) {
    const completedOrders = orders.filter(o => o.status === 'Completed');

    const total = completedOrders.length;
    const revenue = completedOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);

    const pending = orders.filter(o => !o.status || o.status === 'Pending' || o.status === 'Preparing').length;

    const statsOrders = document.getElementById('stats-orders');
    const statsRevenue = document.getElementById('stats-revenue');
    const statsPending = document.getElementById('stats-pending');

    if (statsOrders) statsOrders.innerText = total;
    if (statsRevenue) statsRevenue.innerText = '₹' + revenue.toFixed(2);
    if (statsPending) statsPending.innerText = pending;
}
