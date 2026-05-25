const listingRouter = require("../route/listing");
const reviewRouter  = require("../route/review");
const userRouter    = require("../route/user");
const bookingRouter = require("../route/booking");
const AppError      = require("../utils/expressErr");

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

    // ─── Feature routes ──────────────────────────────────────────────────
    app.use("/listings", listingRouter);
    app.use("/listings/:id/reviews", reviewRouter);
    app.use("/", userRouter);
    app.use("/listings/:id/bookings", bookingRouter);
    app.use("/", bookingRouter);

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
