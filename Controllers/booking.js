const Listing = require("../models/listing.js");
const Booking = require("../models/booking.js");
const { BOOKING_STATUS, GST_RATE } = require("../utils/constants.js");
const {
    createCheckoutSession,
    retrieveSession,
    issueRefund,
} = require("../services/payment.service.js");
const {
    sendBookingRequestToGuest,
    sendBookingNotificationToHost,
    sendBookingConfirmedToGuest,
    sendBookingCancelledToGuest,
    sendCancellationNotificationToHost,
} = require("../services/email.service.js");

const ONE_DAY_MS = 1000 * 60 * 60 * 24;

/**
 * Creates a new booking for a listing after checking for
 * ownership, date conflicts, and overlap.
 * Booking is auto-confirmed after successful Stripe payment.
 *
 * @route   POST /listings/:id/bookings
 * @access  Authenticated (non-owner)
 *
 * @param   {import('express').Request}  req
 * @param   {import('express').Response} res
 * @returns {Promise<void>}
 */
module.exports.createBooking = async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findById(id);
    if (!listing) {
        req.flash("error", "Listing does not exist!");
        return req.session.save(() => res.redirect("/listings"));
    }

    if (listing.owner.equals(req.user._id)) {
        req.flash("error", "You cannot book your own listing.");
        return req.session.save(() => res.redirect(`/listings/${id}`));
    }

    const checkIn = new Date(req.body.booking.checkIn);
    const checkOut = new Date(req.body.booking.checkOut);

    const overlapping = await Booking.findOverlapping(listing._id, checkIn, checkOut);
    if (overlapping.length > 0) {
        req.flash("error", "These dates are already booked. Please choose different dates.");
        return req.session.save(() => res.redirect(`/listings/${id}`));
    }

    const nights     = Math.ceil((checkOut - checkIn) / ONE_DAY_MS);
    const subtotal   = nights * listing.price;
    const gstAmount  = Math.round(subtotal * GST_RATE);
    const totalPrice = subtotal + gstAmount;

    const booking = new Booking({
        listing: listing._id,
        guest: req.user._id,
        checkIn,
        checkOut,
        nights,
        pricePerNight: listing.price,
        subtotal,
        gstAmount,
        totalPrice,
        status: BOOKING_STATUS.CONFIRMED,
        paymentStatus: "unpaid",
    });
    await booking.save();

    // Notify guest that booking request was received (best effort)
    try {
        await sendBookingRequestToGuest(req.user.email, {
            ...booking.toObject(),
            listing,
        });
    } catch (emailErr) {
        console.error("[email] booking request to guest failed:", emailErr.message);
    }

    // Create Stripe Checkout Session and redirect guest to payment page
    let checkoutResult;
    try {
        checkoutResult = await createCheckoutSession(
            booking, listing, req.user, req.headers.host
        );
    } catch (stripeErr) {
        console.error("[payment] checkout session failed:", stripeErr.message);
        await Booking.findByIdAndDelete(booking._id);
        req.flash("error", "Payment setup failed. Please try again.");
        return req.session.save(() => res.redirect(`/listings/${id}`));
    }

    booking.stripeSessionId = checkoutResult.id;
    await booking.save();

    return res.redirect(checkoutResult.url);
};

/**
 * Renders the guest's bookings page, split into upcoming and past.
 *
 * @route   GET /bookings
 * @access  Authenticated
 *
 * @param   {import('express').Request}  req
 * @param   {import('express').Response} res
 * @returns {Promise<void>}
 */
module.exports.renderMyBookings = async (req, res) => {
    const bookings = await Booking.find({ guest: req.user._id })
        .populate({
            path: "listing",
            select: "title location country images price owner",
        })
        .sort({ createdAt: -1 });

    const today = new Date();
    const upcoming = [];
    const past = [];

    for (const b of bookings) {
        if (b.checkOut >= today && b.status !== BOOKING_STATUS.CANCELLED) {
            upcoming.push(b);
        } else {
            past.push(b);
        }
    }

    res.render("bookings/index.ejs", { upcoming, past });
};

/**
 * Renders the host dashboard showing bookings across all owned listings.
 *
 * @route   GET /bookings/host
 * @access  Authenticated (listing owners)
 *
 * @param   {import('express').Request}  req
 * @param   {import('express').Response} res
 * @returns {Promise<void>}
 */
