// ─── Pagination ───────────────────────────────────────────────────────────
const ITEMS_PER_PAGE = 12;

// ─── Listing Categories ───────────────────────────────────────────────────
const LISTING_CATEGORIES = [
    "Rooms",
    "Iconic Cities",
    "Mountains",
    "Castles",
    "Amazing Pools",
    "Camping",
    "Farms",
    "Arctic",
    "Domes",
    "Boats",
    "Beach",
];

// ─── Filter Definitions ──────────────────────────────────────────────────
const LISTING_FILTERS = [
    { slug: "trending",  label: "Trending",      icon: "fa-fire-flame-curved",  query: {}, sort: { reviews: -1 } },
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

// ─── Sort Options ─────────────────────────────────────────────────────────
const SORT_OPTIONS = {
    newest:     { createdAt: -1 },
    oldest:     { createdAt: 1 },
    price_low:  { price: 1 },
    price_high: { price: -1 },
};
const DEFAULT_SORT = "newest";

// ─── Image Constraints ────────────────────────────────────────────────────
const MAX_IMAGES_PER_LISTING = 3;
const ALLOWED_IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/jpg"]);

// ─── Booking Status ───────────────────────────────────────────────────────
const BOOKING_STATUS = {
    PENDING:   "pending",
    CONFIRMED: "confirmed",
    CANCELLED: "cancelled",
};

// ─── Rate Limiting ────────────────────────────────────────────────────────
const AUTH_RATE_LIMIT = {
    windowMs: 15 * 60 * 1000,
    max: 10,
};

// ─── Tax ─────────────────────────────────────────────────────────────────
const GST_RATE = 0.18;

module.exports = {
    ITEMS_PER_PAGE,
    LISTING_CATEGORIES,
    LISTING_FILTERS,
    SORT_OPTIONS,
    DEFAULT_SORT,
    MAX_IMAGES_PER_LISTING,
    ALLOWED_IMAGE_MIMES,
    BOOKING_STATUS,
    AUTH_RATE_LIMIT,
    GST_RATE,
};
