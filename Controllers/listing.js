const Listing = require("../models/listing");
const { LISTING_CATEGORIES } = require("../models/listing");
const expressErr = require("../utils/expressErr");
const mbxGeocoding = require("@mapbox/mapbox-sdk/services/geocoding");
const { deleteImage } = require("../cloudConfig");

const mapToken = process.env.MAP_TOKEN;
const geocodingClient = mbxGeocoding({ accessToken: mapToken });

const ITEMS_PER_PAGE = 12;

const FILTERS = [
    { slug: "trending",  label: "Trending",      icon: "fa-fire-flame-curved",  query: {}, sort: { "reviews": -1 } },
    { slug: "rooms",     label: "Rooms",          icon: "fa-bed",                query: { category: "Rooms" } },
    { slug: "cities",    label: "Iconic Cities",  icon: "fa-mountain-city",      query: { category: "Iconic Cities" } },
    { slug: "mountains", label: "Mountains",      icon: "fa-mountain",           query: { category: "Mountains" } },
    { slug: "castles",   label: "Castles",        icon: "fa-fort-awesome",       query: { category: "Castles" } },
    { slug: "pools",     label: "Amazing Pools",  icon: "fa-person-swimming",    query: { category: "Amazing Pools" } },
    { slug: "camping",   label: "Camping",        icon: "fa-campground",         query: { category: "Camping" } },
    { slug: "farms",     label: "Farms",          icon: "fa-cow",                query: { category: "Farms" } },
    { slug: "arctic",    label: "Arctic",         icon: "fa-snowflake",          query: { category: "Arctic" } },
    { slug: "beach",     label: "Beach",          icon: "fa-umbrella-beach",     query: { category: "Beach" } },
];

// ─── INDEX ────────────────────────────────────────────────────────────────────
module.exports.index = async (req, res) => {
    const searchQuery   = (req.query.q      || "").trim();
    const currentFilter = (req.query.filter || "trending").trim();
    const sortBy        = req.query.sort    || "newest";
    const page          = Math.max(1, parseInt(req.query.page) || 1);

    let dbQuery = {};
    let sortOption = {};

    // Search
    if (searchQuery) {
        const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(escaped, "i");
        dbQuery = { $or: [{ title: regex }, { location: regex }, { country: regex }] };
    } else {
        const activeFilter = FILTERS.find((f) => f.slug === currentFilter);
        if (activeFilter) {
            dbQuery = activeFilter.query;
        }
    }

    // Sort
    switch (sortBy) {
        case "price_low":  sortOption = { price: 1 };     break;
        case "price_high": sortOption = { price: -1 };    break;
        case "oldest":     sortOption = { createdAt: 1 };  break;
        case "newest":
        default:           sortOption = { createdAt: -1 }; break;
    }

    const totalListings = await Listing.countDocuments(dbQuery);
    const totalPages    = Math.max(1, Math.ceil(totalListings / ITEMS_PER_PAGE));
    const safePage      = Math.min(page, totalPages);

    const allListings = await Listing.find(dbQuery)
        .sort(sortOption)
        .skip((safePage - 1) * ITEMS_PER_PAGE)
        .limit(ITEMS_PER_PAGE);

    res.render("listings/index.ejs", {
        allListings,
        FILTERS,
        currentFilter,
        searchQuery,
        sortBy,
        currentPage: safePage,
        totalPages,
        totalListings,
    });
};

// ─── NEW FORM ─────────────────────────────────────────────────────────────────
module.exports.renderNewForm = (req, res) => {
    res.render("listings/new", {
        categories: LISTING_CATEGORIES,
    });
};

// ─── SHOW ─────────────────────────────────────────────────────────────────────
module.exports.showListing = async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findById(id)
        .populate({ path: "reviews", populate: "author" })
        .populate("owner");

    if (!listing) {
        req.flash("error", "Listing does not exist!");
        return res.redirect("/listings");
    }

    res.render("listings/show.ejs", { listing });
};

// ─── CREATE ───────────────────────────────────────────────────────────────────
module.exports.createListing = async (req, res, next) => {
    if (!req.files || req.files.length === 0) {
        req.flash("error", "At least one listing photo is required.");
        return res.redirect("/listings/new");
    }

    const geoResponse = await geocodingClient
        .forwardGeocode({ query: req.body.listing.location, limit: 1 })
        .send();

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

// ─── EDIT FORM ────────────────────────────────────────────────────────────────
module.exports.renderEditForm = async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findById(id);

    if (!listing) {
        req.flash("error", "Listing does not exist!");
        return res.redirect("/listings");
    }

    res.render("listings/edit.ejs", { listing, categories: LISTING_CATEGORIES });
};

// ─── UPDATE ───────────────────────────────────────────────────────────────────
module.exports.updateListing = async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findByIdAndUpdate(id, { ...req.body.listing });

    if (!listing) {
        req.flash("error", "Listing does not exist!");
        return res.redirect("/listings");
    }

    // Re-geocode if the location was changed
    if (req.body.listing.location && req.body.listing.location !== listing.location) {
        const geoResponse = await geocodingClient
            .forwardGeocode({ query: req.body.listing.location, limit: 1 })
            .send();
        const features = geoResponse.body.features;
        if (features && features.length > 0) {
            listing.geometry = features[0].geometry;
        }
    }

    // Add new images (up to 3 total)
    if (req.files && req.files.length > 0) {
        const newImages = req.files.map((f) => ({ url: f.path, filename: f.filename }));
        listing.images.push(...newImages);
        // Keep only the last 3
        if (listing.images.length > 3) {
            const removed = listing.images.splice(0, listing.images.length - 3);
            // Clean up removed images from Cloudinary
            for (const img of removed) {
                await deleteImage(img.filename);
            }
        }
    }

    // Handle image deletions from the edit form
    if (req.body.deleteImages && req.body.deleteImages.length > 0) {
        for (const filename of req.body.deleteImages) {
            await deleteImage(filename);
        }
        listing.images = listing.images.filter(
            (img) => !req.body.deleteImages.includes(img.filename)
        );
    }

    await listing.save();

    req.flash("success", "Listing updated!");
    return res.redirect(`/listings/${id}`);
};

// ─── DELETE ───────────────────────────────────────────────────────────────────
module.exports.destroyListing = async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findById(id);

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