module.exports.renderHostBookings = async (req, res) => {
    const ownedListings = await Listing.find({ owner: req.user._id }).select("_id");
    const listingIds = ownedListings.map((l) => l._id);

    const bookings = await Booking.find({
        listing: { $in: listingIds },
        status: { $ne: BOOKING_STATUS.CANCELLED },
    })
        .populate("guest", "username email")
        .populate("listing", "title location")
        .sort({ checkIn: 1 });

    res.render("bookings/host.ejs", { bookings });
};

/**
 * Handles Stripe redirect after successful payment.
 * Verifies the session, confirms booking and marks as paid.
 *
 * @route   GET /bookings/payment/success
 * @access  Authenticated
 *
 * @param   {import('express').Request}  req
 * @param   {import('express').Response} res
 * @returns {Promise<void>}
 */
module.exports.paymentSuccess = async (req, res) => {
    const { session_id } = req.query;

    if (!session_id) {
        req.flash("error", "Invalid payment session.");
        return req.session.save(() => res.redirect("/bookings"));
    }

    // Retrieve and verify the session from Stripe
    const session = await retrieveSession(session_id);

    if (session.payment_status !== "paid") {
        req.flash("error", "Payment was not completed. Please try again.");
        return req.session.save(() => res.redirect("/bookings"));
    }

    // Find the booking by session ID
    const booking = await Booking.findOne({
        stripeSessionId: session.id,
    });

    if (!booking) {
        req.flash("error", "Booking not found.");
        return req.session.save(() => res.redirect("/bookings"));
    }

    // payment_intent can be a string ID or an expanded object
    const paymentIntentId = typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id;

    console.log("[payment] paymentIntentId to save:", paymentIntentId);
    console.log("[payment] session.payment_intent:", session.payment_intent);
    console.log("[payment] session.payment_intent type:", typeof session.payment_intent);

    // Update payment and status fields
    booking.stripePaymentIntentId = paymentIntentId;
    booking.paymentStatus = "paid";
    booking.status = BOOKING_STATUS.CONFIRMED;
    await booking.save();

    console.log("[payment] booking saved with paymentIntentId:", booking.stripePaymentIntentId);

    // 1. Confirm payment to guest
    try {
        const populatedBooking = await Booking.findById(booking._id)
            .populate("listing")
            .populate("guest");

        await sendBookingConfirmedToGuest(
            populatedBooking.guest.email,
            populatedBooking
        );
    } catch (emailErr) {
        console.error("[email] booking confirmed to guest failed:", emailErr.message);
    }

    // 2. Notify host of new booking
    try {
        const populatedBooking = await Booking.findById(booking._id)
            .populate({ path: "listing", populate: { path: "owner" } })
            .populate("guest");

        if (populatedBooking.listing.owner?.email) {
            await sendBookingNotificationToHost(
                populatedBooking.listing.owner.email,
                populatedBooking
            );
        }
    } catch (emailErr) {
        console.error("[email] booking notification to host failed:", emailErr.message);
    }

    req.flash("success", "Booking confirmed! Enjoy your stay.");
    return req.session.save(() => res.redirect("/bookings"));
};

/**
 * Handles Stripe redirect when guest cancels payment.
 * Deletes the unpaid booking.
 *
 * @route   GET /bookings/payment/cancel
 * @access  Authenticated
 *
 * @param   {import('express').Request}  req
 * @param   {import('express').Response} res
 * @returns {Promise<void>}
 */
module.exports.paymentCancel = async (req, res) => {
    // Find and delete the most recent unpaid booking for this guest
    await Booking.findOneAndDelete({
        guest: req.user._id,
        paymentStatus: "unpaid",
    });

    req.flash("error", "Payment cancelled. Your booking was not confirmed.");
    return req.session.save(() => res.redirect("/listings"));
};

/**
 * Cancels a confirmed booking (guest-initiated).
 * Sends notification emails to both guest and host.
 *
 * @route   POST /bookings/:id/cancel
 * @access  Authenticated (booking guest only)
 *
 * @param   {import('express').Request}  req
 * @param   {import('express').Response} res
 * @returns {Promise<void>}
 */
