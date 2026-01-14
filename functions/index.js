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
