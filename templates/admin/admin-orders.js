/* === ADMIN ORDERS JAVASCRIPT === */

let activeOrdersUnsubscribe = null;

function initRealTimeOrders() {
    loadActiveOrders();
}

function loadActiveOrders() {
    const mealGrid = document.getElementById('active-meal-orders-grid');
    const snackGrid = document.getElementById('active-snack-orders-grid');

    if (!mealGrid || !snackGrid) return;

    // Reset listener if already active
    if (activeOrdersUnsubscribe) {
        activeOrdersUnsubscribe();
        activeOrdersUnsubscribe = null;
    }

    // Show loading state
    if (!mealGrid.hasChildNodes()) mealGrid.innerHTML = '<p class="text-muted">Loading...</p>';
    if (!snackGrid.hasChildNodes()) snackGrid.innerHTML = '<p class="text-muted">Loading...</p>';

    activeOrdersUnsubscribe = db.collection('orders')
        .onSnapshot((snapshot) => {
            const mealFragment = document.createDocumentFragment();
            const snackFragment = document.createDocumentFragment();

            let hasMealOrders = false;
            let hasSnackOrders = false;

            if (snapshot.empty) {
                mealGrid.innerHTML = '<div class="text-center text-muted col-span-full no-orders-msg">No active meal orders</div>';
                snackGrid.innerHTML = '<div class="text-center text-muted col-span-full no-orders-msg">No active snack orders</div>';
                return;
            }

            const orders = [];
            snapshot.forEach(doc => {
                orders.push({ id: doc.id, ...doc.data() });
            });

            // Client-side Sort
            orders.sort((a, b) => {
                const getTime = (o) => {
                    if (!o.createdAt) return Date.now();
                    if (typeof o.createdAt.toMillis === 'function') return o.createdAt.toMillis();
                    return new Date(o.createdAt).getTime() || 0;
                };
                return getTime(b) - getTime(a);
            });

            orders.forEach(data => {
                const displayName = data.customerName || data.userName || data.name || "User " + (data.userId ? data.userId.slice(0, 6) : "Unknown");

                let isMealOrder = true;

                if (data.orderType === 'Quick Snack Order') {
                    isMealOrder = false;
                } else if (data.orderType === 'Meal Order') {
                    isMealOrder = true;
                } else if (data.items && Array.isArray(data.items) && data.items.length > 0) {
                    const hasMealItem = data.items.some(i => i.type === 'meal');
                    const allSnacks = data.items.every(i => i.type === 'quick-snack' || i.type === 'quick');

                    if (allSnacks && !hasMealItem) {
                        isMealOrder = false;
                    }
                }

                if (data.status !== 'Completed' && data.status !== 'Cancelled') {
                    const tempObj = document.createElement('div');
                    tempObj.innerHTML = createOrderCardHTML(data.id, { ...data, displayName });
                    const cardElement = tempObj.firstElementChild;

                    if (cardElement) {
                        if (isMealOrder) {
                            mealFragment.appendChild(cardElement);
                            hasMealOrders = true;
                        } else {
                            snackFragment.appendChild(cardElement);
                            hasSnackOrders = true;
                        }
                    }
                }
            });

            mealGrid.innerHTML = '';
            if (hasMealOrders) {
                mealGrid.appendChild(mealFragment);
            } else {
                mealGrid.innerHTML = '<div class="text-center text-muted col-span-full no-orders-msg" style="grid-column: 1/-1; padding: 2rem; background: white; border-bottom: 1px solid #eee;">No active meal orders</div>';
            }

            snackGrid.innerHTML = '';
            if (hasSnackOrders) {
                snackGrid.appendChild(snackFragment);
            } else {
                snackGrid.innerHTML = '<div class="text-center text-muted col-span-full no-orders-msg" style="grid-column: 1/-1; padding: 2rem; background: white; border-bottom: 1px solid #eee;">No active snack orders</div>';
            }

        }, (error) => {
            console.error("Error loading active orders:", error);
            mealGrid.innerHTML = `<div class="text-center text-danger">Error loading active orders</div>`;
            snackGrid.innerHTML = `<div class="text-center text-danger">Error loading active orders</div>`;
        });
}

