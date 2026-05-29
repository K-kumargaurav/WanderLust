const express        = require("express");
const path           = require("path");
const session        = require("express-session");
const _mongoStore    = require("connect-mongo");
const MongoStore     = _mongoStore.default || _mongoStore;
const flash          = require("connect-flash");
const passport       = require("passport");
const LocalStrategy  = require("passport-local");
const helmet         = require("helmet");
const compression    = require("compression");
const morgan         = require("morgan");
const methodOverride = require("method-override");
const ejsMate        = require("ejs-mate");

const config             = require("../config");
const User               = require("../models/user");
const { setCsrfToken }   = require("../middleware");
const webhookController  = require("../Controllers/webhook");
const wrapAsync          = require("../utils/wrapAsync");

/**
 * Applies all Express middleware to the app instance.
 *
 * @param {import('express').Express} app
 */
function setupMiddleware(app) {
    // ─── Trust proxy (Render reverse proxy) ──────────────────────────────
    app.set("trust proxy", 1);

    // ─── View engine ─────────────────────────────────────────────────────
    app.set("view engine", "ejs");
    app.set("views", path.join(__dirname, "..", "views"));
    app.engine("ejs", ejsMate);

    // ─── Compression & logging ───────────────────────────────────────────
    app.use(compression());
    app.use(morgan(config.server.isProduction ? "combined" : "dev"));

    // ─── Stripe Webhook (must be BEFORE body parsers) ──────────────────────
    // Stripe requires the raw Buffer body for signature verification.
    // Registering here ensures express.json() never touches this route.
    app.post(
        "/webhook/stripe",
        express.raw({ type: "application/json" }),
        wrapAsync(webhookController.handleStripeWebhook)
    );

    // ─── Body parsing ────────────────────────────────────────────────────
    app.use(express.urlencoded({ extended: true, limit: "1mb" }));
    app.use(express.json({ limit: "1mb" }));
    app.use(methodOverride("_method"));
    app.use(express.static(path.join(__dirname, "..", "public"), {
        maxAge: config.server.isProduction ? "7d" : 0,
    }));

    // ─── Security headers ────────────────────────────────────────────────
    app.use(
        helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: [
                        "'self'",
                        "https://api.mapbox.com",
                        "https://cdnjs.cloudflare.com",
                        "https://js.stripe.com",
                        "'unsafe-inline'",
                    ],
                    workerSrc: ["'self'", "blob:"],
                    frameSrc: [
                        "'self'",
                        "https://js.stripe.com",
                        "https://hooks.stripe.com",
                    ],
                    childSrc: ["blob:"],
                    imgSrc: [
                        "'self'",
                        "data:",
                        "blob:",
                        "https://res.cloudinary.com",
                        "https://images.unsplash.com",
                        "https://plus.unsplash.com",
                        "https://api.mapbox.com",
                        "https://*.stripe.com",
                    ],
                    connectSrc: [
                        "'self'",
                        "https://api.mapbox.com",
                        "https://events.mapbox.com",
                        "https://api.stripe.com",
                        "https://checkout.stripe.com",
                        "https://m.stripe.com",
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
                    formAction: [
                        "'self'",
                        "http://localhost:8080",
                        "http://localhost:3000",
                        "https://checkout.stripe.com",
                    ],
                },
            },
        })
    );

    // ─── Session store ───────────────────────────────────────────────────
    const store = MongoStore.create({
        mongoUrl: config.db.url,
        crypto:   { secret: config.session.secret },
        touchAfter: config.session.touchAfterSeconds,
    });

    store.on("error", (err) => {
        console.error("SESSION STORE ERROR:", err);
    });

    app.use(session({
        store,
        secret:            config.session.secret,
        resave:            false,
        saveUninitialized: false,
        cookie: {
            maxAge:   config.session.maxAgeMs,
            httpOnly: true,
            secure:   config.server.isProduction,
            sameSite: "lax",
        },
    }));

    app.use(flash());

    // ─── Passport ────────────────────────────────────────────────────────
    app.use(passport.initialize());
    app.use(passport.session());

    // passport-local-mongoose v9 returns an async verify function, but
    // passport-local expects a callback-based one.  Bridge the two.
    const asyncVerify = User.authenticate();
    passport.use(new LocalStrategy(
        (username, password, done) => {
            asyncVerify(username, password)
                .then((result) => {
                    if (!result.user) {
                        return done(null, false, result.error);
                    }
                    // Check if user is banned
                    if (result.user.banned) {
                        return done(null, false, {
                            message: 'Your account has been suspended. ' +
                                     'Contact support for assistance.'
                        });
                    }
                    done(null, result.user);
                })
                .catch(done);
        }
    ));

    passport.serializeUser(User.serializeUser());
    passport.deserializeUser(User.deserializeUser());

    // ─── CSRF token ──────────────────────────────────────────────────────
    app.use(setCsrfToken);

    // ─── Locals ──────────────────────────────────────────────────────────
    app.use((req, res, next) => {
        res.locals.success  = req.flash("success");
        res.locals.error    = req.flash("error");
        res.locals.mapToken = config.mapbox.token;
        res.locals.currUser = req.user;
        res.locals.isAdmin = req.user?.role === 'admin';
        res.locals.stripePublishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
        res.locals.unreadMessages = 0;

        if (req.user) {
            const Conversation = require("../models/conversation.js");
            Conversation.find({ participants: req.user._id })
                .then((convs) => {
                    res.locals.unreadMessages = convs.reduce((sum, conv) => {
                        return sum +
                            (conv.unreadCount.get(req.user._id.toString()) || 0);
                    }, 0);
                    next();
                })
                .catch(() => next());
        } else {
            next();
        }
    });
}

module.exports = { setupMiddleware };
