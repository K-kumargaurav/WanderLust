const express     = require('express');
const router      = express.Router();
const wrapAsync   = require('../utils/wrapAsync.js');
const { isLoggedIn, isOwner, validateListing, validateCsrf, validateImageMime } = require('../middleware.js');
const listingController   = require('../Controllers/listing.js');
const analyticsController = require('../Controllers/analytics.js');
const multer  = require('multer');
const { storage } = require('../cloudConfig.js');

const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

router.get('/',    wrapAsync(listingController.index));
router.get('/new', isLoggedIn, listingController.renderNewForm);
router.post('/', isLoggedIn, upload.array('listing[images]', 3), validateCsrf, validateImageMime, validateListing, wrapAsync(listingController.createListing));

router.get('/:id/analytics', isLoggedIn, wrapAsync(analyticsController.renderAnalytics));
router.get('/:id/edit', isLoggedIn, isOwner, wrapAsync(listingController.renderEditForm));
router.get('/:id', wrapAsync(listingController.showListing));
router.put('/:id', isLoggedIn, isOwner, upload.array('listing[images]', 3), validateCsrf, validateImageMime, validateListing, wrapAsync(listingController.updateListing));
router.delete('/:id', isLoggedIn, isOwner, validateCsrf, wrapAsync(listingController.destroyListing));

module.exports = router;
