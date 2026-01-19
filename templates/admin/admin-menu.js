/* === ADMIN MENU JAVASCRIPT === */

let allMenuItems = [];
let currentMenuCollection = 'food_items';
let menuUnsubscribe = null;

function switchMenuType(type) {
    const btnMeal = document.getElementById('btn-meal');
    const btnSnack = document.getElementById('btn-snack');

    if (type === 'meal') {
        btnMeal.style.background = 'var(--primary-color)';
        btnMeal.style.color = 'white';
        btnSnack.style.background = '#e2e8f0';
        btnSnack.style.color = 'var(--dark-color)';
        currentMenuCollection = 'food_items';
    } else {
        btnSnack.style.background = 'var(--primary-color)';
        btnSnack.style.color = 'white';
        btnMeal.style.background = '#e2e8f0';
        btnMeal.style.color = 'var(--dark-color)';
        currentMenuCollection = 'quick_meals';
    }

    initRealTimeMenu();
}

function initRealTimeMenu() {
    const tbody = document.getElementById('menu-table-body');
    if (!tbody) return;

    if (menuUnsubscribe) {
        menuUnsubscribe();
    }

    menuUnsubscribe = db.collection(currentMenuCollection).onSnapshot((snapshot) => {
        const items = [];
        snapshot.forEach(doc => {
            items.push({ id: doc.id, ...doc.data() });
        });
        allMenuItems = items;
        renderMenuTable(items);
    }, (error) => {
        console.error("Error fetching menu:", error);
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Error loading menu: ${error.message}</td></tr>`;
    });
}

function renderMenuTable(items) {
    const tbody = document.getElementById('menu-table-body');
    if (!tbody) return;

    const searchInput = document.getElementById('menuSearchInput');
    const searchVal = searchInput ? searchInput.value.toLowerCase() : '';

    let filteredItems = items;

    if (searchVal) {
        filteredItems = items.filter(item => {
            const name = (item.Name || item.name || '').toLowerCase();
            const category = (item.Category || item.category || '').toLowerCase();
            return name.includes(searchVal) || category.includes(searchVal);
        });
    }

    if (filteredItems.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No items found.</td></tr>`;
        return;
    }

    filteredItems.sort((a, b) => {
        const catA = (a.Category || a.category || '').toLowerCase();
        const catB = (b.Category || b.category || '').toLowerCase();
        if (catA < catB) return -1;
        if (catA > catB) return 1;

        const nameA = (a.Name || a.name || '').toLowerCase();
        const nameB = (b.Name || b.name || '').toLowerCase();
        return nameA.localeCompare(nameB);
    });

    let html = '';
    let lastCategory = null;

    filteredItems.forEach(item => {
        const currentCategory = item.Category || item.category || 'Uncategorized';

        if (currentCategory !== lastCategory) {
            let displayCategory = currentCategory;
            if (displayCategory.toLowerCase() === 'indian_snack' || displayCategory === 'Indian Item Snack') {
                displayCategory = 'Snacks';
            }

            html += `
                <tr style="background-color: #f1f5f9;">
                    <td colspan="5" style="font-weight: 700; color: var(--dark-color); text-transform: capitalize; padding-left: 1rem;">
                        ${displayCategory}
                    </td>
                </tr>
            `;
            lastCategory = currentCategory;
        }

        let itemCategory = item.Category || item.category || 'N/A';
        if (itemCategory.toLowerCase() === 'indian_snack' || itemCategory === 'Indian Item Snack') {
            itemCategory = 'Snacks';
        }

        html += `
        <tr id="row-${item.id}">
            <td class="flex items-center gap-sm">
                <img loading="lazy" src="${item.Image || item.image || 'https://via.placeholder.com/40'}" width="40" height="40" style="border-radius:4px; object-fit: cover;">
                ${item.Name || item.name}
            </td>
            <td style="text-transform:capitalize">${itemCategory}</td>
            <td>₹${Number(item.Price || item.price).toFixed(2)}</td>
            <td>
                <span class="${item.available ? 'text-success' : 'text-danger'}" style="font-weight:600">
                    ${item.available ? 'Available' : 'Unavailable'}
                </span>
            </td>
            <td>
                <button class="action-btn" style="background: #e2e8f0; margin-right: 5px;" 
                    onclick="enableEditMode('${item.id}')">
                    Edit
                </button>
                <button class="action-btn" style="background: #e2e8f0; margin-right: 5px;" 
                    onclick="toggleAvailability('${item.id}', ${item.available})">
                    Toggle
                </button>
                <button class="action-btn" style="background: #fee2e2; color: #dc2626;" 
                    onclick="deleteMenuItem('${item.id}')">
                    Delete
                </button>
            </td>
        </tr>
        `;
    });

    tbody.innerHTML = html;
}

let filterMenuTimeout;
function filterMenu() {
    clearTimeout(filterMenuTimeout);
    filterMenuTimeout = setTimeout(() => {
        renderMenuTable(allMenuItems);
    }, 300);
}

async function addMenuItem(event) {
    event.preventDefault();

    const btn = document.getElementById('btnAddItem');
    if (btn) { btn.innerText = "Adding..."; btn.disabled = true; }

    const name = document.getElementById('itemName').value;
    const category = document.getElementById('itemCategory').value;
    const price = parseFloat(document.getElementById('itemPrice').value);
    let image = "";
    const fileInput = document.getElementById('newItemFile');
    const available = document.getElementById('itemAvailable').checked;

    try {
        if (fileInput && fileInput.files.length > 0) {
            if (btn) btn.innerText = "Uploading Image...";
            try {
                image = await uploadImageToFirebase(fileInput.files[0]);
                console.log("Image uploaded successfully: " + image);
            } catch (uploadErr) {
                console.error("Upload failed inside addMenuItem:", uploadErr);
                alert("Image upload failed! Item will not be added. " + uploadErr.message);
                throw uploadErr;
            }
        }

        const newItem = {};
        if (currentMenuCollection === 'food_items') {
            newItem.Name = name;
            newItem.Category = category;
            newItem.Price = price;
            newItem.Image = image;
            newItem.available = available;
        } else {
            newItem.name = name;
            newItem.category = category;
            newItem.price = price;
            newItem.image = image;
            newItem.available = available;
        }

        await db.collection(currentMenuCollection).add(newItem);

        event.target.reset();
        alert("Item added successfully!");

    } catch (error) {
        console.error("Error adding item:", error);
        alert("Failed to add item: " + error.message);
    } finally {
        if (btn) { btn.innerText = "Add Item"; btn.disabled = false; }
    }
}

function deleteMenuItem(id) {
    if (confirm("Are you sure you want to delete this item?")) {
        db.collection(currentMenuCollection).doc(id).delete()
            .catch(error => {
                console.error("Error deleting item:", error);
                alert("Failed to delete item: " + error.message);
            });
    }
}

function toggleAvailability(id, currentStatus) {
    db.collection(currentMenuCollection).doc(id).update({
        available: !currentStatus
    }).catch(error => {
        console.error("Error toggling availability:", error);
        alert("Failed to update availability: " + error.message);
    });
}

function enableEditMode(id) {
    const item = allMenuItems.find(i => i.id === id);
    if (!item) return;

    const row = document.getElementById(`row-${id}`);
    if (!row) return;

    row.innerHTML = `
        <td>
            <div style="display:flex; flex-direction:column; gap:5px;">
                <input type="text" id="edit-name-${id}" value="${item.Name || item.name}" placeholder="Name" style="padding:4px; border:1px solid #ccc; border-radius:4px; width:100%;">
                <input type="file" id="edit-file-${id}" accept="image/*" style="font-size: 0.8em;">
            </div>
        </td>
        <td style="text-transform:capitalize; color: #666;">${item.Category || item.category || 'N/A'}</td>
        <td>
            <input type="number" id="edit-price-${id}" value="${item.Price || item.price}" step="0.01" style="padding:4px; border:1px solid #ccc; border-radius:4px; width: 80px;">
        </td>
        <td>
             <span class="${item.available ? 'text-success' : 'text-danger'}" style="font-weight:600">
                ${item.available ? 'Available' : 'Unavailable'}
            </span>
        </td>
        <td>
            <button class="action-btn btn-ready" onclick="saveEdit('${id}')" style="margin-right:5px;">Save</button>
            <button class="action-btn" onclick="cancelEdit()" style="background:#e2e8f0;">Cancel</button>
        </td>
    `;
}

async function saveEdit(id) {
    const name = document.getElementById(`edit-name-${id}`).value;
    const item = allMenuItems.find(i => i.id === id);
    let image = item ? (item.Image || item.image) : '';
    const price = parseFloat(document.getElementById(`edit-price-${id}`).value);
    const fileInput = document.getElementById(`edit-file-${id}`);

    if (!name || isNaN(price)) {
        alert("Please fill in valid name and price.");
        return;
    }

    const saveBtn = document.querySelector(`button[onclick="saveEdit('${id}')"]`);
    if (saveBtn) {
        saveBtn.innerText = "Saving...";
        saveBtn.disabled = true;
    }

    try {
        if (fileInput && fileInput.files.length > 0) {
            if (saveBtn) saveBtn.innerText = "Uploading...";

            const oldImageUrl = item.Image || item.image;
            if (oldImageUrl && oldImageUrl.includes('firebasestorage')) {
                console.log("Attempting to delete old image...");
                try {
                    const oldRef = firebase.storage().refFromURL(oldImageUrl);
                    await oldRef.delete();
                    console.log("Old image deleted successfully.");
                } catch (deleteErr) {
                    console.warn("Failed to delete old image (might not exist or different path):", deleteErr);
                }
            }

            image = await uploadImageToFirebase(fileInput.files[0]);
        }

        const updateData = {};
        if (currentMenuCollection === 'food_items') {
            updateData.Name = name;
            updateData.Price = price;
            updateData.Image = image;
        } else {
            updateData.name = name;
            updateData.price = price;
            updateData.image = image;
        }

        await db.collection(currentMenuCollection).doc(id).update(updateData);

    } catch (error) {
        console.error("Error updating:", error);
        alert("Failed to update: " + error.message);
        if (saveBtn) {
            saveBtn.innerText = "Save";
            saveBtn.disabled = false;
        }
    }
}

function cancelEdit() {
    renderMenuTable(allMenuItems);
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
