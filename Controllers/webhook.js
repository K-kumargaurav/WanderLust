const Booking = require("../models/booking.js");
const { constructWebhookEvent } = require("../services/payment.service.js");
const { BOOKING_STATUS } = require("../utils/constants.js");

/**
 * Handles incoming Stripe webhook events.
 * Acts as a backup confirmation for payment success.
 * Stripe may call this even if the guest closed the browser
 * before being redirected to /bookings/payment/success.
 *
 * @route  POST /webhook/stripe
 * @access Public (verified by Stripe signature)
 */
module.exports.handleStripeWebhook = async (req, res) => {
    const signature = req.headers["stripe-signature"];

    let event;
    try {
        event = constructWebhookEvent(req.body, signature);
    } catch (err) {
        console.error("[webhook] Signature verification failed:", err.message);
        return res.status(400).json({ error: `Webhook error: ${err.message}` });
    }

    // Handle relevant events
    switch (event.type) {
        case "checkout.session.completed": {
            const session = event.data.object;

            if (session.payment_status === "paid") {
                const booking = await Booking.findOne({
                    stripeSessionId: session.id,
                });

                if (booking && booking.paymentStatus !== "paid") {
                    booking.stripePaymentIntentId =
                        typeof session.payment_intent === "string"
                            ? session.payment_intent
                            : session.payment_intent?.id;
                    booking.paymentStatus = "paid";
                    await booking.save();
                    console.log(
                        `[webhook] Booking ${booking._id} marked as paid.`
                    );
                }
            }
            break;
        }

        case "payment_intent.payment_failed": {
            const paymentIntent = event.data.object;
            const booking = await Booking.findOne({
                stripePaymentIntentId: paymentIntent.id,
            });

            if (booking) {
                booking.status = BOOKING_STATUS.CANCELLED;
                booking.paymentStatus = "unpaid";
                await booking.save();
                console.log(
                    `[webhook] Booking ${booking._id} cancelled — payment failed.`
                );
            }
            break;
        }

        case "charge.refunded": {
            const charge = event.data.object;
            const booking = await Booking.findOne({
                stripePaymentIntentId: charge.payment_intent,
            });

            if (booking) {
                booking.paymentStatus = "refunded";
                await booking.save();
                console.log(
                    `[webhook] Booking ${booking._id} marked as refunded.`
                );
            }
            break;
        }

        default:
            // Ignore all other event types
            console.log(`[webhook] Unhandled event type: ${event.type}`);
    }

    // Always return 200 to Stripe — otherwise Stripe retries
    res.status(200).json({ received: true });
};
