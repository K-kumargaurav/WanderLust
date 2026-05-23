require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const mongoose  = require("mongoose");
const initData  = require("./data.js");
const Listing   = require("../models/listing.js");
const User      = require("../models/user.js");

const MONGO_URL = process.env.MONGO_URL || "mongodb://127.0.0.1:27017/wanderlust";

const SEED_USER = {
    username: "seed_owner",
    email:    "seed@wanderlust.dev",
    password: "Seed@123!",   // change before any real deployment
};

async function main() {
    await mongoose.connect(MONGO_URL);
    console.log("Connected to DB.");

    // Find or create the seed user so we have a valid ObjectId
    let owner = await User.findOne({ username: SEED_USER.username });
    if (!owner) {
        owner = new User({ email: SEED_USER.email, username: SEED_USER.username });
        await User.register(owner, SEED_USER.password);
        console.log(`Seed user created: ${SEED_USER.username}`);
    } else {
        console.log(`Seed user found: ${SEED_USER.username} (${owner._id})`);
    }

    await Listing.deleteMany({});

    const seedListings = initData.data.map((obj) => ({
        ...obj,
        owner:    owner._id,
        geometry: {
            type:        "Point",
            coordinates: [77.209, 28.6139], // New Delhi fallback; real geocoding on create
        },
    }));

    await Listing.insertMany(seedListings);
    console.log(`Inserted ${seedListings.length} listings.`);

    await mongoose.disconnect();
    console.log("Done.");
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});