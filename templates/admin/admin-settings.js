/* === ADMIN SETTINGS JAVASCRIPT === */

async function resetAllMenu() {
    if (!confirm("Are you sure you want to delete ALL menu items? This cannot be undone.")) return;

    const collections = ['food_items', 'quick_meals'];
    let count = 0;

    try {
        for (const colName of collections) {
            const snapshot = await db.collection(colName).get();
            if (!snapshot.empty) {
                const batch = db.batch();
                snapshot.docs.forEach(doc => {
                    batch.delete(doc.ref);
                    count++;
                });
                await batch.commit();
            }
        }
        alert(`Successfully deleted ${count} menu items.`);
    } catch (error) {
        console.error("Error deleting menu:", error);
        alert("Failed to delete menu items: " + error.message);
    }
}

async function resetAllOrders() {
    if (!confirm("Are you sure you want to delete ALL orders? This cannot be undone.")) return;

    try {
        const snapshot = await db.collection('orders').get();
        if (snapshot.empty) {
            alert("No orders to delete.");
            return;
        }

        const batch = db.batch();
        let count = 0;

        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
            count++;
        });

        await batch.commit();
        alert(`Successfully deleted ${count} orders.`);
    } catch (error) {
        console.error("Error deleting orders:", error);
        alert("Failed to delete orders: " + error.message);
    }
}
