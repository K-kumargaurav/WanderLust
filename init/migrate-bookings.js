require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const mongoose = require("mongoose");
const Booking = require("../models/booking");
const { GST_RATE } = require("../utils/constants");

const MONGO_URL = process.env.MONGO_URL;

async function migrate() {
    await mongoose.connect(MONGO_URL);
    console.log("Connected. Running booking migration...");

    const bookings = await Booking.find({ subtotal: { $exists: false } });
    console.log(`Found ${bookings.length} bookings to migrate.`);

    let updated = 0;
    for (const booking of bookings) {
        const nights = booking.nights ?? 1;
        const pricePerNight = booking.pricePerNight ?? (booking.totalPrice ?? 0);
        const subtotal = pricePerNight * nights;
        const gstAmount = Math.round(subtotal * GST_RATE);
        const totalPrice = subtotal + gstAmount;

        booking.pricePerNight = pricePerNight;
        booking.nights = nights;
        booking.subtotal = subtotal;
        booking.gstAmount = gstAmount;
        booking.totalPrice = totalPrice;

        await booking.save();
        updated++;
        console.log(`  Updated booking ${booking._id}`);
    }

    console.log(`Migration complete. ${updated} bookings updated.`);
    await mongoose.disconnect();
}

migrate().catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
});
