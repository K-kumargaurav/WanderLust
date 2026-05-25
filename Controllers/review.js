const Listing = require("../models/listing");
const Review  = require("../models/review");

/**
 * Creates a new review and attaches it to the given listing.
 *
 * Sets the current user as the review author, pushes the review
 * reference into the listing's reviews array, then saves both documents.
 *
 * @route   POST /listings/:id/reviews
 * @access  Authenticated
 *
 * @param   {import('express').Request}  req
 * @param   {import('express').Response} res
 * @returns {Promise<void>}
 */
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

/**
 * Updates an existing review's rating and comment.
 *
 * @route   PUT /listings/:id/reviews/:reviewId
 * @access  Review author only
 *
 * @param   {import('express').Request}  req
 * @param   {import('express').Response} res
 * @returns {Promise<void>}
 */
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

/**
 * Deletes a review and removes its reference from the parent listing.
 *
 * Uses $pull to atomically remove the review ID from the listing's
 * reviews array, then deletes the review document itself.
 *
 * @route   DELETE /listings/:id/reviews/:reviewId
 * @access  Review author only
 *
 * @param   {import('express').Request}  req
 * @param   {import('express').Response} res
 * @returns {Promise<void>}
 */
module.exports.destroyReview = async (req, res) => {
    const { id, reviewId } = req.params;

    await Listing.findByIdAndUpdate(id, { $pull: { reviews: reviewId } });
    await Review.findByIdAndDelete(reviewId);

    req.flash("success", "Review deleted!");
    res.redirect(`/listings/${id}`);
};
