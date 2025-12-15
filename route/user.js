const express = require("express");
const router = express.Router();
const User = require("../models/user.js");
const wrapAsync = require("../utils/wrapAsync");
const passport = require("passport");
const { saveRedirectUrl } = require("../middleware");

const userController = require("../Controllers/user");

router.route("/signup")
    // SIGN UP FORM 
    .get(userController.renderSignupForm)
    // SIGNUP
    .post(wrapAsync(userController.signup));

router.route("/login")
    // LOGIN FORM
    .get(userController.renderLoginForm)
    // LOGIN
    .post(saveRedirectUrl, passport.authenticate("local", { failureRedirect : "/login", failureFlash : true, }), userController.login);

// LOGOUT
router.get("/logout", userController.logout);

module.exports = router;