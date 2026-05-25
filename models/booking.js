const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const { BOOKING_STATUS } = require("../utils/constants");

const bookingSchema = new Schema({
    listing: {
        type: Schema.Types.ObjectId,
        ref: "Listing",
        required: true,
    },
    guest: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    checkIn: {
        type: Date,
        required: true,
    },
    checkOut: {
        type: Date,
        required: true,
    },
    nights: {
        type: Number,
        required: true,
        min: 1,
    },
    pricePerNight: {
        type: Number,
        required: true,
        min: 0,
    },
    subtotal: {
        type: Number,
        required: true,
        min: 0,
    },
    gstAmount: {
        type: Number,
        required: true,
        min: 0,
    },
    totalPrice: {
        type: Number,
        required: true,
        min: 0,
    },
    status: {
        type: String,
        enum: Object.values(BOOKING_STATUS),
        default: BOOKING_STATUS.PENDING,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

// ─── Indexes ─────────────────────────────────────────────────────────────────
bookingSchema.index({ listing: 1, status: 1 });
bookingSchema.index({ guest: 1, createdAt: -1 });
bookingSchema.index({ listing: 1, checkIn: 1, checkOut: 1 });

// ─── Virtuals ────────────────────────────────────────────────────────────────
bookingSchema.virtual("durationLabel").get(function () {
    return `${this.nights} night${this.nights === 1 ? "" : "s"}`;
});

// ─── Statics ─────────────────────────────────────────────────────────────────
bookingSchema.statics.findOverlapping = function (
    listingId,
    checkIn,
    checkOut,
    excludeBookingId
) {
    const query = {
        listing: listingId,
        status: { $in: [BOOKING_STATUS.PENDING, BOOKING_STATUS.CONFIRMED] },
        checkIn: { $lt: checkOut },
        checkOut: { $gt: checkIn },
    };
    if (excludeBookingId) {
        query._id = { $ne: excludeBookingId };
    }
    return this.find(query);
};

const Booking = mongoose.model("Booking", bookingSchema);

module.exports = Booking;
