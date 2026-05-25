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

// Mounted at /
router.delete(
    "/bookings/:bookingId",
    isLoggedIn,
    validateCsrf,
    wrapAsync(bookingController.cancelBooking)
);

router.put(
    "/bookings/:bookingId/confirm",
    isLoggedIn,
    validateCsrf,
    wrapAsync(bookingController.confirmBooking)
);

router.put(
    "/bookings/:bookingId/reject",
    isLoggedIn,
    validateCsrf,
    wrapAsync(bookingController.rejectBooking)
);

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

module.exports = router;
