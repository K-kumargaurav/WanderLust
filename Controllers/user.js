"use strict";

const User = require("../models/user");
const expressErr = require("../utils/expressErr");

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Primitive email format check (Joi/validator handles deep validation on the
 * model side; this is a fast-fail guard before touching the DB).
 * @param {string} email
 * @returns {boolean}
 */
function isValidEmailFormat(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ─── SIGNUP FORM ──────────────────────────────────────────────────────────────
module.exports.renderSignupForm = (req, res) => {
    // Redirect authenticated users away from the signup page
    if (req.isAuthenticated()) {
        return res.redirect("/listings");
    }
    res.render("users/signup.ejs");
};

// ─── SIGNUP ───────────────────────────────────────────────────────────────────
module.exports.signup = async (req, res, next) => {
    try {
        const { email, password: rawPassword } = req.body;

        // ── Input validation ────────────────────────────────────────────────
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

        // ── Explicit duplicate check ────────────────────────────────────────
        // passport-local-mongoose throws "UserExistsError" on duplicates, but
        // checking first lets us give a cleaner UX message without relying on
        // error string matching.
        const existing = await User.findOne({ email: trimmedEmail });
        if (existing) {
            req.flash("error", "An account with that email already exists.");
            return res.redirect("/signup");
        }

        // ── Register user ───────────────────────────────────────────────────
        // User.register(user, password) hashes the password via pbkdf2 and
        // saves the document atomically.
        const newUser = new User({
            email: trimmedEmail,
            username: trimmedEmail,
        });
        const registeredUser = await User.register(newUser, password);

        // ── Auto-login after registration ───────────────────────────────────
        req.login(registeredUser, (err) => {
            if (err) return next(err);
            req.flash("success", "Welcome to WanderLust! Your account has been created.");
            const redirectUrl = res.locals.redirectUrl || "/listings";
            return res.redirect(redirectUrl);
        });

    } catch (err) {
        // passport-local-mongoose error messages are user-safe; forward them.
        req.flash("error", err.message || "Signup failed. Please try again.");
        return res.redirect("/signup");
    }
};

// ─── LOGIN FORM ───────────────────────────────────────────────────────────────
module.exports.renderLoginForm = (req, res) => {
    // Redirect authenticated users away from the login page
    if (req.isAuthenticated()) {
        return res.redirect("/listings");
    }
    res.render("users/login.ejs");
};

// ─── LOGIN ─────────────────────────────────────────────────────────────────────
// The actual authentication is handled by the custom passport callback in
// route/user.js. This stub exists only to satisfy the route definition pattern.
// It is never called because the route middleware always resolves before it.
module.exports.login = (req, res) => {
    // Intentionally unreachable — passport callback in route/user.js handles
    // the success/failure response before this controller action is reached.
};

// ─── LOGOUT ───────────────────────────────────────────────────────────────────
module.exports.logout = (req, res, next) => {
    req.logout((err) => {
        if (err) return next(err);
        req.flash("success", "You have been logged out. See you soon!");
        res.redirect("/listings");
    });
};