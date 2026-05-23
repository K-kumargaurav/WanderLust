const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync.js");
const { isLoggedIn, isOwner, validateListing, validateCsrf, validateImageMime } = require("../middleware.js");
const listingController = require("../Controllers/listing.js");
const multer = require("multer");
const { storage } = require("../cloudConfig.js");
const upload = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024,
    },
});

router
    .route("/")
    .get(wrapAsync(listingController.index))
    .post(
        isLoggedIn,
        upload.array("listing[images]", 3),
        validateCsrf,
        validateImageMime,
        validateListing,
        wrapAsync(listingController.createListing)
    );

router.get("/new", isLoggedIn, listingController.renderNewForm);

router
    .route("/:id")
    .get(wrapAsync(listingController.showListing))
    .put(
        isLoggedIn,
        isOwner,
        upload.array("listing[images]", 3),
        validateCsrf,
        validateImageMime,
        validateListing,
        wrapAsync(listingController.updateListing)
    )
    .delete(isLoggedIn, isOwner, validateCsrf, wrapAsync(listingController.destroyListing));

router.get("/:id/edit", isLoggedIn, isOwner, wrapAsync(listingController.renderEditForm));

module.exports = router;
