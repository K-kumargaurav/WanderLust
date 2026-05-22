if (process.env.NODE_ENV != "production") {
    require("dotenv").config();
}

const express = require("express");
const app = express();
const mongoose = require("mongoose");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const expressErr = require("./utils/expressErr.js");
const session = require("express-session");
const _mongoStore = require("connect-mongo");
const MongoStore = _mongoStore.default || _mongoStore;
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./models/user.js");

const listingRouter = require("./route/listing.js");
const reviewRouter = require("./route/review.js");
const userRouter = require("./route/user.js");

// FIX: use env variable so deployment works (Atlas, Railway, Render, etc.)
const dbUrl = process.env.MONGO_URL || "mongodb://127.0.0.1:27017/wanderlust";

// DB CONNECTION
main()
    .then(() => {
        console.log("Connected to DB.");
    })
    .catch((err) => {
        console.log(err);
    });

async function main() {
    await mongoose.connect(dbUrl);
}

// APP CONFIG
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.engine("ejs", ejsMate);
app.use(express.static(path.join(__dirname, "/public")));

// FIX: MongoStore now properly imported and dbUrl defined
const store = MongoStore.create({
    mongoUrl: dbUrl,
    crypto: {
        secret: process.env.SECRET,
    },
    touchAfter: 24 * 3600,
});

store.on("error", (err) => {
    console.error("SESSION STORE ERROR:", err);
});

// SESSION
// FIX: "coookie" typo fixed to "cookie", store passed in, secure flag for production
const sessionOptions = {
    store,
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
    },
};

app.use(session(sessionOptions));
app.use(flash());

// PASSPORT
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// locals for every view (flash + current user)
app.use((req, res, next) => {
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");
    res.locals.currUser = req.user;
    next();
});

// ROUTES
app.use("/listings", listingRouter);
app.use("/listings/:id/reviews", reviewRouter);
app.use("/", userRouter);

// 404 HANDLER
app.all(/(.*)/, (req, res, next) => {
    next(new expressErr(404, "Page Not Found!"));
});

// ERROR HANDLER
app.use((err, req, res, next) => {
    let { status = 500, message = "---ERROR---" } = err;
    res.status(status).render("error.ejs", { message });
});

// SERVER
app.listen(8080, () => {
    console.log("Port 8080");
});