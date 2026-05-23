const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const Review = require("./review");

/**
 * Valid category slugs — kept in sync with the filter bar in index.ejs
 * and the category select in new/edit forms.
 */
const LISTING_CATEGORIES = [
    "rooms",
    "cities",
    "mountains",
    "castles",
    "pools",
    "camping",
    "farms",
    "arctic",
    "beach",
];

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
    image: {
        url: String,
        filename: String,
    },
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
