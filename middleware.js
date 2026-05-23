const crypto      = require("crypto");
const Listing     = require("./models/listing");
const Review      = require("./models/review");
const expressErr  = require("./utils/expressErr.js");
const { listingSchema, reviewSchema } = require("./schema.js");

// Allowed MIME types for image uploads
const ALLOWED_MIME_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/jpg",
]);

// ─── AUTH ─────────────────────────────────────────────────────────────────────
module.exports.isLoggedIn = (req, res, next) => {
    if (!req.isAuthenticated()) {
        req.session.redirectUrl = req.originalUrl;
        req.flash("error", "You must be logged in to do that.");
        return res.redirect("/login");
    }
    next();
};

module.exports.saveRedirectUrl = (req, res, next) => {
    if (req.session.redirectUrl) {
        res.locals.redirectUrl = req.session.redirectUrl;
    }
    next();
};

// ─── OWNERSHIP ────────────────────────────────────────────────────────────────

module.exports.isOwner = async (req, res, next) => {
    try {
        const { id } = req.params;
        const listing = await Listing.findById(id);

        if (!listing) {
            req.flash("error", "Listing does not exist!");
            return res.redirect("/listings");
        }

        if (!listing.owner.equals(res.locals.currUser._id)) {
            req.flash("error", "You do not have permission to do that.");
            return res.redirect(`/listings/${id}`);
        }

        next();
    } catch (err) {
        next(err);
    }
};

module.exports.isReviewAuthor = async (req, res, next) => {
    try {
        const { id, reviewId } = req.params;
        const review = await Review.findById(reviewId);

        if (!review) {
            req.flash("error", "Review does not exist!");
            return res.redirect(`/listings/${id}`);
        }

        if (!review.author.equals(res.locals.currUser._id)) {
            req.flash("error", "You do not have permission to do that.");
            return res.redirect(`/listings/${id}`);
        }

        next();
    } catch (err) {
        next(err);
    }
};

// ─── VALIDATION ───────────────────────────────────────────────────────────────
module.exports.validateListing = (req, res, next) => {
    const { error } = listingSchema.validate(req.body);
    if (error) {
        const errMsg = error.details.map((el) => el.message).join(", ");
        return next(new expressErr(400, errMsg));
    }
    next();
};

module.exports.validateReview = (req, res, next) => {
    const { error } = reviewSchema.validate(req.body);
    if (error) {
        const errMsg = error.details.map((el) => el.message).join(", ");
        return next(new expressErr(400, errMsg));
    }
    next();
};

// ─── CSRF PROTECTION ──────────────────────────────────────────────────────────
/**
 * Generates a CSRF token and stores it in the session.
 * Call once per request (idempotent within a session).
 */
module.exports.setCsrfToken = (req, res, next) => {
    if (!req.session.csrfToken) {
        req.session.csrfToken = crypto.randomBytes(32).toString("hex");
    }
    res.locals.csrfToken = req.session.csrfToken;
    next();
};

/**
 * Validates CSRF token on state-changing requests (POST, PUT, DELETE).
 * Reads token from body, query string, or x-csrf-token header.
 */
module.exports.validateCsrf = (req, res, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
        return next();
    }
    const token =
        req.body._csrf ||
        req.query._csrf ||
        req.headers["x-csrf-token"];

    if (!token || token !== req.session.csrfToken) {
        return next(new expressErr(403, "Invalid or missing CSRF token. Please refresh and try again."));
    }
    next();
};

// ─── MIME TYPE VALIDATION ─────────────────────────────────────────────────────
/**
 * Validates uploaded file MIME types after multer has processed them.
 * Works with both single and multiple file uploads.
 */
module.exports.validateImageMime = (req, res, next) => {
    const files = req.files || (req.file ? [req.file] : []);
    for (const file of files) {
        if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
            req.flash("error", `Invalid file type: ${file.originalname}. Only JPG, JPEG, and PNG are allowed.`);
            return res.redirect("back");
        }
    }
    next();
};
