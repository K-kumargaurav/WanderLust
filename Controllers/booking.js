const Listing = require("../models/listing.js");
const Booking = require("../models/booking.js");
const { BOOKING_STATUS, GST_RATE } = require("../utils/constants.js");
const {
    createCheckoutSession,
    retrieveSession,
} = require("../services/payment.service.js");

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

    // Update payment and status fields
    booking.stripePaymentIntentId =
        session.payment_intent?.id || session.payment_intent;
    booking.paymentStatus = "paid";
    booking.status = BOOKING_STATUS.CONFIRMED;
    await booking.save();

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
