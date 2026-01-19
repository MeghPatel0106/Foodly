/* === ADMIN REVIEWS JAVASCRIPT === */

async function renderReviews(forceRefresh = false) {
    const tbody = document.getElementById('reviews-table-body');
    const loading = document.getElementById('reviews-loading');
    const empty = document.getElementById('reviews-empty');
    const avgEl = document.getElementById('review-avg-rating');
    const countEl = document.getElementById('review-total-count');
    const sentEl = document.getElementById('review-sentiment');

    if (!tbody) return;

    const cacheKey = 'admin_reviews_cache_v5';
    const cached = localStorage.getItem(cacheKey);
    const now = new Date().getTime();

    let reviews = [];

    if (!forceRefresh && cached) {
        const data = JSON.parse(cached);
        if (now - data.timestamp < 30000) {
            reviews = data.reviews;
            window.cachedReviews = reviews;
        }
    }

    if (reviews.length === 0) {
        loading.style.display = 'block';
        tbody.innerHTML = '';
        empty.style.display = 'none';

        try {
            const [snap, androidSnap] = await Promise.all([
                db.collection('orders').where('status', '==', 'Completed').limit(500).get(),
                db.collection('order_feedback').get()
            ]);

            const androidMap = {};
            if (androidSnap) {
                androidSnap.forEach(d => {
                    const val = d.data();
                    if (val.orderId) androidMap[val.orderId] = val;
                    if (val.orderNumber) androidMap[val.orderNumber] = val;
                });
            }

            reviews = snap.docs.map(doc => {
                const data = doc.data();
                const feedback = data.feedback || {};
                const orderId = data.orderNumber || doc.id;

                let rating = feedback.rating || data.rating || 0;
                let comment = feedback.comment || data.comment || data.feedbackComment || '';
                let createdAt = feedback.createdAt || data.createdAt?.toDate().toISOString() || new Date().toISOString();

                if (androidMap[orderId]) {
                    const ad = androidMap[orderId];

                    const adRating = ad.rating || ad.stars || ad.score || ad.rate || 0;
                    if (adRating > 0) rating = adRating;

                    const adComment = ad.comment || ad.review || ad.text || ad.message || ad.feedback || '';
                    if (adComment) comment = adComment;

                    if (ad.createdAt) {
                        try {
                            const adDate = ad.createdAt.toDate ? ad.createdAt.toDate() : new Date(ad.createdAt);
                            if (!isNaN(adDate.getTime())) createdAt = adDate.toISOString();
                        } catch (e) { }
                    }
                }

                const rawComment = comment;

                return {
                    id: doc.id,
                    displayOrderId: orderId,
                    userName: data.customerName || data.userName || data.name || 'Guest',
                    rating: parseInt(rating) || 0,
                    comment: String(rawComment).trim(),
                    items: data.items || [],
                    createdAtIso: createdAt,
                    isHidden: data.reviewHidden === true
                };
            })
                .filter(r => r.rating > 0 || r.comment.length > 0);

            reviews.sort((a, b) => new Date(b.createdAtIso) - new Date(a.createdAtIso));

            localStorage.setItem(cacheKey, JSON.stringify({
                timestamp: now,
                reviews: reviews
            }));

            window.cachedReviews = reviews;

        } catch (e) {
            console.error("Error fetching reviews", e);
            loading.innerHTML = "Error loading reviews.";
            return;
        }
    }

    loading.style.display = 'none';

    if (reviews.length === 0) {
        empty.style.display = 'block';
        if (avgEl) avgEl.innerText = "0.0";
        if (countEl) countEl.innerText = "0";
        if (sentEl) sentEl.innerText = "—";
        return;
    }

    tbody.innerHTML = reviews.filter(r => !r.isHidden).map(r => {
        const date = new Date(r.createdAtIso).toLocaleString();
        const rating = r.rating || 0;
        const ratingDisplay = `${rating}/5`;

        const comment = r.comment ? (r.comment.length > 50 ? r.comment.substring(0, 50) + '...' : r.comment) : '-';

        const items = r.items ? r.items.map(i => i.name).join(', ') : '-';

        return `
    <tr>
        <td data-label="Date">${date}</td>
        <td data-label="Order #">${r.displayOrderId}</td>
        <td data-label="Customer">${r.userName}</td>
        <td data-label="Rating" style="font-weight: bold; color: var(--text-dark);">${ratingDisplay}</td>
        <td data-label="Comment" style="color: #666;" title="${r.comment || ''}">${comment}</td>
        <td data-label="Items" style="font-size: 0.85rem; color: #888;">${items}</td>
        <td data-label="Actions">
             <button class="action-btn" style="background: #fee2e2; color: #dc2626;" onclick="deleteReview('${r.id}')">Delete</button>
        </td>
    </tr>
`;
    }).join('');

    const total = reviews.length;
    const sum = reviews.reduce((a, b) => a + (b.rating || 0), 0);
    const avg = total > 0 ? (sum / total).toFixed(1) : 0;

    if (avgEl) avgEl.innerText = avg;
    if (countEl) countEl.innerText = total;

    if (sentEl) {
        if (avg >= 4.5) sentEl.innerText = "🔥 Excellent";
        else if (avg >= 4.0) sentEl.innerText = "😊 Very Good";
        else if (avg >= 3.0) sentEl.innerText = "🙂 Good";
        else if (avg >= 2.0) sentEl.innerText = "😐 Okay";
        else sentEl.innerText = "😞 Needs Work";
    }
}

async function deleteReview(orderId) {
    if (!confirm("Are you sure you want to delete this review? It will be removed from the reviews list but kept for analytics.")) return;
    try {
        await db.collection('orders').doc(orderId).update({ reviewHidden: true });

        localStorage.removeItem('admin_reviews_cache_v5');

        renderReviews(true);
        alert("Review deleted successfully.");
    } catch (e) {
        console.error("Error deleting review:", e);
        alert("Error deleting review: " + e.message);
    }
}

function downloadReviewsCSV() {
    if (!window.cachedReviews) {
        alert("Reviews not loaded. If empty, click Refresh.");
        return;
    }

    const reviews = window.cachedReviews;
    if (reviews.length === 0) {
        alert("No reviews found to export.");
        return;
    }

    const headers = ['Date', 'Order #', 'Customer', 'Rating', 'Comment', 'Items'];

    const data = reviews.map(r => {
        const ratingStr = `="${r.rating || 0}/5"`;

        let dateStr = '';
        try {
            dateStr = new Date(r.createdAtIso).toLocaleString('sv-SE');
        } catch (e) { dateStr = r.createdAtIso || ''; }

        const itemsStr = r.items ? r.items.map(i => i.name).join(', ') : '';

        return [
            dateStr,
            r.displayOrderId,
            r.userName,
            ratingStr,
            r.comment || '',
            itemsStr
        ];
    });

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    exportToCSV(`customer-reviews-${dateStr}.csv`, headers, data);
}