module.exports.cancelBooking = async (req, res) => {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
        req.flash("error", "Booking not found.");
        return req.session.save(() => res.redirect("/bookings"));
    }

    if (!booking.guest.equals(req.user._id)) {
        req.flash("error", "You can only cancel your own bookings.");
        return req.session.save(() => res.redirect("/bookings"));
    }

    console.log("[cancel] booking fields:", {
        id:                    booking._id,
        status:                booking.status,
        paymentStatus:         booking.paymentStatus,
        stripePaymentIntentId: booking.stripePaymentIntentId,
        stripeSessionId:       booking.stripeSessionId,
    });

    // Issue Stripe refund if booking was paid
    if (booking.paymentStatus === "paid") {
        let paymentIntentId = booking.stripePaymentIntentId;

        // Fallback: retrieve paymentIntentId from Stripe session
        if (!paymentIntentId && booking.stripeSessionId) {
            try {
                const session = await retrieveSession(booking.stripeSessionId);
                paymentIntentId = typeof session.payment_intent === "string"
                    ? session.payment_intent
                    : session.payment_intent?.id;

                // Save it for future use
                booking.stripePaymentIntentId = paymentIntentId;
                console.log("[cancel] retrieved paymentIntentId from session:", paymentIntentId);
            } catch (sessionErr) {
                console.error("[cancel] could not retrieve session:", sessionErr.message);
            }
        }

        if (paymentIntentId) {
            try {
                await issueRefund(paymentIntentId, booking._id.toString());
                booking.paymentStatus = "refunded";
                console.log("[cancel] refund issued for:", paymentIntentId);
            } catch (refundErr) {
                console.error("[cancel] refund failed:", refundErr.message);
                req.flash("error", "Refund failed. Please contact support.");
                return req.session.save(() => res.redirect("/bookings"));
            }
        } else {
            console.error("[cancel] no paymentIntentId found — refund skipped");
        }
    }

    booking.status = BOOKING_STATUS.CANCELLED;
    await booking.save();

    // 1. Confirm cancellation to guest
    try {
        const populatedBooking = await Booking.findById(booking._id)
            .populate("listing")
            .populate("guest");

        await sendBookingCancelledToGuest(
            populatedBooking.guest.email,
            populatedBooking,
            "cancelled"
        );
    } catch (emailErr) {
        console.error("[email] cancellation to guest failed:", emailErr.message);
    }

    // 2. Notify host of cancellation
    try {
        const populatedBooking = await Booking.findById(booking._id)
            .populate({ path: "listing", populate: { path: "owner" } })
            .populate("guest");

        if (populatedBooking.listing.owner?.email) {
            await sendCancellationNotificationToHost(
                populatedBooking.listing.owner.email,
                populatedBooking
            );
        }
    } catch (emailErr) {
        console.error("[email] cancellation notification to host failed:", emailErr.message);
    }

    req.flash("success", "Booking cancelled.");
    return req.session.save(() => res.redirect("/bookings"));
};

/**
 * Rejects a booking (host-initiated).
 * Sends rejection email to the guest.
 *
 * @route   POST /bookings/:id/reject
 * @access  Authenticated (listing owner only)
 *
 * @param   {import('express').Request}  req
 * @param   {import('express').Response} res
 * @returns {Promise<void>}
 */
module.exports.rejectBooking = async (req, res) => {
    const booking = await Booking.findById(req.params.id)
        .populate("listing");
    if (!booking) {
        req.flash("error", "Booking not found.");
        return req.session.save(() => res.redirect("/host/bookings"));
    }

    if (!booking.listing.owner.equals(req.user._id)) {
        req.flash("error", "You can only reject bookings on your own listings.");
        return req.session.save(() => res.redirect("/host/bookings"));
    }

    booking.status = BOOKING_STATUS.CANCELLED;
    await booking.save();

    // Notify guest of rejection
    try {
        const populatedBooking = await Booking.findById(booking._id)
            .populate("listing")
            .populate("guest");

        await sendBookingCancelledToGuest(
            populatedBooking.guest.email,
            populatedBooking,
            "rejected"
        );
    } catch (emailErr) {
        console.error("[email] rejection email to guest failed:", emailErr.message);
    }

    req.flash("success", "Booking rejected.");
    return req.session.save(() => res.redirect("/host/bookings"));
};

/**
 * Returns all booked/confirmed date ranges for a listing.
 * Used by flatpickr to disable unavailable dates on the frontend.
 *
 * @route   GET /listings/:id/booked-dates
 * @access  Public (no auth needed — just viewing availability)
 *
 * @param   {import('express').Request}  req
 * @param   {import('express').Response} res
 * @returns {Promise<void>}
 */
module.exports.getBookedDates = async (req, res) => {
    const { id } = req.params;

    const bookings = await Booking.find({
        listing: id,
        status: BOOKING_STATUS.CONFIRMED,
        paymentStatus: "paid",
        checkOut: { $gte: new Date() },
    }).select("checkIn checkOut");

    const bookedRanges = bookings.map((b) => ({
        from: b.checkIn.toISOString().split("T")[0],
        to: b.checkOut.toISOString().split("T")[0],
    }));

    return res.json({ bookedRanges });
};
