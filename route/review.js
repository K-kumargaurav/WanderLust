const express = require("express");
const router = express.Router({ mergeParams: true });
const wrapAsync = require("../utils/wrapAsync.js");
const { validateReview, validateCsrf, isLoggedIn, isReviewAuthor } = require("../middleware.js");
const reviewController = require("../Controllers/review.js");

router.post("/", isLoggedIn, validateCsrf, validateReview, wrapAsync(reviewController.createReview));

router
    .route("/:reviewId")
    .put(isLoggedIn, isReviewAuthor, validateCsrf, validateReview, wrapAsync(reviewController.updateReview))
    .delete(isLoggedIn, isReviewAuthor, validateCsrf, wrapAsync(reviewController.destroyReview));

module.exports = router;
