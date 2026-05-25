const config = require("../config/index.js");
const AppError = require("../utils/expressErr.js");
const wrapAsync = require("../utils/wrapAsync.js");
const Listing = require("../models/listing.js");
const Booking = require("../models/booking.js");
const { BOOKING_STATUS, GST_RATE } = require("../utils/constants.js");
const { sendBookingConfirmationEmail } = require("../services/email.service.js");

const ONE_DAY_MS = 1000 * 60 * 60 * 24;

/**
 * Creates a new booking for a listing after checking for
 * ownership, date conflicts, and overlap.
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
        status: BOOKING_STATUS.PENDING,
    });
    await booking.save();

    req.flash("success", "Booking request sent! The host will confirm shortly.");
    return req.session.save(() => res.redirect("/bookings"));
};

/**
 * Cancels an existing confirmed booking.
 *
 * @route   POST /bookings/:bookingId/cancel
 * @access  Guest who made the booking
 *
 * @param   {import('express').Request}  req
 * @param   {import('express').Response} res
 * @returns {Promise<void>}
 */
module.exports.cancelBooking = async (req, res) => {
    const { bookingId } = req.params;
    const booking = await Booking.findById(bookingId).populate("listing");

    if (!booking) {
        req.flash("error", "Booking not found.");
        return req.session.save(() => res.redirect("/bookings"));
    }

    if (!booking.guest.equals(req.user._id)) {
        req.flash("error", "You can only cancel your own bookings.");
        return req.session.save(() => res.redirect("/bookings"));
    }

    if (booking.status === BOOKING_STATUS.CANCELLED) {
        req.flash("error", "This booking is already cancelled.");
        return req.session.save(() => res.redirect("/bookings"));
    }

    booking.status = BOOKING_STATUS.CANCELLED;
    await booking.save();

    req.flash("success", "Booking cancelled successfully.");
    return req.session.save(() => res.redirect("/bookings"));
};

/**
 * Allows a listing owner to confirm a pending booking.
 *
 * @route   PUT /bookings/:bookingId/confirm
 * @access  Listing owner only
 *
 * @param   {import('express').Request}  req
 * @param   {import('express').Response} res
 * @returns {Promise<void>}
 */
module.exports.confirmBooking = async (req, res) => {
    const booking = await Booking.findById(req.params.bookingId)
        .populate("listing")
        .populate("guest");

    if (!booking) {
        req.flash("error", "Booking not found.");
        return req.session.save(() => res.redirect("/host/bookings"));
    }

    if (!booking.listing.owner.equals(req.user._id)) {
        req.flash("error", "You are not authorized to confirm this booking.");
        return req.session.save(() => res.redirect("/host/bookings"));
    }

    if (booking.status !== BOOKING_STATUS.PENDING) {
        req.flash("error", "This booking cannot be confirmed.");
        return req.session.save(() => res.redirect("/host/bookings"));
    }

    booking.status = BOOKING_STATUS.CONFIRMED;
    await booking.save();

    try {
        await sendBookingConfirmationEmail(
            booking.guest.email, booking, req.headers.host
        );
    } catch (err) {
        console.error("[booking] confirm email failed:", err.message);
    }

    req.flash("success", "Booking confirmed! The guest has been notified.");
    return req.session.save(() => res.redirect("/host/bookings"));
};

/**
 * Allows a listing owner to reject a pending booking.
 *
 * @route   PUT /bookings/:bookingId/reject
 * @access  Listing owner only
 *
 * @param   {import('express').Request}  req
 * @param   {import('express').Response} res
 * @returns {Promise<void>}
 */
module.exports.rejectBooking = async (req, res) => {
    const booking = await Booking.findById(req.params.bookingId)
        .populate("listing");

    if (!booking) {
        req.flash("error", "Booking not found.");
        return req.session.save(() => res.redirect("/host/bookings"));
    }

    if (!booking.listing.owner.equals(req.user._id)) {
        req.flash("error", "You are not authorized to reject this booking.");
        return req.session.save(() => res.redirect("/host/bookings"));
    }

    if (booking.status !== BOOKING_STATUS.PENDING) {
        req.flash("error", "This booking cannot be rejected.");
        return req.session.save(() => res.redirect("/host/bookings"));
    }

    booking.status = BOOKING_STATUS.CANCELLED;
    await booking.save();

    req.flash("success", "Booking rejected and dates released.");
    return req.session.save(() => res.redirect("/host/bookings"));
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
