// Load .env before anything else (non-production only)
if (process.env.NODE_ENV !== "production") {
    require("dotenv").config();
}

// ─── Validate required env vars at startup ───────────────────────────────────
const REQUIRED_ENV = ["MONGO_URL", "SECRET", "MAP_TOKEN", "CLOUD_NAME", "CLOUD_API_KEY", "CLOUD_API_SECRET"];
for (const key of REQUIRED_ENV) {
    if (!process.env[key]) {
        console.error(`[startup] Missing required env var: ${key}`);
        process.exit(1);
    }
}

const express      = require("express");
const app          = express();
const mongoose     = require("mongoose");
const path         = require("path");
const methodOverride = require("method-override");
const ejsMate      = require("ejs-mate");
const expressErr   = require("./utils/expressErr.js");
const session      = require("express-session");
const _mongoStore  = require("connect-mongo");
const MongoStore   = _mongoStore.default || _mongoStore;
const flash        = require("connect-flash");
const passport     = require("passport");
const User         = require("./models/user.js");
const compression  = require("compression");
const morgan       = require("morgan");

// ─── Security middleware ─────────────────────────────────────────────────────
const helmet      = require("helmet");
const { setCsrfToken, validateCsrf } = require("./middleware.js");

const listingRouter = require("./route/listing.js");
const reviewRouter  = require("./route/review.js");
const userRouter    = require("./route/user.js");

const dbUrl = process.env.MONGO_URL;

// ─── TRUST PROXY (Render reverse proxy) ──────────────────────────────────────
app.set("trust proxy", 1);

// ─── DB CONNECTION ────────────────────────────────────────────────────────────
main()
    .then(() => console.log("Connected to DB."))
    .catch((err) => {
        console.error("DB connection error:", err);
        process.exit(1);
    });

async function main() {
    await mongoose.connect(dbUrl);
}

// ─── VIEW ENGINE ──────────────────────────────────────────────────────────────
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.engine("ejs", ejsMate);

// ─── COMPRESSION & LOGGING ────────────────────────────────────────────────────
app.use(compression());
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// ─── BODY PARSING ─────────────────────────────────────────────────────────────
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(express.json({ limit: "1mb" }));
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "/public"), {
    maxAge: process.env.NODE_ENV === "production" ? "7d" : 0,
}));

// ─── SECURITY HEADERS ─────────────────────────────────────────────────────────
app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: [
                    "'self'",
                    "https://api.mapbox.com",
                    "https://cdnjs.cloudflare.com",
                    "'unsafe-inline'",
                ],
                workerSrc: ["'self'", "blob:"],
                childSrc: ["blob:"],
                imgSrc: [
                    "'self'",
                    "data:",
                    "blob:",
                    "https://res.cloudinary.com",
                    "https://images.unsplash.com",
                    "https://plus.unsplash.com",
                    "https://api.mapbox.com",
                ],
                connectSrc: [
                    "'self'",
                    "https://api.mapbox.com",
                    "https://events.mapbox.com",
                ],
                styleSrc: [
                    "'self'",
                    "https://api.mapbox.com",
                    "https://cdnjs.cloudflare.com",
                    "https://fonts.googleapis.com",
                    "'unsafe-inline'",
                ],
                fontSrc: [
                    "'self'",
                    "https://fonts.gstatic.com",
                    "https://cdnjs.cloudflare.com",
                ],
            },
        },
    })
);

// ─── SESSION STORE ────────────────────────────────────────────────────────────
const store = MongoStore.create({
    mongoUrl: dbUrl,
    crypto:   { secret: process.env.SECRET },
    touchAfter: 24 * 3600,
});

store.on("error", (err) => {
    console.error("SESSION STORE ERROR:", err);
});

const sessionOptions = {
    store,
    secret:            process.env.SECRET,
    resave:            false,
    saveUninitialized: false,
    cookie: {
        maxAge:   7 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
    },
};

app.use(session(sessionOptions));
app.use(flash());

// ─── PASSPORT ─────────────────────────────────────────────────────────────────
app.use(passport.initialize());
app.use(passport.session());

// passport-local-mongoose v9 returns an async verify function, but
// passport-local expects a callback-based one.  Bridge the two.
const LocalStrategy = require("passport-local");
const asyncVerify   = User.authenticate();          // async (username, password) => { ... }
passport.use(new LocalStrategy(
    (username, password, done) => {
        asyncVerify(username, password)
            .then((result) => {
                if (!result.user) {
                    return done(null, false, result.error);
                }
                done(null, result.user);
            })
            .catch(done);
    }
));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// ─── CSRF TOKEN ───────────────────────────────────────────────────────────────
app.use(setCsrfToken);

// ─── LOCALS ───────────────────────────────────────────────────────────────────
app.use((req, res, next) => {
    res.locals.success  = req.flash("success");
    res.locals.error    = req.flash("error");
    res.locals.mapToken = process.env.MAP_TOKEN;
    res.locals.currUser = req.user;
    next();
});

// ─── HEALTH CHECK (for Render monitoring) ────────────────────────────────────
app.get("/health", (req, res) => res.status(200).json({ status: "ok" }));

// ─── ROUTES ───────────────────────────────────────────────────────────────────
app.get("/", (req, res) => res.redirect("/listings"));

app.get("/privacy", (req, res) => res.render("pages/privacy"));
app.get("/terms", (req, res) => res.render("pages/terms"));

app.use("/listings", listingRouter);
app.use("/listings/:id/reviews", reviewRouter);
app.use("/", userRouter);

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.all(/(.*)/, (req, res, next) => {
    next(new expressErr(404, "Page Not Found!"));
});

// ─── GLOBAL ERROR HANDLER ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
    const { status = 500, message = "Something went wrong." } = err;
    res.status(status).render("error.ejs", { message, status });
});

// ─── SERVER ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 8080;
const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// ─── GRACEFUL SHUTDOWN (Render sends SIGTERM) ────────────────────────────────
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
process.on("SIGINT",  () => shutdown("SIGINT"));
