"use strict";

const crypto = require("crypto");
const User = require("../models/user");
const Listing = require("../models/listing");
const Review = require("../models/review");
const Booking = require("../models/booking");
const expressErr = require("../utils/expressErr");
const { sendPasswordResetEmail } = require("../services/email.service");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isValidEmailFormat(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Renders the signup form.
 *
 * Redirects to /listings if the user is already authenticated.
 *
 * @route   GET /signup
 * @access  Public
 *
 * @param   {import('express').Request}  req
 * @param   {import('express').Response} res
 * @returns {void}
 */
module.exports.renderSignupForm = (req, res) => {
    if (req.isAuthenticated()) {
        return res.redirect("/listings");
    }
    res.render("users/signup.ejs");
};

/**
 * Registers a new user account and logs them in.
 *
 * Validates email format and password length, checks for duplicates,
 * then creates the user via passport-local-mongoose's register().
 * Auto-logs the user in on success and redirects to the saved URL
 * or /listings.
 *
 * @route   POST /signup
 * @access  Public
 *
 * @param   {import('express').Request}  req
 * @param   {import('express').Response} res
 * @param   {import('express').NextFunction} next
 * @returns {Promise<void>}
 */
module.exports.signup = async (req, res, next) => {
    try {
        const { email, password: rawPassword } = req.body;

        if (!email || !rawPassword) {
            req.flash("error", "Email and password are required.");
            return res.redirect("/signup");
        }

        const trimmedEmail = email.trim().toLowerCase();
        const password = rawPassword.trim();

        if (!isValidEmailFormat(trimmedEmail)) {
            req.flash("error", "Please enter a valid email address.");
            return res.redirect("/signup");
        }

        if (password.length < 8) {
            req.flash("error", "Password must be at least 8 characters.");
            return res.redirect("/signup");
        }

        const existing = await User.findOne({ email: trimmedEmail });
        if (existing) {
            req.flash("error", "An account with that email already exists.");
            return res.redirect("/signup");
        }

        const newUser = new User({
            email: trimmedEmail,
            username: trimmedEmail,
        });
        const registeredUser = await User.register(newUser, password);

        req.login(registeredUser, (err) => {
            if (err) return next(err);
            req.flash("success", "Welcome to WanderLust! Your account has been created.");
            const redirectUrl = res.locals.redirectUrl || "/listings";
            return res.redirect(redirectUrl);
        });

    } catch (err) {
        req.flash("error", err.message || "Signup failed. Please try again.");
        return res.redirect("/signup");
    }
};

/**
 * Renders the login form.
 *
 * Redirects to /listings if the user is already authenticated.
 *
 * @route   GET /login
 * @access  Public
 *
 * @param   {import('express').Request}  req
 * @param   {import('express').Response} res
 * @returns {void}
 */
module.exports.renderLoginForm = (req, res) => {
    if (req.isAuthenticated()) {
        return res.redirect("/listings");
    }
    res.render("users/login.ejs");
};

/**
 * Post-login handler (no-op).
 *
 * Authentication is handled by the Passport middleware in the route file.
 * This export exists so the controller interface stays consistent.
 *
 * @route   POST /login
 * @access  Public
 *
 * @param   {import('express').Request}  req
 * @param   {import('express').Response} res
 * @returns {void}
 */
module.exports.login = (req, res) => {};

/**
 * Logs the user out and redirects to /listings.
 *
 * @route   GET /logout
 * @access  Authenticated
 *
 * @param   {import('express').Request}  req
 * @param   {import('express').Response} res
 * @param   {import('express').NextFunction} next
 * @returns {void}
 */
module.exports.logout = (req, res, next) => {
    req.logout((err) => {
        if (err) return next(err);
        req.flash("success", "You have been logged out. See you soon!");
        res.redirect("/listings");
    });
};

/**
 * Renders the user's profile page with their listings and reviews.
 *
 * Uses a single aggregation pipeline to fetch reviews with their
 * associated listings, avoiding the N+1 query problem.
 *
 * @route   GET /profile
 * @access  Authenticated
 *
 * @param   {import('express').Request}  req
 * @param   {import('express').Response} res
 * @returns {Promise<void>}
 */
module.exports.renderProfile = async (req, res) => {
    const user = await User.findById(req.user._id);
    const myListings = await Listing.find({ owner: req.user._id }).sort({ createdAt: -1 });

    const myBookings = await Booking.find({ guest: req.user._id, status: "confirmed" });

    const reviewsWithListings = await Review.aggregate([
        { $match: { author: req.user._id } },
        {
            $lookup: {
                from: "listings",
                localField: "_id",
                foreignField: "reviews",
                as: "listingData",
            },
        },
        {
            $unwind: {
                path: "$listingData",
                preserveNullAndEmptyArrays: true,
            },
        },
        {
            $project: {
                comment: 1,
                rating: 1,
                createdAt: 1,
                listing: {
                    _id: "$listingData._id",
                    title: "$listingData.title",
                    location: "$listingData.location",
                    images: "$listingData.images",
                },
            },
        },
        { $sort: { createdAt: -1 } },
    ]);

    res.render("users/profile.ejs", {
        user,
        myListings,
        reviewsWithListings,
        bookingCount: myBookings.length,
    });
};

/**
 * Renders the "forgot password" form.
 *
 * @route   GET /forgot-password
 * @access  Public
 *
 * @param   {import('express').Request}  req
 * @param   {import('express').Response} res
 * @returns {void}
 */
module.exports.renderForgotForm = (req, res) => {
    res.render("users/forgot-password.ejs");
};

/**
 * Generates a password reset token and emails it to the user.
 *
 * Always shows a generic success message regardless of whether the
 * email exists to prevent email enumeration. Stores a SHA-256 hash
 * of the token in the database; the raw token goes in the email link.
 *
 * @route   POST /forgot-password
 * @access  Public
 *
 * @param   {import('express').Request}  req
 * @param   {import('express').Response} res
 * @returns {Promise<void>}
 */
module.exports.forgotPassword = async (req, res) => {
    const { email } = req.body;
    if (!email) {
        req.flash("error", "Please enter your email address.");
        return res.redirect("/forgot-password");
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });

    // Always show success message to prevent email enumeration
    if (!user) {
        req.flash("success", "If an account with that email exists, a reset link has been sent.");
        return res.redirect("/login");
    }

    // Generate reset token
    const token = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken   = crypto.createHash("sha256").update(token).digest("hex");
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    try {
        await sendPasswordResetEmail(user.email, token, req.headers.host);
        req.flash("success", "If an account with that email exists, a reset link has been sent.");
    } catch (err) {
        console.error("Email send error:", err.message);
        req.flash("error", "Could not send reset email. Please try again later.");
    }

    return res.redirect("/login");
};

