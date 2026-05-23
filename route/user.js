const express    = require("express");
const router     = express.Router();
const wrapAsync  = require("../utils/wrapAsync");
const passport   = require("passport");
const { saveRedirectUrl } = require("../middleware");
const userController      = require("../Controllers/user");

// ─── SIGNUP ───────────────────────────────────────────────────────────────────
router
    .route("/signup")
    .get(userController.renderSignupForm)
    .post(wrapAsync(userController.signup));

// ─── LOGIN ────────────────────────────────────────────────────────────────────

router
    .route("/login")
    .get(userController.renderLoginForm)
    .post(saveRedirectUrl, (req, res, next) => {
        passport.authenticate("local", (err, user, info) => {
            // Hard error from the strategy (DB down, etc.)
            if (err) return next(err);

            // Authentication failed — info.message comes from passport-local-mongoose
            if (!user) {
                req.flash("error", info?.message || "Invalid username or password.");
                return res.redirect("/login");
            }

            // Authentication succeeded — log the user in and establish the session
            req.logIn(user, (loginErr) => {
                if (loginErr) return next(loginErr);

                req.flash("success", "Welcome back to WanderLust!");
                const redirectUrl = res.locals.redirectUrl || "/listings";
                return res.redirect(redirectUrl);
            });
        })(req, res, next); // immediately invoke — passport returns a middleware fn
    });

// ─── LOGOUT ───────────────────────────────────────────────────────────────────
router.get("/logout", userController.logout);

module.exports = router;