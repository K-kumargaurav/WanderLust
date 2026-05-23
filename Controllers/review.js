const Listing = require("../models/listing");
const Review  = require("../models/review");

// ─── CREATE REVIEW ────────────────────────────────────────────────────────────
module.exports.createReview = async (req, res) => {
    const listing = await Listing.findById(req.params.id);
    if (!listing) {
        req.flash("error", "Listing does not exist!");
        return res.redirect("/listings");
    }

    const newReview    = new Review(req.body.review);
    newReview.author   = req.user._id;

    listing.reviews.push(newReview);
    await newReview.save();
    await listing.save();

    req.flash("success", "Review posted!");
    res.redirect(`/listings/${listing.id}`);
};

// ─── UPDATE REVIEW ────────────────────────────────────────────────────────────
module.exports.updateReview = async (req, res) => {
    const { id, reviewId } = req.params;
    const { rating, comment } = req.body.review;

    const review = await Review.findByIdAndUpdate(reviewId, { rating, comment });
    if (!review) {
        req.flash("error", "Review does not exist!");
        return res.redirect(`/listings/${id}`);
    }

    req.flash("success", "Review updated!");
    res.redirect(`/listings/${id}`);
};

// ─── DELETE REVIEW ────────────────────────────────────────────────────────────
module.exports.destroyReview = async (req, res) => {
    const { id, reviewId } = req.params;

    await Listing.findByIdAndUpdate(id, { $pull: { reviews: reviewId } });
    await Review.findByIdAndDelete(reviewId);

    req.flash("success", "Review deleted!");
    res.redirect(`/listings/${id}`);
};
