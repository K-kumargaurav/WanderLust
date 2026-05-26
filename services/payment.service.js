const config = require("../config");
const stripe = require("stripe")(config.stripe.secretKey);

/**
 * Creates a Stripe Checkout Session for a booking.
 * Guest is redirected to Stripe hosted payment page.
 *
 * @param {object} booking - Saved booking document (not yet paid)
 * @param {object} listing - Listing document
 * @param {object} guest   - User document (the guest)
 * @param {string} host    - Request host header (e.g. localhost:8080)
 * @returns {Promise<string>} - Stripe Checkout Session URL
 */
async function createCheckoutSession(booking, listing, guest, host) {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    customer_email: guest.email,
    client_reference_id: booking._id.toString(),
    metadata: {
      bookingId: booking._id.toString(),
      listingId: listing._id.toString(),
      guestId: guest._id.toString(),
      checkIn: booking.checkIn.toISOString(),
      checkOut: booking.checkOut.toISOString(),
      nights: booking.nights.toString(),
    },
    line_items: [
      {
        price_data: {
          currency: config.stripe.currency,
          product_data: {
            name: `WanderLust — ${listing.title}`,
            description: `${booking.nights} night${booking.nights > 1 ? "s" : ""} · ${listing.location}, ${listing.country}`,
            images:
              listing.images && listing.images.length > 0
                ? [listing.images[0].url]
                : [],
          },
          unit_amount: Math.round(booking.subtotal * 100),
        },
        quantity: 1,
      },
      {
        price_data: {
          currency: config.stripe.currency,
          product_data: {
            name: "GST (18%)",
            description: "Goods and Services Tax",
          },
          unit_amount: Math.round(booking.gstAmount * 100),
        },
        quantity: 1,
      },
    ],
    success_url:
      config.stripe.successUrl(host) + "?session_id={CHECKOUT_SESSION_ID}",
    cancel_url: config.stripe.cancelUrl(host),
  });

  return { url: session.url, id: session.id };
}

/**
 * Retrieves a Stripe Checkout Session by ID.
 * Used on the success redirect to verify payment went through.
 *
 * @param {string} sessionId - Stripe session ID (cs_test_...)
 * @returns {Promise<object>} - Stripe session object
 */
async function retrieveSession(sessionId) {
  return stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["payment_intent"],
  });
}

/**
 * Issues a full refund for a booking when host rejects it.
 *
 * @param {string} paymentIntentId - Stripe PaymentIntent ID
 * @param {string} bookingId       - Our booking ID (for metadata)
 * @returns {Promise<object>}      - Stripe Refund object
 */
async function issueRefund(paymentIntentId, bookingId) {
  return stripe.refunds.create({
    payment_intent: paymentIntentId,
    metadata: { bookingId },
  });
}

/**
 * Validates and constructs a Stripe webhook event.
 * Throws if signature is invalid (prevents forged webhook calls).
 *
 * @param {Buffer} rawBody   - Raw request body (must be Buffer not parsed JSON)
 * @param {string} signature - stripe-signature header value
 * @returns {object}         - Verified Stripe event object
 */
function constructWebhookEvent(rawBody, signature) {
  return stripe.webhooks.constructEvent(
    rawBody,
    signature,
    config.stripe.webhookSecret,
  );
}

module.exports = {
  createCheckoutSession,
  retrieveSession,
  issueRefund,
  constructWebhookEvent,
};
