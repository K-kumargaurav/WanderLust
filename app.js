const express = require("express");
const mongoose = require("mongoose");
const { connectDB } = require("./loaders/db");
const { setupMiddleware } = require("./loaders/middleware");
const { setupRoutes } = require("./loaders/routes");
const config = require("./config");

const app = express();

setupMiddleware(app);
setupRoutes(app);

async function startServer() {
    await connectDB();

    const server = app.listen(config.server.port, () => {
        console.log(`Server running on port ${config.server.port}`);
    });

    function shutdown(signal) {
        console.log(`\n${signal} received — shutting down gracefully...`);
        server.close(() => {
            mongoose.connection.close(false).then(() => {
                console.log("DB connection closed.");
                process.exit(0);
            });
        });
        setTimeout(() => process.exit(1), 10000);
    }

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
}

startServer();

module.exports = app;
