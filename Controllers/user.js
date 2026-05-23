const User = require("../models/user");

// ─── SIGNUP FORM ──────────────────────────────────────────────────────────────
module.exports.renderSignupForm = (req, res) => {
    res.render("users/signup.ejs");
};

// ─── SIGNUP ───────────────────────────────────────────────────────────────────
module.exports.signup = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        // passport-local-mongoose's User.register(user, password) hashes the
        // password and saves the document. Since usernameField is "email",
        // the first argument just needs { email }.
        const newUser        = new User({ email });
        const registeredUser = await User.register(newUser, password);

        req.login(registeredUser, (err) => {
            if (err) return next(err);
            req.flash("success", "Welcome to WanderLust!");
            const redirectUrl = res.locals.redirectUrl || "/listings";
            res.redirect(redirectUrl);
        });
    } catch (err) {
        req.flash("error", err.message);
        res.redirect("/signup");
    }
};

// ─── LOGIN FORM ───────────────────────────────────────────────────────────────
module.exports.renderLoginForm = (req, res) => {
    res.render("users/login.ejs");
};

// ─── LOGIN ────────────────────────────────────────────────────────────────────
// Flash + redirect are handled in route/user.js via the custom passport
// callback — this controller action is intentionally not reached.
module.exports.login = (req, res) => {};

// ─── LOGOUT ───────────────────────────────────────────────────────────────────
module.exports.logout = (req, res, next) => {
    req.logout((err) => {
        if (err) return next(err);
        req.flash("success", "You have been logged out.");
        res.redirect("/listings");
    });
};