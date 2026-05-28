const Listing = require("../models/listing.js");
const Booking = require("../models/booking.js");
const AppError = require("../utils/expressErr.js");
const { BOOKING_STATUS } = require("../utils/constants.js");

/**
 * Renders the analytics dashboard for a listing.
 * Only accessible by the listing owner.
 *
 * @route  GET /listings/:id/analytics
 * @access Listing owner only
 */
async function renderAnalytics(req, res) {
    const { id } = req.params;

    const listing = await Listing.findById(id);
    if (!listing) {
        req.flash("error", "Listing not found.");
        return req.session.save(() => res.redirect("/listings"));
    }

    // Ownership check
    if (!listing.owner.equals(req.user._id)) {
        req.flash("error", "You do not have permission to view this.");
        return req.session.save(() => res.redirect(`/listings/${id}`));
    }

    // ─── All bookings for this listing ───────────────────────────
    const allBookings = await Booking.find({ listing: id });

    const confirmedBookings = allBookings.filter(
        (b) => b.status === BOOKING_STATUS.CONFIRMED
            && b.paymentStatus === "paid"
    );

    const cancelledBookings = allBookings.filter(
        (b) => b.status === BOOKING_STATUS.CANCELLED
    );

    // ─── Overview stats ───────────────────────────────────────────
    const totalRevenue = confirmedBookings.reduce(
        (sum, b) => sum + (b.totalPrice || 0), 0
    );

    const totalNights = confirmedBookings.reduce(
        (sum, b) => sum + (b.nights || 0), 0
    );

    const avgStayLength = confirmedBookings.length > 0
        ? (totalNights / confirmedBookings.length).toFixed(1)
        : 0;

    // ─── Occupancy rate (last 90 days) ────────────────────────────
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const recentBookings = confirmedBookings.filter(
        (b) => new Date(b.checkIn) >= ninetyDaysAgo
    );

    const occupiedDays = recentBookings.reduce(
        (sum, b) => sum + (b.nights || 0), 0
    );

    const occupancyRate = Math.min(
        Math.round((occupiedDays / 90) * 100), 100
    );

    // ─── Monthly revenue (last 6 months) ─────────────────────────
    const monthlyData = {};
    const now = new Date();

    // Initialize last 6 months with 0
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = d.toLocaleDateString("en-IN", {
            month: "short", year: "numeric",
        });
        monthlyData[key] = { revenue: 0, bookings: 0 };
    }

    // Fill with actual data
    confirmedBookings.forEach((b) => {
        const d = new Date(b.createdAt);
        const key = d.toLocaleDateString("en-IN", {
            month: "short", year: "numeric",
        });
        if (monthlyData[key] !== undefined) {
            monthlyData[key].revenue  += b.totalPrice || 0;
            monthlyData[key].bookings += 1;
        }
    });

    // ─── Most popular month ───────────────────────────────────────
    const monthCounts = {};
    confirmedBookings.forEach((b) => {
        const month = new Date(b.checkIn)
            .toLocaleDateString("en-IN", { month: "long" });
        monthCounts[month] = (monthCounts[month] || 0) + 1;
    });

    const popularMonth = Object.entries(monthCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";

    // ─── Max revenue for chart scaling ───────────────────────────
    const maxMonthlyRevenue = Math.max(
        ...Object.values(monthlyData).map((d) => d.revenue),
        1 // prevent division by zero
    );

    res.render("listings/analytics.ejs", {
        listing,
        // Overview
        totalViews:       listing.viewCount || 0,
        wishlistSaves:    listing.wishlistCount || 0,
        totalBookings:    confirmedBookings.length,
        cancelledCount:   cancelledBookings.length,
        totalRevenue,
        // Stay stats
        avgStayLength,
        occupancyRate,
        popularMonth,
        // Chart data
        monthlyData,
        maxMonthlyRevenue,
    });
}

module.exports = { renderAnalytics };
