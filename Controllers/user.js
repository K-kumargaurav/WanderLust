const User = require("../models/user");

// SIGN UP FORM
module.exports.renderSignupForm = (req, res) => {
    res.render("users/signup.ejs");
};

// SIGN UP
module.exports.signup = async (req, res) => {
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
};

// LOGIN FORM
module.exports.renderLoginForm =(req, res) => {
    res.render("users/login.ejs");
};

// LOGIN
module.exports.login = async (req, res) => {
    req.flash("success", "Welcome back to WanderLust :)");
    let redirectUrl = res.locals.redirectUrl || "/listings";
    res.redirect(redirectUrl);
};

// LOGOUT
module.exports.logout = (req, res, next) => {
    req.logout((err) => {
        if(err) {
            return next(err);
        }
        req.flash("success", "You have logged out.");
        res.redirect("/listings");
    });
};