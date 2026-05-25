const mongoose = require("mongoose");
const config = require("../config");

/**
 * Connects to MongoDB and returns the mongoose connection.
 * Logs success or exits with code 1 on failure.
 *
 * @returns {Promise<import('mongoose').Connection>}
 */
async function connectDB() {
    try {
        await mongoose.connect(config.db.url);
        console.log("Connected to DB.");
        return mongoose.connection;
    } catch (err) {
        console.error("DB connection error:", err.message);
        process.exit(1);
    }
}

module.exports = { connectDB };
