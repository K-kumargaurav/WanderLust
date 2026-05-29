const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const Review = require("./review");
const { LISTING_CATEGORIES } = require("../utils/constants");

const listingSchema = new Schema({
    title: {
        type: String,
        required: true,
        trim: true,
    },
    description: {
        type: String,
        required: true,
        trim: true,
    },
    images: [
        {
            url: String,
            filename: String,
        },
    ],
    price: {
        type: Number,
        min: 0,
    },
    location: {
        type: String,
        required: true,
        trim: true,
    },
    country: {
        type: String,
        required: true,
        trim: true,
    },
    category: {
        type: String,
        enum: [...LISTING_CATEGORIES, null],
        default: null,
    },
    reviews: [
        {
            type: Schema.Types.ObjectId,
            ref: "Review",
        },
    ],
    owner: {
        type: Schema.Types.ObjectId,
        ref: "User",
    },
    geometry: {
        type: {
            type: String,
            enum: ["Point"],
            required: true,
        },
        coordinates: {
            type: [Number],
            required: true,
        },
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },

    // ─── Analytics Fields ──────────────────────────────────────────
    viewCount: {
        type: Number,
        default: 0,
        min: 0,
    },

    wishlistCount: {
        type: Number,
        default: 0,
        min: 0,
    },

    // ─── Soft Delete Fields ────────────────────────────────────────
    deleted: {
        type: Boolean,
        default: false,
    },
    deletedAt: {
        type: Date,
        default: null,
    },
    deletedBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        default: null,
    },
});

// ─── Indexes ─────────────────────────────────────────────────────────────────
listingSchema.index({ title: "text", location: "text", country: "text" });
listingSchema.index({ owner: 1 });
listingSchema.index({ createdAt: -1 });
listingSchema.index({ category: 1 });
listingSchema.index({ price: 1 });
listingSchema.index({ viewCount: -1 });
listingSchema.index({ deleted: 1 });

// Virtual: backward-compat getter for single image access
listingSchema.virtual("image").get(function () {
    return this.images && this.images.length > 0 ? this.images[0] : null;
});

// Cascade-delete reviews when a listing is removed.
listingSchema.post("findOneAndDelete", async (listing) => {
    if (listing) {
        await Review.deleteMany({ _id: { $in: listing.reviews } });
    }
});

const Listing = mongoose.model("Listing", listingSchema);

module.exports = Listing;
module.exports.LISTING_CATEGORIES = LISTING_CATEGORIES;
