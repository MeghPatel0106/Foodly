/* === ADMIN SHARED JAVASCRIPT === */

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyBihlwqIg2rvfKC-Tt6sjKYSFKYn7ZBJwg",
    authDomain: "foodly-40d16.firebaseapp.com",
    projectId: "foodly-40d16",
    storageBucket: "foodly-40d16.firebasestorage.app",
    messagingSenderId: "74040922594",
    appId: "1:74040922594:web:667204bc01d84c8db5e9bb"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();
const storage = firebase.storage();

// STRICT ADMIN PROTECTION
// Global flag to signal admin auth is ready
window.adminAuthReady = false;

firebase.auth().onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = "/index.html";
        return;
    }

    const snap = await firebase.firestore()
        .collection("users")
        .doc(user.uid)
        .get();

    if (!snap.exists || snap.data().role !== "admin") {
        window.location.href = "/menu.html";
        return;
    }

    // Admin auth confirmed - set flag and dispatch event
    window.adminAuthReady = true;
    window.dispatchEvent(new Event('adminAuthReady'));
});

// Mobile Sidebar Toggle
window.toggleAdminSidebar = function () {
    const sidebar = document.getElementById('adminSidebar');
    const overlay = document.querySelector('.sidebar-overlay');

    if (sidebar) {
        const isClosed = !sidebar.classList.contains('show');

        if (isClosed) {
            sidebar.classList.add('show');
            if (overlay) {
                overlay.style.display = 'block';
                setTimeout(() => overlay.style.opacity = '1', 10);
            }
            document.body.style.overflow = 'hidden';
        } else {
            sidebar.classList.remove('show');
            if (overlay) {
                overlay.style.opacity = '0';
                setTimeout(() => overlay.style.display = 'none', 300);
            }
            document.body.style.overflow = '';
        }
    } else {
        console.error("Sidebar element not found!");
    }
};

// Logout Function
function logout() {
    firebase.auth().signOut().then(() => {
        localStorage.removeItem('admin_active_tab');
        window.location.href = '/index.html';
    }).catch((error) => {
        console.error("Logout Error:", error);
        alert("Error logging out");
    });
}

// Status Badge Helper
function getStatusClass(status) {
    if (status === 'Pending' || status === 'Preparing') return 'status-preparing';
    if (status === 'Ready') return 'status-ready';
    return 'status-completed';
}

// Format Number Helper
function formatNumber(num) {
    return num.toLocaleString('en-IN');
}

// CSV Export Helper
function exportToCSV(filename, headers, rows) {
    if (!rows || !rows.length) {
        alert("No data to export.");
        return;
    }
    const csvContent = [
        headers.join(","),
        ...rows.map(row => row.map(item => {
            let val = item;
            if (val === null || val === undefined) val = '';
            val = String(val).replace(/"/g, '""');
            return `"${val}"`;
        }).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// Shared Image Upload Helper
async function uploadImageToFirebase(file) {
    return new Promise((resolve, reject) => {
        if (!file) {
            reject(new Error("No file provided."));
            return;
        }

        if (!file.type.match('image.*')) {
            reject(new Error("Select a valid image file."));
            return;
        }

        console.log("Starting upload for: " + file.name);

        const timestamp = Date.now();
        const cleanName = file.name.replace(/[^a-zA-Z0-9.]/g, "_");
        const path = 'items/' + timestamp + "_" + cleanName;

        const storageRef = storage.ref().child(path);
        const uploadTask = storageRef.put(file);

        uploadTask.on('state_changed',
            (snapshot) => {
                const percentage = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                console.log('Upload is ' + percentage + '% done');
            },
            (error) => {
                console.error("Firebase Storage Error:", error);
                reject(error);
            },
            () => {
                uploadTask.snapshot.ref.getDownloadURL().then((downloadURL) => {
                    console.log('File available at', downloadURL);
                    resolve(downloadURL);
                }).catch(err => {
                    console.error("Failed to get download URL:", err);
                    reject(err);
                });
            }
        );
    });
}

// Initialize Lucide Icons
document.addEventListener('DOMContentLoaded', () => {
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
});
