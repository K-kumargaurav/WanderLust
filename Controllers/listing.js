const mongoose = require("mongoose");
const Listing = require("../models/listing");
const expressErr = require("../utils/expressErr");
const mbxGeocoding = require("@mapbox/mapbox-sdk/services/geocoding");
const { deleteImage } = require("../cloudConfig");
const { LISTING_CATEGORIES, LISTING_FILTERS, ITEMS_PER_PAGE, SORT_OPTIONS, DEFAULT_SORT, MAX_IMAGES_PER_LISTING } = require("../utils/constants");

const mapToken = process.env.MAP_TOKEN;
const geocodingClient = mbxGeocoding({ accessToken: mapToken });

/**
 * Lists all listings with search, filter, sort, and pagination.
 *
 * Supports text search via `q`, category filtering via `filter`,
 * sort order via `sort`, and page-based pagination. Falls back to
 * the "trending" filter and "newest" sort when no params are given.
 *
 * @route   GET /listings
 * @access  Public
 *
 * @param   {import('express').Request}  req
 * @param   {import('express').Response} res
 * @returns {Promise<void>}
 */
module.exports.index = async (req, res) => {
    const searchQuery   = (req.query.q      || "").trim();
    const currentFilter = (req.query.filter || "trending").trim();
    const sortBy        = req.query.sort    || DEFAULT_SORT;
    const page          = Math.max(1, parseInt(req.query.page) || 1);

    let dbQuery = {};
    let sortOption = {};

    // Search
    if (searchQuery) {
        const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(escaped, "i");
        dbQuery = { $or: [{ title: regex }, { location: regex }, { country: regex }] };
    } else {
        const activeFilter = LISTING_FILTERS.find((f) => f.slug === currentFilter);
        if (activeFilter) {
            dbQuery = { ...activeFilter.query };
        }
    }

    // Exclude soft-deleted listings
    dbQuery.deleted = { $ne: true };

    // Sort
    sortOption = SORT_OPTIONS[sortBy] || SORT_OPTIONS[DEFAULT_SORT];

    const totalListings = await Listing.countDocuments(dbQuery);
    const totalPages    = Math.max(1, Math.ceil(totalListings / ITEMS_PER_PAGE));
    const safePage      = Math.min(page, totalPages);

    const allListings = await Listing.find(dbQuery)
        .sort(sortOption)
        .skip((safePage - 1) * ITEMS_PER_PAGE)
        .limit(ITEMS_PER_PAGE);

    const seo = {
        title:       searchQuery
                       ? `Search: ${searchQuery}`
                       : 'Explore Stays',
        description: 'Browse hundreds of unique listings across India and the world.',
        canonical:   `${req.protocol}://${req.get('host')}/listings`,
    };

    res.render("listings/index.ejs", {
        allListings,
        FILTERS: LISTING_FILTERS,
        currentFilter,
        searchQuery,
        sortBy,
        currentPage: safePage,
        totalPages,
        totalListings,
        seo,
    });
};

/**
 * Renders the "create new listing" form.
 *
 * @route   GET /listings/new
 * @access  Authenticated
 *
 * @param   {import('express').Request}  req
 * @param   {import('express').Response} res
 * @returns {void}
 */
module.exports.renderNewForm = (req, res) => {
    res.render("listings/new", {
        categories: LISTING_CATEGORIES,
    });
};

/**
 * Displays a single listing with its reviews and owner info.
 *
 * Validates the ObjectId format before querying. Populates nested
 * review authors and the listing owner for the detail view.
 *
 * @route   GET /listings/:id
 * @access  Public
 *
 * @param   {import('express').Request}  req
 * @param   {import('express').Response} res
 * @returns {Promise<void>}
 */
module.exports.showListing = async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        req.flash("error", "Invalid listing ID.");
        return res.redirect("/listings");
    }
    const listing = await Listing.findOne({ _id: id, deleted: { $ne: true } })
        .populate({
            path: "reviews",
            match: { deleted: { $ne: true } },
            populate: "author",
        })
        .populate("owner");

    if (!listing) {
        req.flash("error", "Listing does not exist!");
        return res.redirect("/listings");
    }

    // Track view — deduplicate per session, skip if viewer is the owner
    const sessionKey = "viewed_" + id;
    if (!req.session[sessionKey]) {
        const viewerId = req.user?._id;
        if (!viewerId || !listing.owner._id.equals(viewerId)) {
            await Listing.findByIdAndUpdate(id, { $inc: { viewCount: 1 } });
            req.session[sessionKey] = true;
        }
    }

    const canonical = `${req.protocol}://${req.get('host')}/listings/${listing._id}`;
    const seo = {
        title:       listing.title,
        description: listing.description.substring(0, 160).trim(),
        image:       listing.images?.[0]?.url || '',
        canonical,
    };

    res.render("listings/show.ejs", { listing, seo });
};

/**
 * Creates a new listing with geocoded coordinates and uploaded images.
 *
 * Requires at least one image upload. Geocodes the location via Mapbox
 * and stores the resulting GeoJSON point on the listing document.
 *
 * @route   POST /listings
 * @access  Authenticated
 *
 * @param   {import('express').Request}  req
 * @param   {import('express').Response} res
 * @param   {import('express').NextFunction} next
 * @returns {Promise<void>}
 */
