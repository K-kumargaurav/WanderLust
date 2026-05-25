const crypto      = require("crypto");
const Listing     = require("./models/listing");
const Review      = require("./models/review");
const expressErr  = require("./utils/expressErr.js");
const { listingSchema, reviewSchema } = require("./schema.js");
const { ALLOWED_IMAGE_MIMES } = require("./utils/constants");

/**
 * Ensures the user is authenticated before proceeding.
 *
 * Saves the original URL in the session so the user can be redirected
 * back after login. Flashes an error and redirects to /login if not
 * authenticated.
 *
 * @param   {import('express').Request}  req
 * @param   {import('express').Response} res
 * @param   {import('express').NextFunction} next
 * @returns {void}
 */
module.exports.isLoggedIn = (req, res, next) => {
    if (!req.isAuthenticated()) {
        req.session.redirectUrl = req.originalUrl;
        req.flash("error", "You must be logged in to do that.");
        return res.redirect("/login");
    }
    next();
};

/**
 * Copies the session redirect URL into res.locals before Passport clears it.
 *
 * Passport resets the session on login, so this middleware preserves
 * the intended redirect destination for the post-login handler.
 *
 * @param   {import('express').Request}  req
 * @param   {import('express').Response} res
 * @param   {import('express').NextFunction} next
 * @returns {void}
 */
module.exports.saveRedirectUrl = (req, res, next) => {
    if (req.session.redirectUrl) {
        res.locals.redirectUrl = req.session.redirectUrl;
    }
    next();
};

/**
 * Verifies that the current user owns the listing identified by :id.
 *
 * Flashes an error and redirects if the listing doesn't exist or
 * the user is not the owner.
 *
 * @param   {import('express').Request}  req
 * @param   {import('express').Response} res
 * @param   {import('express').NextFunction} next
 * @returns {Promise<void>}
 */
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

/**
 * Verifies that the current user is the author of the review identified by :reviewId.
 *
 * Flashes an error and redirects to the listing page if the review
 * doesn't exist or the user is not the author.
 *
 * @param   {import('express').Request}  req
 * @param   {import('express').Response} res
 * @param   {import('express').NextFunction} next
 * @returns {Promise<void>}
 */
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

/**
 * Validates the request body against the Joi listing schema.
 *
 * Passes a 400 AppError to next() if validation fails, with all
 * error details joined into a single message string.
 *
 * @param   {import('express').Request}  req
 * @param   {import('express').Response} res
 * @param   {import('express').NextFunction} next
 * @returns {void}
 */
module.exports.validateListing = (req, res, next) => {
    const { error } = listingSchema.validate(req.body);
    if (error) {
        const errMsg = error.details.map((el) => el.message).join(", ");
        return next(new expressErr(400, errMsg));
    }
    next();
};

/**
 * Validates the request body against the Joi review schema.
 *
 * Passes a 400 AppError to next() if validation fails, with all
 * error details joined into a single message string.
 *
 * @param   {import('express').Request}  req
 * @param   {import('express').Response} res
 * @param   {import('express').NextFunction} next
 * @returns {void}
 */
module.exports.validateReview = (req, res, next) => {
    const { error } = reviewSchema.validate(req.body);
    if (error) {
        const errMsg = error.details.map((el) => el.message).join(", ");
        return next(new expressErr(400, errMsg));
    }
    next();
};

/**
 * Generates a CSRF token and stores it in the session.
 *
 * Idempotent within a session — only creates a new token if one
 * doesn't already exist. Exposes the token via res.locals.csrfToken
 * for use in templates.
 *
 * @param   {import('express').Request}  req
 * @param   {import('express').Response} res
 * @param   {import('express').NextFunction} next
 * @returns {void}
 */
module.exports.setCsrfToken = (req, res, next) => {
    if (!req.session.csrfToken) {
        req.session.csrfToken = crypto.randomBytes(32).toString("hex");
    }
    res.locals.csrfToken = req.session.csrfToken;
    next();
};

/**
 * Validates the CSRF token on state-changing requests (POST, PUT, DELETE).
 *
 * Skips validation for safe HTTP methods (GET, HEAD, OPTIONS). Reads
 * the token from the request body, query string, or x-csrf-token header.
 * Passes a 403 AppError to next() if the token is missing or doesn't match.
 *
 * @param   {import('express').Request}  req
 * @param   {import('express').Response} res
 * @param   {import('express').NextFunction} next
 * @returns {void}
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

/**
 * Validates uploaded file MIME types against ALLOWED_IMAGE_MIMES.
 *
 * Runs after multer has processed the upload. Works with both
 * single (req.file) and multiple (req.files) file uploads.
 * Flashes an error and redirects back if any file has a disallowed type.
 *
 * @param   {import('express').Request}  req
 * @param   {import('express').Response} res
 * @param   {import('express').NextFunction} next
 * @returns {void}
 */
module.exports.validateImageMime = (req, res, next) => {
    const files = req.files || (req.file ? [req.file] : []);
    for (const file of files) {
        if (!ALLOWED_IMAGE_MIMES.has(file.mimetype)) {
            req.flash("error", `Invalid file type: ${file.originalname}. Only JPG, JPEG, and PNG are allowed.`);
            return res.redirect("back");
        }
    }
    next();
};
