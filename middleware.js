const Listing = require("./models/listing");
const Review = require("./models/review");
const expressErr = require("./utils/expressErr.js");
const {listingSchema, reviewSchema} = require("./schema.js");

module.exports.isLoggedIn = (req, res, next) => {
  if (!req.isAuthenticated()) {
    if (req.originalUrl !== "/login" && req.originalUrl !== "/signup") {
      req.session.redirectUrl = req.originalUrl;
    }
    req.flash("error", "Please login first!");
    return res.redirect("/login");
  }
  next();
};

module.exports.saveRedirectUrl = (req, res, next) => {
    if(req.session.redirectUrl) {
        return res.Locals.redirectUrl = req.session.redirectUrl;
    }
    next();
};

module.exports.isOwner = async (req, res, next) => {
    let { id } = req.params;
    let listing = await Listing.findById(id);
    if(!listing.owner.equals(res.Locals.currUser._id)) {
        req.flash("error", "You are not the Owner :)");
        return res.redirect(`/listings/${id}`);
    }
    next();
};

module.exports.isReviewAuthor = async (req, res, next) => {
    let { id, reviewId } = req.params;
    let review = await Review.findById(reviewId);
    if(!review.author.equals(res.Locals.currUser._id)) {
        req.flash("error", "You are not the Author :)");
        return res.redirect(`/listings/${id}`);
    }
    next();
};

module.exports.validateListing = (req, res, next) => {
    let {error} = listingSchema.validate(req.body);
    if(error) {
        let errMsg = error.details.map((el) => el.message).join(",");
        throw new expressErr(404, errMsg)
    }else {
        next();
    }
};

module.exports.validateReview = (req, res, next) => {
    let {error} = reviewSchema.validate(req.body);
    if(error) {
        let errMsg = error.details.map((el) => el.message).join(",");
        throw new expressErr(404, errMsg)
    }else {
        next();
    }
};