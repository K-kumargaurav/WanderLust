"use strict";

const express = require("express");
const router = express.Router();
const passport = require("passport");
const wrapAsync = require("../utils/wrapAsync");
const { saveRedirectUrl } = require("../middleware");
const userController = require("../Controllers/user");

const rateLimit = require("express-rate-limit");

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,              // tighter — 10 attempts per 15 min per IP
    message: "Too many login attempts — please try again in 15 minutes.",
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // don't count successful logins against the limit
});

// ─── SIGNUP ───────────────────────────────────────────────────────────────────
router
    .route("/signup")
    .get(userController.renderSignupForm)
    .post(authLimiter, saveRedirectUrl, wrapAsync(userController.signup));

// ─── LOGIN ────────────────────────────────────────────────────────────────────
router
    .route("/login")
    .get(userController.renderLoginForm)
    .post(
        authLimiter,

        (req, res, next) => {
            if (req.body.username) {
                req.body.username =
                    req.body.username.trim().toLowerCase();
            }

            next();
        },

        passport.authenticate("local", {
            failureRedirect: "/login",
            failureFlash: true,
        }),

        (req, res) => {
            req.flash(
                "success",
                "Welcome back to WanderLust!"
            );

            const redirectUrl =
                req.session.redirectUrl || "/listings";

            delete req.session.redirectUrl;

            res.redirect(redirectUrl);
        }
    );

// ─── LOGOUT ───────────────────────────────────────────────────────────────────
router.get("/logout", userController.logout);

module.exports = router;