/**
 * Renders the password reset form if the token is valid and unexpired.
 *
 * Hashes the URL token and looks up the matching user. Redirects to
 * /forgot-password with an error flash if the token is invalid or expired.
 *
 * @route   GET /reset/:token
 * @access  Public
 *
 * @param   {import('express').Request}  req
 * @param   {import('express').Response} res
 * @returns {Promise<void>}
 */
module.exports.renderResetForm = async (req, res) => {
    const hashedToken = crypto.createHash("sha256").update(req.params.token).digest("hex");
    const user = await User.findOne({
        resetPasswordToken: hashedToken,
        resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
        req.flash("error", "Password reset link is invalid or has expired.");
        return res.redirect("/forgot-password");
    }

    res.render("users/reset-password.ejs", { token: req.params.token });
};

/**
 * Resets the user's password using a valid reset token.
 *
 * Validates the token, enforces minimum password length, sets the new
 * password via passport-local-mongoose, clears the reset fields, and
 * auto-logs the user in.
 *
 * @route   POST /reset/:token
 * @access  Public
 *
 * @param   {import('express').Request}  req
 * @param   {import('express').Response} res
 * @returns {Promise<void>}
 */
module.exports.resetPassword = async (req, res) => {
    const hashedToken = crypto.createHash("sha256").update(req.params.token).digest("hex");
    const user = await User.findOne({
        resetPasswordToken: hashedToken,
        resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
        req.flash("error", "Password reset link is invalid or has expired.");
        return res.redirect("/forgot-password");
    }

    const { password } = req.body;
    if (!password || password.trim().length < 8) {
        req.flash("error", "Password must be at least 8 characters.");
        return res.redirect(`/reset/${req.params.token}`);
    }

    await user.setPassword(password.trim());
    user.resetPasswordToken   = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    req.login(user, (err) => {
        if (err) {
            req.flash("error", "Password reset succeeded but auto-login failed. Please log in.");
            return res.redirect("/login");
        }
        req.flash("success", "Your password has been reset successfully!");
        return res.redirect("/listings");
    });
};

/**
 * Toggles a listing in the user's wishlist (add if absent, remove if present).
 *
 * Returns JSON for AJAX requests or redirects back for standard form
 * submissions.
 *
 * @route   POST /wishlist/:id
 * @access  Authenticated
 *
 * @param   {import('express').Request}  req
 * @param   {import('express').Response} res
 * @returns {Promise<void>}
 */
module.exports.toggleWishlist = async (req, res) => {
    const { id } = req.params;
    const user = await User.findById(req.user._id);

    const idx = user.wishlist.indexOf(id);
    if (idx === -1) {
        user.wishlist.push(id);
    } else {
        user.wishlist.splice(idx, 1);
    }
    await user.save();

    // For AJAX requests, return JSON
    if (req.xhr || req.headers.accept?.includes("application/json")) {
        return res.json({ wishlisted: idx === -1 });
    }

    res.redirect("back");
};

/**
 * Renders the user's wishlist page with populated listing data.
 *
 * @route   GET /wishlist
 * @access  Authenticated
 *
 * @param   {import('express').Request}  req
 * @param   {import('express').Response} res
 * @returns {Promise<void>}
 */
module.exports.renderWishlist = async (req, res) => {
    const user = await User.findById(req.user._id).populate("wishlist");
    res.render("users/wishlist.ejs", { wishlistListings: user.wishlist });
};
