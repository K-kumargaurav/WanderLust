if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const REQUIRED_KEYS = [
  "MONGO_URL",
  "SECRET",
  "MAP_TOKEN",
  "CLOUD_NAME",
  "CLOUD_API_KEY",
  "CLOUD_API_SECRET",
];

for (const key of REQUIRED_KEYS) {
  if (!process.env[key]) {
    console.error(`[config] Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const config = Object.freeze({
  server: Object.freeze({
    port: parseInt(process.env.PORT) || 8080,
    nodeEnv: process.env.NODE_ENV || "development",
    isProduction: process.env.NODE_ENV === "production",
  }),

  db: Object.freeze({
    url: process.env.MONGO_URL,
  }),

  session: Object.freeze({
    secret: process.env.SECRET,
    maxAgeDays: 7,
    maxAgeMs: 7 * 24 * 60 * 60 * 1000,
    touchAfterSeconds: 24 * 3600,
  }),

  cloudinary: Object.freeze({
    cloudName: process.env.CLOUD_NAME,
    apiKey: process.env.CLOUD_API_KEY,
    apiSecret: process.env.CLOUD_API_SECRET,
    folder:
      process.env.NODE_ENV === "production"
        ? "WanderLust_PROD"
        : "WanderLust_DEV",
    maxFileSizeBytes: 5 * 1024 * 1024,
  }),

  mapbox: Object.freeze({
    token: process.env.MAP_TOKEN,
  }),

  smtp: Object.freeze({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  }),

  auth: Object.freeze({
    rateLimitWindowMs: 15 * 60 * 1000,
    rateLimitMaxAttempts: 10,
    passwordResetExpiryMs: 3600000,
    minPasswordLength: 8,
  }),
});

module.exports = config;
