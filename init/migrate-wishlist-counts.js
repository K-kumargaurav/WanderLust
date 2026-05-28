require("dotenv").config({
    path: require("path").join(__dirname, "../.env"),
});

const mongoose = require("mongoose");
const User = require("../models/user");
const Listing = require("../models/listing");

async function migrate() {
    await mongoose.connect(process.env.MONGO_URL);
    console.log("Connected. Running wishlist count migration...");

    // Get all users with wishlists
    const users = await User.find({
        wishlist: { $exists: true, $ne: [] },
    });

    // Count how many users have each listing in their wishlist
    const counts = {};
    for (const user of users) {
        for (const listingId of user.wishlist) {
            const key = listingId.toString();
            counts[key] = (counts[key] || 0) + 1;
        }
    }

    // Update each listing's wishlistCount
    let updated = 0;
    for (const [listingId, count] of Object.entries(counts)) {
        await Listing.findByIdAndUpdate(listingId, {
            wishlistCount: count,
        });
        updated++;
    }

    console.log(`Updated ${updated} listings with wishlist counts.`);
    await mongoose.disconnect();
    console.log("Done.");
}

migrate().catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
});
