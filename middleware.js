const Listing    = require("./models/listing");
const Review     = require("./models/review");
const expressErr = require("./utils/expressErr.js");
const { listingSchema, reviewSchema } = require("./schema.js");

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