module.exports.createListing = async (req, res, next) => {
    if (!req.files || req.files.length === 0) {
        req.flash("error", "At least one listing photo is required.");
        return res.redirect("/listings/new");
    }

    let geoResponse;
    try {
        geoResponse = await geocodingClient
            .forwardGeocode({ query: req.body.listing.location, limit: 1 })
            .send();
    } catch (err) {
        req.flash("error", "Could not geocode that location. Please try again.");
        return res.redirect("/listings/new");
    }

    const features = geoResponse.body.features;
    if (!features || features.length === 0) {
        req.flash("error", "Could not find coordinates for that location. Please be more specific.");
        return res.redirect("/listings/new");
    }

    const newListing = new Listing(req.body.listing);
    newListing.owner    = req.user._id;
    newListing.images   = req.files.map((f) => ({ url: f.path, filename: f.filename }));
    newListing.geometry = features[0].geometry;

    await newListing.save();
    req.flash("success", "New listing created!");
    res.redirect("/listings");
};

/**
 * Renders the edit form for an existing listing.
 *
 * @route   GET /listings/:id/edit
 * @access  Owner only
 *
 * @param   {import('express').Request}  req
 * @param   {import('express').Response} res
 * @returns {Promise<void>}
 */
module.exports.renderEditForm = async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        req.flash("error", "Invalid listing ID.");
        return res.redirect("/listings");
    }
    const listing = await Listing.findOne({ _id: id, deleted: { $ne: true } });

    if (!listing) {
        req.flash("error", "Listing does not exist!");
        return res.redirect("/listings");
    }

    res.render("listings/edit.ejs", { listing, categories: LISTING_CATEGORIES });
};

/**
 * Updates an existing listing using a single findById + mutate + save pattern.
 *
 * All changes (fields, geocoding, images) are applied in memory before a
 * single listing.save() call. Re-geocodes only when the location actually
 * changed, and trims images to MAX_IMAGES_PER_LISTING (oldest removed first).
 *
 * @route   PUT /listings/:id
 * @access  Owner only
 *
 * @param   {import('express').Request}  req
 * @param   {import('express').Response} res
 * @returns {Promise<void>}
 */
module.exports.updateListing = async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        req.flash("error", "Invalid listing ID.");
        return res.redirect("/listings");
    }

    const listing = await Listing.findOne({ _id: id, deleted: { $ne: true } });
    if (!listing) {
        req.flash("error", "Listing does not exist!");
        return res.redirect("/listings");
    }

    if (!listing.owner.equals(req.user._id)) {
        req.flash("error", "You do not have permission to do that.");
        return res.redirect(`/listings/${id}`);
    }

    const { title, description, location, country, price, category } = req.body.listing;

    // Detect location change BEFORE overwriting the field
    const locationChanged = location && location !== listing.location;

    // Apply scalar field updates
    listing.title       = title;
    listing.description = description;
    listing.location    = location;
    listing.country     = country;
    listing.price       = price;
    listing.category    = category;

    // Re-geocode only if the location actually changed
    if (locationChanged) {
        try {
            const geoResponse = await geocodingClient
                .forwardGeocode({ query: location, limit: 1 })
                .send();
            const features = geoResponse.body.features;
            if (features && features.length > 0) {
                listing.geometry = features[0].geometry;
            }
        } catch (err) {
            console.warn(`[updateListing] Geocoding failed for "${location}":`, err.message);
        }
    }

    // Add new image uploads
    if (req.files && req.files.length > 0) {
        const newImages = req.files.map((f) => ({ url: f.path, filename: f.filename }));
        listing.images.push(...newImages);

        // Trim overflow (oldest first) to respect the per-listing limit
        if (listing.images.length > MAX_IMAGES_PER_LISTING) {
            const removed = listing.images.splice(0, listing.images.length - MAX_IMAGES_PER_LISTING);
            for (const img of removed) {
                await deleteImage(img.filename);
            }
        }
    }

    // Handle explicit image deletions from the edit form
    if (req.body.deleteImages && req.body.deleteImages.length > 0) {
        for (const filename of req.body.deleteImages) {
            await deleteImage(filename);
        }
        listing.images = listing.images.filter(
            (img) => !req.body.deleteImages.includes(img.filename)
        );
    }

    // Single DB write
    await listing.save();

    req.flash("success", "Listing updated!");
    return res.redirect(`/listings/${id}`);
};

/**
 * Deletes a listing and its associated Cloudinary images.
 *
 * Cleans up all uploaded images from Cloudinary before removing the
 * document. The post-delete hook on the schema cascade-deletes reviews.
 *
 * @route   DELETE /listings/:id
 * @access  Owner only
 *
 * @param   {import('express').Request}  req
 * @param   {import('express').Response} res
 * @returns {Promise<void>}
 */
module.exports.destroyListing = async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        req.flash("error", "Invalid listing ID.");
        return res.redirect("/listings");
    }
    const listing = await Listing.findOne({ _id: id, deleted: { $ne: true } });

    if (listing) {
        // Clean up all images from Cloudinary
        for (const img of listing.images) {
            await deleteImage(img.filename);
        }
        await Listing.findByIdAndDelete(id);
    }

    req.flash("success", "Listing deleted!");
    res.redirect("/listings");
};
