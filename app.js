if(process.env.NODE_ENV != "production") {
    require('dotenv').config();
}

const express = require("express");
const app = express();
const mongoose = require("mongoose");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const expressErr = require("./utils/expressErr.js");
const session = require("express-session");
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./models/user.js");
const multer = require("multer");

const listingRouter = require("./route/listing.js");
const reviewRouter = require("./route/review.js");
const userRouter = require("./route/user.js");

const MONGO_URL = "mongodb://127.0.0.1:27017/wanderlust";

// DB CONNECTION
main()
    .then(() => {
        console.log("Connected to DB.")
    }).catch((err) => {
        console.log(err);
    });

async function main() {
  await mongoose.connect(MONGO_URL);
};

// APP CONFIG
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({extended: true}));
app.use(methodOverride("_method"));
app.engine("ejs", ejsMate);
app.use(express.static(path.join(__dirname, "/public")));

// SESSION
const sessionOptions = {
    secret : "mysupersecretcode",
    resave : false,
    saveUninitialized : true,
    coookie : {
        expires : Date.now() + 7 * 24 * 60 * 60 * 1000,
        maxAge : 7 * 24 * 60 * 60 * 1000,
        httpOnly : true,
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
    res.locals.currUser = req.user; // logged in user (if any)
    next();
});

// ROUTES
// app.get("/", (req, res) => {
//     res.redirect("/listings");
// });

app.use("/listings", listingRouter);
app.use("/listings/:id/reviews", reviewRouter);
app.use("/", userRouter);

// 404 HANDLER
app.all(/(.*)/, (req, res, next) => {
    next(new expressErr(404, "Page Not Found!"));
});

// ERROR HANDLER
app.use((err, req, res, next) => {
    let {status = 500, message = "---ERROR---"} = err;
    res.status(status).render("error.ejs", { message });
    // res.status(status).send(message);
});

// SERVER
app.listen(8080, () => {
    console.log("Port 8080");
});