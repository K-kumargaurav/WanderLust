const User         = require('../models/user.js');
const Listing      = require('../models/listing.js');
const Booking      = require('../models/booking.js');
const Review       = require('../models/review.js');
const Conversation = require('../models/conversation.js');
const { BOOKING_STATUS } = require('../utils/constants.js');

/**
 * Admin overview dashboard with platform-wide stats.
 * @route  GET /admin
 * @access Admin only
 */
async function renderDashboard(req, res) {

  const now = new Date();
  const thisMonthStart = new Date(
    now.getFullYear(), now.getMonth(), 1
  );
  const lastMonthStart = new Date(
    now.getFullYear(), now.getMonth() - 1, 1
  );

  // ── Platform totals ──────────────────────────────────────────
  const [
    totalUsers,
    totalListings,
    totalBookings,
    totalReviews,
    totalConversations,
    newUsersThisMonth,
    newListingsThisMonth,
    newBookingsThisMonth,
  ] = await Promise.all([
    User.countDocuments(),
    Listing.countDocuments(),
    Booking.countDocuments(),
    Review.countDocuments(),
    Conversation.countDocuments(),
    User.countDocuments({
      _id: { $gte: require('mongoose')
        .Types.ObjectId.createFromTime(
          thisMonthStart.getTime() / 1000
        )
      }
    }),
    Listing.countDocuments({ createdAt: { $gte: thisMonthStart } }),
    Booking.countDocuments({ createdAt: { $gte: thisMonthStart } }),
  ]);

  // ── Revenue stats ────────────────────────────────────────────
  const revenueResult = await Booking.aggregate([
    {
      $match: {
        status:        BOOKING_STATUS.CONFIRMED,
        paymentStatus: 'paid',
      },
    },
    {
      $group: {
        _id:          null,
        totalRevenue: { $sum: '$totalPrice' },
        avgBookingValue: { $avg: '$totalPrice' },
      },
    },
  ]);

  const totalRevenue     = revenueResult[0]?.totalRevenue || 0;
  const avgBookingValue  = Math.round(
    revenueResult[0]?.avgBookingValue || 0
  );

  // ── Monthly signups (last 6 months) ──────────────────────────
  const sixMonthsAgo = new Date(
    now.getFullYear(), now.getMonth() - 5, 1
  );

  const monthlySignups = await User.aggregate([
    { $match: {
      _id: { $gte: require('mongoose')
        .Types.ObjectId.createFromTime(
          sixMonthsAgo.getTime() / 1000
        )
      }
    }},
    { $group: {
      _id: {
        year:  { $year:  '$_id' },
        month: { $month: '$_id' },
      },
      count: { $sum: 1 },
    }},
    { $sort: { '_id.year': 1, '_id.month': 1 } },
  ]);

  // ── Recent activity ───────────────────────────────────────────
  const recentBookings = await Booking
    .find()
    .populate('guest', 'username email')
    .populate('listing', 'title')
    .sort({ createdAt: -1 })
    .limit(5);

  const recentUsers = await User
    .find()
    .sort({ _id: -1 })
    .limit(5)
    .select('username email role createdAt');

  res.render('admin/dashboard.ejs', {
    // Totals
    totalUsers,
    totalListings,
    totalBookings,
    totalReviews,
    totalConversations,
    // This month
    newUsersThisMonth,
    newListingsThisMonth,
    newBookingsThisMonth,
    // Revenue
    totalRevenue,
    avgBookingValue,
    // Activity
    recentBookings,
    recentUsers,
    // Chart
    monthlySignups,
  });
}

/**
 * Lists all users with stats and ban/unban controls.
 * @route  GET /admin/users
 * @access Admin only
 */
