"use strict";

const express = require("express");
const router = express.Router();
const passport = require("passport");
const wrapAsync = require("../utils/wrapAsync");
const { saveRedirectUrl, isLoggedIn, validateCsrf } = require("../middleware");
const userController = require("../Controllers/user");

const rateLimit = require("express-rate-limit");

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: "Too many attempts — please try again in 15 minutes.",
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
});

// ─── SIGNUP ───────────────────────────────────────────────────────────────────
router
    .route("/signup")
    .get(userController.renderSignupForm)
    .post(authLimiter, validateCsrf, saveRedirectUrl, wrapAsync(userController.signup));

// ─── LOGIN ────────────────────────────────────────────────────────────────────
router
    .route("/login")
    .get(userController.renderLoginForm)
    .post(
        authLimiter,
        validateCsrf,

        (req, res, next) => {
            if (req.body.username) {
                req.body.username = req.body.username.trim().toLowerCase();
            }
            next();
        },

        passport.authenticate("local", {
            failureRedirect: "/login",
            failureFlash: true,
        }),

        (req, res) => {
            req.flash("success", "Welcome back to WanderLust!");
            const redirectUrl = req.session.redirectUrl || "/listings";
            delete req.session.redirectUrl;
            res.redirect(redirectUrl);
        }
    );

// ─── LOGOUT ───────────────────────────────────────────────────────────────────
router.get("/logout", userController.logout);

// ─── PROFILE ──────────────────────────────────────────────────────────────────
router.get("/profile", isLoggedIn, wrapAsync(userController.renderProfile));

// ─── FORGOT PASSWORD ──────────────────────────────────────────────────────────
router
    .route("/forgot-password")
    .get(userController.renderForgotForm)
    .post(authLimiter, validateCsrf, wrapAsync(userController.forgotPassword));

// ─── RESET PASSWORD ───────────────────────────────────────────────────────────
router
    .route("/reset/:token")
    .get(wrapAsync(userController.renderResetForm))
    .post(validateCsrf, wrapAsync(userController.resetPassword));

// ─── WISHLIST ─────────────────────────────────────────────────────────────────
router.post("/wishlist/:id", isLoggedIn, wrapAsync(userController.toggleWishlist));
router.get("/wishlist", isLoggedIn, wrapAsync(userController.renderWishlist));

module.exports = router;