function createOrderCardHTML(id, data) {
    const displayId = data.orderNumber || id;

    const itemsList = data.items ? data.items.map(item =>
        `<div style="font-size: 0.85rem; color: #555;">• ${item.quantity}x ${item.name}</div>`
    ).join('') : '<div class="text-muted text-sm">No items found</div>';

    let displayStatus = data.status;
    let statusClass = getStatusClass(data.status);

    if (data.status === 'Ready' && data.userPickedUp === true) {
        displayStatus = 'Picked';
        statusClass = 'status-picked';
    }

    return `
        <div class="order-card" id="${id}" style="display: flex; flex-direction: column; gap: 8px;">
             <div class="order-header" style="justify-content: space-between; align-items: flex-start;">
                 <div>
                     <small class="text-muted" style="font-size: 0.75rem; display: block; margin-bottom: 2px;">Order ID: #${displayId}</small>
                     <div style="font-weight: 600; font-size: 0.95rem;">
                         👤 Ordered by: <span class="text-muted customer-name">${data.displayName}</span>
                     </div>
                 </div>
                 <span class="status-badge ${statusClass} order-status-badge">${displayStatus}</span>
             </div>
             
             <div style="background: #f8f9fa; padding: 8px; border-radius: 6px; margin: 4px 0;">
                <strong style="font-size: 0.8rem; color: #333; display: block; margin-bottom: 4px;">Items:</strong>
                ${itemsList}
             </div>

             <div>
                 <div style="font-size: 0.85rem; color: #666;">Total Amount</div>
                 <div class="order-total" style="font-size: 1.1rem;">₹${Number(data.total).toFixed(2)}</div>
             </div>

             <div class="order-actions" style="margin-top: auto; padding-top: 10px; border-top: 1px solid #eee;">
                 ${getActionButtonsHTML(id, data.status)}
             </div>
        </div>
    `;
}

function getActionButtonsHTML(id, status) {
    if (status === 'Pending' || status === 'Preparing') {
        return `<button class="action-btn btn-ready" onclick="updateStatus('${id}', 'Ready')" style="width: 100%;">Mark Ready</button>`;
    }
    if (status === 'Ready') {
        return `<button class="action-btn btn-complete" onclick="updateStatus('${id}', 'Completed')" style="width: 100%;">Complete</button>`;
    }
    return `<span class="text-muted text-sm">No actions</span>`;
}

async function updateStatus(id, newStatus) {
    try {
        const docSnap = await db.collection('orders').doc(id).get();
        if (!docSnap.exists) return;
        const data = docSnap.data();
        const orderNum = data.orderNumber || id;

        await db.collection('orders').doc(id).update({
            status: newStatus
        });

        if (newStatus === 'Ready') {
            gtag('event', 'order_ready', {
                order_id: orderNum
            });
        } else if (newStatus === 'Completed') {
            gtag('event', 'order_completed', {
                order_id: orderNum,
                completed_by: 'admin'
            });

            // Generate Invoice
            try {
                const invoiceData = {
                    orderNumber: orderNum,
                    userId: data.userId,
                    userName: data.userName || data.name || data.customerName || 'Guest',
                    phone: data.phoneNumber || data.phone || '',
                    email: data.email || '',
                    items: data.items || [],
                    totalAmount: data.total,
                    paymentStatus: 'PAID',
                    orderDate: data.createdAt,
                    invoiceDate: firebase.firestore.FieldValue.serverTimestamp(),
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };

                await db.collection('invoices').add(invoiceData);
                console.log("Invoice generated for order " + orderNum);
            } catch (invError) {
                console.error("Failed to generate invoice:", invError);
                alert("Order completed, but failed to generate invoice. Check console.");
            }
        }

    } catch (error) {
        console.error("Error updating status:", error);
        alert("Failed to update status");
    }
}

async function completeAllOrders(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const completeButtons = container.querySelectorAll('.btn-complete');

    if (completeButtons.length === 0) {
        return;
    }

    const promises = [];
    completeButtons.forEach(btn => {
        const card = btn.closest('.order-card');
        if (card && card.id) {
            promises.push(updateStatus(card.id, 'Completed'));
        }
    });

    try {
        await Promise.all(promises);
    } catch (error) {
        console.error("Error in bulk completion:", error);
        alert("Some orders failed to complete. Check console.");
    }
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