async function renderUsers(req, res) {
  const page  = Math.max(1, parseInt(req.query.page) || 1);
  const limit = 20;
  const search = (req.query.q || '').trim();

  const query = search
    ? { $or: [
        { username: new RegExp(search, 'i') },
        { email:    new RegExp(search, 'i') },
      ]}
    : {};

  const [users, total] = await Promise.all([
    User.find(query)
      .sort({ _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('username email role wishlist createdAt banned'),
    User.countDocuments(query),
  ]);

  // Get listing and booking counts per user
  const userIds = users.map((u) => u._id);

  const [listingCounts, bookingCounts] = await Promise.all([
    Listing.aggregate([
      { $match: { owner: { $in: userIds } } },
      { $group: { _id: '$owner', count: { $sum: 1 } } },
    ]),
    Booking.aggregate([
      { $match: { guest: { $in: userIds } } },
      { $group: { _id: '$guest', count: { $sum: 1 } } },
    ]),
  ]);

  const listingMap = {};
  listingCounts.forEach((l) => {
    listingMap[l._id.toString()] = l.count;
  });

  const bookingMap = {};
  bookingCounts.forEach((b) => {
    bookingMap[b._id.toString()] = b.count;
  });

  const usersWithStats = users.map((u) => ({
    ...u.toObject(),
    listingCount: listingMap[u._id.toString()] || 0,
    bookingCount: bookingMap[u._id.toString()] || 0,
  }));

  res.render('admin/users.ejs', {
    users: usersWithStats,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    search,
  });
}

/**
 * Bans a user — prevents login.
 * @route  PUT /admin/users/:id/ban
 */
async function banUser(req, res) {
  const user = await User.findById(req.params.id);

  if (!user) {
    req.flash('error', 'User not found.');
    return req.session.save(() => res.redirect('/admin/users'));
  }

  if (user.role === 'admin') {
    req.flash('error', 'Cannot ban an admin user.');
    return req.session.save(() => res.redirect('/admin/users'));
  }

  user.banned = true;
  await user.save();

  req.flash('success', `User @${user.username} has been banned.`);
  return req.session.save(() => res.redirect('/admin/users'));
}

/**
 * Unbans a user — restores login access.
 * @route  PUT /admin/users/:id/unban
 */
async function unbanUser(req, res) {
  const user = await User.findById(req.params.id);

  if (!user) {
    req.flash('error', 'User not found.');
    return req.session.save(() => res.redirect('/admin/users'));
  }

  user.banned = false;
  await user.save();

  req.flash('success', `User @${user.username} has been unbanned.`);
  return req.session.save(() => res.redirect('/admin/users'));
}

/**
 * Lists all listings with owner info and stats.
 * @route  GET /admin/listings
 * @access Admin only
 */
async function renderListings(req, res) {
  const page         = Math.max(1, parseInt(req.query.page) || 1);
  const limit        = 20;
  const search       = (req.query.q || '').trim();
  const showDeleted  = req.query.deleted === 'true';

  const baseQuery = search
    ? { $or: [
        { title:    new RegExp(search, 'i') },
        { location: new RegExp(search, 'i') },
        { country:  new RegExp(search, 'i') },
      ]}
    : {};

  const query = {
    ...baseQuery,
    deleted: showDeleted ? true : { $ne: true },
  };

  const [listings, total, activeCount, deletedCount] = await Promise.all([
    Listing.find(query)
      .populate('owner', 'username email')
      .populate('deletedBy', 'username')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Listing.countDocuments(query),
    Listing.countDocuments({ ...baseQuery, deleted: { $ne: true } }),
    Listing.countDocuments({ ...baseQuery, deleted: true }),
  ]);

  // Get booking counts per listing
  const listingIds = listings.map((l) => l._id);
  const bookingCounts = await Booking.aggregate([
    { $match: { listing: { $in: listingIds } } },
    { $group: { _id: '$listing', count: { $sum: 1 } } },
  ]);

  const bookingMap = {};
  bookingCounts.forEach((b) => {
    bookingMap[b._id.toString()] = b.count;
  });

  const listingsWithStats = listings.map((l) => ({
    ...l.toObject(),
    bookingCount: bookingMap[l._id.toString()] || 0,
  }));

  res.render('admin/listings.ejs', {
    listings: listingsWithStats,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    search,
    showDeleted,
    activeCount,
    deletedCount,
  });
}

/**
 * Admin soft-deletes a listing (sets deleted=true).
 * Listing is hidden from public-facing queries but remains in the DB.
 * @route  DELETE /admin/listings/:id
 */
async function adminDeleteListing(req, res) {
  const listing = await Listing.findById(req.params.id);

  if (!listing) {
    req.flash('error', 'Listing not found.');
    return req.session.save(() => res.redirect('/admin/listings'));
  }

  if (listing.deleted) {
    req.flash('error', 'Listing is already hidden.');
    return req.session.save(() => res.redirect('/admin/listings'));
  }

  listing.deleted   = true;
  listing.deletedAt = new Date();
  listing.deletedBy = req.user._id;
  await listing.save();

  req.flash('success', `Listing "${listing.title}" has been hidden.`);
  return req.session.save(() => res.redirect('/admin/listings'));
}

/**
 * Restores a soft-deleted listing (sets deleted=false).
 * @route  PUT /admin/listings/:id/restore
 */
async function restoreListing(req, res) {
  const listing = await Listing.findById(req.params.id);

  if (!listing) {
    req.flash('error', 'Listing not found.');
    return req.session.save(() =>
      res.redirect('/admin/listings?deleted=true')
    );
  }

  if (!listing.deleted) {
    req.flash('error', 'Listing is not hidden.');
    return req.session.save(() => res.redirect('/admin/listings'));
  }

  listing.deleted   = false;
  listing.deletedAt = null;
  listing.deletedBy = null;
  await listing.save();

  req.flash('success', `Listing "${listing.title}" has been restored.`);
  return req.session.save(() => res.redirect('/admin/listings'));
}

/**
 * Lists all reviews with author and listing info.
 * @route  GET /admin/reviews
 * @access Admin only
 */
async function renderReviews(req, res) {
  const page        = Math.max(1, parseInt(req.query.page) || 1);
  const limit       = 20;
  const showDeleted = req.query.deleted === 'true';

  const query = { deleted: showDeleted ? true : { $ne: true } };

  const [reviews, total, activeCount, deletedCount] = await Promise.all([
    Review.find(query)
      .populate('author', 'username email')
      .populate('deletedBy', 'username')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Review.countDocuments(query),
    Review.countDocuments({ deleted: { $ne: true } }),
    Review.countDocuments({ deleted: true }),
  ]);

  // Get listing title for each review
  const reviewsWithListings = await Promise.all(
    reviews.map(async (review) => {
      const listing = await Listing.findOne({
        reviews: review._id
      }).select('title _id');
      return {
        ...review.toObject(),
        listing: listing || null
      };
    })
  );

  res.render('admin/reviews.ejs', {
    reviews: reviewsWithListings,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    showDeleted,
    activeCount,
    deletedCount,
  });
}

/**
 * Admin soft-deletes a review (sets deleted=true).
 * Review remains in the listing's reviews array but is hidden from
 * the public listing page via the deleted filter.
 * @route  DELETE /admin/reviews/:id
 */
async function adminDeleteReview(req, res) {
  const review = await Review.findById(req.params.id);

  if (!review) {
    req.flash('error', 'Review not found.');
    return req.session.save(() => res.redirect('/admin/reviews'));
  }

  if (review.deleted) {
    req.flash('error', 'Review is already hidden.');
    return req.session.save(() => res.redirect('/admin/reviews'));
  }

  review.deleted   = true;
  review.deletedAt = new Date();
  review.deletedBy = req.user._id;
  await review.save();

  req.flash('success', 'Review has been hidden.');
  return req.session.save(() => res.redirect('/admin/reviews'));
}

/**
 * Restores a soft-deleted review (sets deleted=false).
 * @route  PUT /admin/reviews/:id/restore
 */
async function restoreReview(req, res) {
  const review = await Review.findById(req.params.id);

  if (!review) {
    req.flash('error', 'Review not found.');
    return req.session.save(() =>
      res.redirect('/admin/reviews?deleted=true')
    );
  }

  if (!review.deleted) {
    req.flash('error', 'Review is not hidden.');
    return req.session.save(() => res.redirect('/admin/reviews'));
  }

  review.deleted   = false;
  review.deletedAt = null;
  review.deletedBy = null;
  await review.save();

  req.flash('success', 'Review has been restored.');
  return req.session.save(() => res.redirect('/admin/reviews'));
}

/**
 * Lists all bookings across the platform.
 * @route  GET /admin/bookings
 * @access Admin only
 */
async function renderBookings(req, res) {
  const page   = Math.max(1, parseInt(req.query.page) || 1);
  const limit  = 20;
  const status = req.query.status || '';

  const query = status ? { status } : {};

  const [bookings, total] = await Promise.all([
    Booking.find(query)
      .populate('guest', 'username email')
      .populate('listing', 'title location')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Booking.countDocuments(query),
  ]);

  res.render('admin/bookings.ejs', {
    bookings,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    statusFilter: status,
  });
}

module.exports = {
  renderDashboard,
  renderUsers,
  banUser,
  unbanUser,
  renderListings,
  adminDeleteListing,
  restoreListing,
  renderReviews,
  adminDeleteReview,
  restoreReview,
  renderBookings,
};
