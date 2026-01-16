const functions = require("firebase-functions");
const Razorpay = require("razorpay");

// Lazy initialization inside function to prevent cold start crash if env vars are missing
exports.createRazorpayOrder = functions.https.onCall(async (data, context) => {
    const keyId = process.env.RAZORPAY_KEY_ID || "rzp_test_S2rAYBNbIc1snt";
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    console.log("Debug: Function called with amount:", data.amount);
    console.log("Debug: Key ID Present:", !!keyId);
    console.log("Debug: Key Secret Present:", !!keySecret);

    if (!keySecret) {
        console.error("Critical: RAZORPAY_KEY_SECRET is missing in environment variables.");
        throw new functions.https.HttpsError("failed-precondition", "Server misconfiguration: Missing Razorpay Secret Key.");
    }

    // Initialize instance
    try {
        var razorpay = new Razorpay({
            key_id: keyId,
            key_secret: keySecret,
        });
    } catch (e) {
        console.error("Razorpay Init Error:", e);
        throw new functions.https.HttpsError("internal", "Failed to initialize Razorpay client.", e);
    }

    const amount = data.amount;
    const currency = data.currency || "INR";

    if (!amount) {
        throw new functions.https.HttpsError("invalid-argument", "The function must be called with an amount.");
    }

    const options = {
        amount: amount,
        currency: currency,
        receipt: "order_rcptid_" + new Date().getTime(),
    };

    try {
        const order = await razorpay.orders.create(options);
        console.log("Order created successfully:", order.id);
        return {
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
        };
    } catch (error) {
        console.error("Razorpay API Error:", error);
        // Return specific error message from Razorpay if possible
        throw new functions.https.HttpsError("internal", `Razorpay API Failed: ${error.message || JSON.stringify(error)}`, error);
    }
});

const admin = require("firebase-admin");
if (!admin.apps.length) {
    admin.initializeApp();
}

/**
 * Triggered when an order document is updated.
 * Sends a push notification if the status changes to "Ready".
 */
exports.onOrderUpdate = functions.firestore
    .document("orders/{orderId}")
    .onUpdate(async (change, context) => {
        const newValue = change.after.data();
        const previousValue = change.before.data();

        // Check if status changed to "Ready"
        if (newValue.status === "Ready" && previousValue.status !== "Ready") {
            const userId = newValue.userId;
            const orderNumber = newValue.orderNumber || context.params.orderId;

            if (!userId) {
                console.log("No userId found for order", context.params.orderId);
                return null;
            }

            // Fetch user's FCM token
            const userDoc = await admin.firestore().collection("users").doc(userId).get();
            if (!userDoc.exists) {
                console.log("User document does not exist for userId", userId);
                return null;
            }

            const userData = userDoc.data();
            const fcmToken = userData.fcmToken;

            if (!fcmToken) {
                console.log("No fcmToken found for userId", userId);
                return null;
            }

            const message = {
                notification: {
                    title: "🍔 Food Ready!",
                    body: `Your order #${orderNumber} is ready for pickup.`,
                },
                token: fcmToken,
            };

            try {
                const response = await admin.messaging().send(message);
                console.log("Successfully sent message:", response);
            } catch (error) {
                console.error("Error sending message:", error);
            }
        }

        return null;
    });
