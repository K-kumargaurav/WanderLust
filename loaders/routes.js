const express = require("express");
const listingRouter = require("../route/listing");
const reviewRouter = require("../route/review");
const userRouter = require("../route/user");
const bookingRouter = require("../route/booking");
const conversationRouter = require("../route/conversation");
const adminRouter = require("../route/admin.js");
const bookingController = require("../Controllers/booking");
const wrapAsync = require("../utils/wrapAsync");
const AppError = require("../utils/expressErr");

/**
 * Mounts all route handlers and error middleware on the app.
 *
 * @param {import('express').Express} app
 */
function setupRoutes(app) {
    // ─── Health check (for Render monitoring) ────────────────────────────
    app.get("/health", (req, res) => res.status(200).json({ status: "ok" }));

    // ─── Root redirect ───────────────────────────────────────────────────
    app.get("/", (req, res) => res.redirect("/listings"));

    // ─── Static pages ────────────────────────────────────────────────────
    app.get("/privacy", (req, res) => res.render("pages/privacy"));
    app.get("/terms", (req, res) => res.render("pages/terms"));

    // ─── Dynamic sitemap ───────────────────────────────────────────────
    const Listing = require('../models/listing.js');

    app.get('/sitemap.xml', async (req, res) => {
        try {
            const listings = await Listing
                .find({ deleted: { $ne: true } })
                .select('_id updatedAt')
                .lean();

            const baseUrl    = `${req.protocol}://${req.get('host')}`;
            const staticUrls = [
                { loc: baseUrl,               priority: '1.0' },
                { loc: `${baseUrl}/listings`, priority: '0.9' },
                { loc: `${baseUrl}/signup`,   priority: '0.7' },
                { loc: `${baseUrl}/login`,    priority: '0.7' },
            ];

            const listingUrls = listings.map((l) => ({
                loc:      `${baseUrl}/listings/${l._id}`,
                lastmod:  new Date(l.updatedAt || Date.now())
                              .toISOString().split('T')[0],
                priority: '0.8',
            }));

            const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...staticUrls, ...listingUrls].map((u) => `  <url>
    <loc>${u.loc}</loc>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ''}
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

            res.setHeader('Content-Type', 'application/xml');
            res.setHeader('Cache-Control', 'public, max-age=86400');
            res.send(xml);
        } catch (err) {
            res.status(500).send('Error generating sitemap');
        }
    });

    // ─── Booked dates API (before listing router to avoid :id conflict) ──
    app.get(
        "/listings/:id/booked-dates",
        wrapAsync(bookingController.getBookedDates)
    );

    // ─── Feature routes ──────────────────────────────────────────────────
    app.use("/admin", adminRouter);
    app.use("/listings", listingRouter);
    app.use("/listings/:id/reviews", reviewRouter);
    app.use("/", userRouter);
    app.use("/listings/:id/bookings", bookingRouter);
    app.use("/", bookingRouter);
    app.use("/", conversationRouter);

    // ─── 404 catch-all ───────────────────────────────────────────────────
    app.all(/(.*)/, (req, res, next) => {
        next(new AppError(404, "Page Not Found!"));
    });

    // ─── Global error handler ────────────────────────────────────────────
    app.use((err, req, res, next) => {
        const { status = 500, message = "Something went wrong." } = err;
        res.status(status).render("error.ejs", { message, status });
    });
}

module.exports = { setupRoutes };
