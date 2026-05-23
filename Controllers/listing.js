const Listing = require("../models/listing");
const { LISTING_CATEGORIES } = require("../models/listing");
const expressErr = require("../utils/expressErr");
const mbxGeocoding = require("@mapbox/mapbox-sdk/services/geocoding");

const mapToken = process.env.MAP_TOKEN;
const geocodingClient = mbxGeocoding({ accessToken: mapToken });

const FILTERS = [
    { slug: "trending",  label: "Trending",      icon: "fa-fire-flame-curved",  query: {} },
    { slug: "rooms",     label: "Rooms",          icon: "fa-bed",                query: { title: /room/i } },
    { slug: "cities",    label: "Iconic Cities",  icon: "fa-mountain-city",      query: {} },
    { slug: "mountains", label: "Mountains",      icon: "fa-mountain",           query: { description: /mountain/i } },
    { slug: "castles",   label: "Castles",        icon: "fa-fort-awesome",       query: { title: /castle/i } },
    { slug: "pools",     label: "Amazing Pools",  icon: "fa-person-swimming",    query: { description: /pool/i } },
    { slug: "camping",   label: "Camping",        icon: "fa-campground",         query: { description: /camp/i } },
    { slug: "farms",     label: "Farms",          icon: "fa-cow",                query: { description: /farm/i } },
    { slug: "arctic",    label: "Arctic",         icon: "fa-snowflake",          query: { description: /arctic|snow|ice/i } },
    { slug: "beach",     label: "Beach",          icon: "fa-umbrella-beach",     query: { description: /beach|coast/i } },
];

// ─── INDEX ────────────────────────────────────────────────────────────────────
module.exports.index = async (req, res) => {
    const searchQuery   = (req.query.q      || "").trim();
    const currentFilter = (req.query.filter || "trending").trim();

    let dbQuery = {};
    if (searchQuery) {
        const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(escaped, "i");
        dbQuery = { $or: [{ title: regex }, { location: regex }, { country: regex }] };
    } else {
        const activeFilter = FILTERS.find((f) => f.slug === currentFilter);
        if (activeFilter) dbQuery = activeFilter.query;
    }

    const allListings = await Listing.find(dbQuery);
    res.render("listings/index.ejs", { allListings, FILTERS, currentFilter, searchQuery });
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
    if (!req.file) {
        req.flash("error", "A listing photo is required.");
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

    const { path: url, filename } = req.file;

    const newListing = new Listing(req.body.listing);
    newListing.owner    = req.user._id;
    newListing.image    = { url, filename };
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

    // Serve a smaller preview image (250 px wide) in the edit form
    const originalImageUrl = listing.image.url.replace("/upload", "/upload/w_250");
    res.render("listings/edit.ejs", { listing, originalImageUrl });
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

    // Only replace the image when a new file was actually uploaded
    if (req.file) {
        listing.image = { url: req.file.path, filename: req.file.filename };
    }

    await listing.save();

    req.flash("success", "Listing updated!");
    return res.redirect(`/listings/${id}`);
};

// ─── DELETE ───────────────────────────────────────────────────────────────────
module.exports.destroyListing = async (req, res) => {
    const { id } = req.params;
    await Listing.findByIdAndDelete(id);
    req.flash("success", "Listing deleted!");
    res.redirect("/listings");
};