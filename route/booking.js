const express = require("express");
const router = express.Router({ mergeParams: true });
const wrapAsync = require("../utils/wrapAsync.js");
const { isLoggedIn, validateCsrf, validateBooking } = require("../middleware.js");
const bookingController = require("../Controllers/booking.js");

// Mounted at /listings/:id/bookings
router.post(
    "/",
    isLoggedIn,
    validateCsrf,
    validateBooking,
    wrapAsync(bookingController.createBooking)
);

// Payment redirect handlers (must be before :bookingId routes)
router.get(
    "/bookings/payment/success",
    isLoggedIn,
    wrapAsync(bookingController.paymentSuccess)
);

router.get(
    "/bookings/payment/cancel",
    isLoggedIn,
    wrapAsync(bookingController.paymentCancel)
);

// Mounted at /
router.get(
    "/bookings",
    isLoggedIn,
    wrapAsync(bookingController.renderMyBookings)
);

router.get(
    "/host/bookings",
    isLoggedIn,
    wrapAsync(bookingController.renderHostBookings)
);

// Guest cancels their own booking
router.post(
    "/bookings/:id/cancel",
    isLoggedIn,
    validateCsrf,
    wrapAsync(bookingController.cancelBooking)
);

// Host rejects a booking on their listing
router.post(
    "/bookings/:id/reject",
    isLoggedIn,
    validateCsrf,
    wrapAsync(bookingController.rejectBooking)
);

module.exports = router;
