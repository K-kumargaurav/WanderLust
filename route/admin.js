const express    = require('express');
const router     = express.Router();
const wrapAsync  = require('../utils/wrapAsync.js');
const { isLoggedIn, isAdmin, validateCsrf } =
  require('../middleware.js');
const adminController = require('../Controllers/admin.js');

// All admin routes require login + admin role
router.use(isLoggedIn, isAdmin);

// ── Dashboard ─────────────────────────────────────────────────
router.get(
  '/',
  wrapAsync(adminController.renderDashboard)
);

// ── Users ─────────────────────────────────────────────────────
router.get(
  '/users',
  wrapAsync(adminController.renderUsers)
);

router.put(
  '/users/:id/ban',
  validateCsrf,
  wrapAsync(adminController.banUser)
);

router.put(
  '/users/:id/unban',
  validateCsrf,
  wrapAsync(adminController.unbanUser)
);

// ── Listings ──────────────────────────────────────────────────
router.get(
  '/listings',
  wrapAsync(adminController.renderListings)
);

router.delete(
  '/listings/:id',
  validateCsrf,
  wrapAsync(adminController.adminDeleteListing)
);

router.put(
  '/listings/:id/restore',
  validateCsrf,
  wrapAsync(adminController.restoreListing)
);

// ── Reviews ───────────────────────────────────────────────────
router.get(
  '/reviews',
  wrapAsync(adminController.renderReviews)
);

router.delete(
  '/reviews/:id',
  validateCsrf,
  wrapAsync(adminController.adminDeleteReview)
);

router.put(
  '/reviews/:id/restore',
  validateCsrf,
  wrapAsync(adminController.restoreReview)
);

// ── Bookings ──────────────────────────────────────────────────
router.get(
  '/bookings',
  wrapAsync(adminController.renderBookings)
);

module.exports = router;
