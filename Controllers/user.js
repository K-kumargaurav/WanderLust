const User = require('../models/user');

// SIGN UP FORM
module.exports.renderSignupForm = (req, res) => {
    res.render('users/signup.ejs');
};

// SIGN UP
module.exports.signup = async (req, res) => {
    try{
        let { email, password, displayName} = req.body;
        const newUser = new User({ email, displayName });
        const registerUser = await User.register(newUser, password);
        console.log(registerUser);
        req.login(registerUser, (err) => {
            if(err) {
                return next(err);
            }
            req.flash("success", "Welcome to WanderLust :)");
            return res.redirect(req.session.redirectUrl || '/listings');
        });  
    } catch (err) {
        req.flash("error", err.message);
        res.redirect('/signup');
    }
};

// LOGIN FORM
module.exports.renderLoginForm =(req, res) => {
    res.render('users/login.ejs');
};

// LOGIN
module.exports.login = async (req, res) => {
    req.flash("success", "Welcome back to WanderLust :)");
    let redirectUrl = res.locals.redirectUrl || '/listings';
    delete req.session.redirectUrl;
    return res.redirect(redirectUrl);
};

// LOGOUT
module.exports.logout = (req, res, next) => {
    req.logout((err) => {
        if(err) {
            return next(err);
        }
        req.flash("success", "You have logged out.");
        return res.redirect('/listings');
    });
};