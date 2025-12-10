const express = require("express");
const router = express.Router();
const User = require("../models/user");
const wrapAsync = require("../utils/wrapAsync");
const passport = require("passport");
const { saveRedirectUrl } = require("../middleware");

router.get("/signup", (req, res) => {
    res.render("users/signup.ejs");
});

// ṢIGN UP
router.post("/signup", wrapAsync(async (req, res) => {
    try{
        let { username, email, password} = req.body;
        const newUser = new User({email, username});
        const registeredUser = await User.register(newUser, password);
        console.log(registeredUser);
        req.login(registeredUser, (err) => {
            if(err) {
                return next(err);
            }
            req.flash("success", "Welcome to WanderLust :)");
            res.redirect(req.session.redirectUrl);
        });  
    } catch (err) {
        req.flash("error", err.message);
        res.redirect("/signup");
    }
    })
);

// LOGIN
router.get("/login", (req, res) => {
    res.render("users/login.ejs");
});

router.post("/login", saveRedirectUrl, passport.authenticate("local", { failureRedirect : "/login", failureFlash : true, }), 
    async(req, res) => {
    res.flash("success", "Welcome back to WanderLust :)");
    let redirectUrl = res.locals.redirectUrl || "/listings";
    res.redirect(redirectUrl);
});

// LOGOUT
router.get("/logout", (req, res, next) => {
    req.logout((err) => {
        if(err) {
            return next(err);
        }
        req.flash("success", "You have logged out.");
        res.redirect("/listings");
    });
});

module.exports = router;