"use strict";

const crypto = require("crypto");
const User = require("../models/user");
const Listing = require("../models/listing");
const Review = require("../models/review");
const expressErr = require("../utils/expressErr");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isValidEmailFormat(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Send a password reset email. Uses nodemailer.
 * Requires SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS env vars.
 */
async function sendResetEmail(email, token, host) {
    const nodemailer = require("nodemailer");

    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: false,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });

    const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
    const resetUrl = `${protocol}://${host}/reset/${token}`;

    await transporter.sendMail({
        from: `"WanderLust" <${process.env.SMTP_USER || "noreply@wanderlust.com"}>`,
        to: email,
        subject: "WanderLust — Password Reset",
        html: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
                <h2>Password Reset</h2>
                <p>You requested a password reset for your WanderLust account.</p>
                <p><a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#C0602A;color:white;text-decoration:none;border-radius:8px">Reset Password</a></p>
                <p style="color:#888;font-size:0.85rem">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
            </div>
        `,
    });
}

// ─── SIGNUP FORM ──────────────────────────────────────────────────────────────
module.exports.renderSignupForm = (req, res) => {
    if (req.isAuthenticated()) {
        return res.redirect("/listings");
    }
    res.render("users/signup.ejs");
};

// ─── SIGNUP ───────────────────────────────────────────────────────────────────
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

// ─── LOGIN FORM ───────────────────────────────────────────────────────────────
module.exports.renderLoginForm = (req, res) => {
    if (req.isAuthenticated()) {
        return res.redirect("/listings");
    }
    res.render("users/login.ejs");
};

// ─── LOGIN (handled by passport in route) ─────────────────────────────────────
module.exports.login = (req, res) => {};

// ─── LOGOUT ───────────────────────────────────────────────────────────────────
module.exports.logout = (req, res, next) => {
    req.logout((err) => {
        if (err) return next(err);
        req.flash("success", "You have been logged out. See you soon!");
        res.redirect("/listings");
    });
};

// ─── PROFILE ──────────────────────────────────────────────────────────────────
module.exports.renderProfile = async (req, res) => {
    const user = await User.findById(req.user._id);
    const myListings = await Listing.find({ owner: req.user._id }).sort({ createdAt: -1 });
    const myReviews  = await Review.find({ author: req.user._id }).sort({ createdAt: -1 });

    // Populate listing info for each review
    const reviewsWithListings = [];
    for (const review of myReviews) {
        const listing = await Listing.findOne({ reviews: review._id });
        reviewsWithListings.push({ review, listing });
    }

    res.render("users/profile.ejs", {
        user,
        myListings,
        reviewsWithListings,
    });
};

// ─── FORGOT PASSWORD FORM ─────────────────────────────────────────────────────
module.exports.renderForgotForm = (req, res) => {
    res.render("users/forgot-password.ejs");
};

// ─── FORGOT PASSWORD ──────────────────────────────────────────────────────────
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
        await sendResetEmail(user.email, token, req.headers.host);
        req.flash("success", "If an account with that email exists, a reset link has been sent.");
    } catch (err) {
        console.error("Email send error:", err.message);
        req.flash("error", "Could not send reset email. Please try again later.");
    }

    return res.redirect("/login");
};

// ─── RESET PASSWORD FORM ──────────────────────────────────────────────────────
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

// ─── RESET PASSWORD ───────────────────────────────────────────────────────────
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

// ─── WISHLIST ─────────────────────────────────────────────────────────────────
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

module.exports.renderWishlist = async (req, res) => {
    const user = await User.findById(req.user._id).populate("wishlist");
    res.render("users/wishlist.ejs", { wishlistListings: user.wishlist });
};
