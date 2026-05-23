const mongoose = require("mongoose");
const Schema   = mongoose.Schema;
const _plm     = require("passport-local-mongoose");
const passportLocalMongoose = _plm.default || _plm;

const userSchema = new Schema({
    email: {
        type:     String,
        required: true,
        unique:   true,
        lowercase: true,
        trim:     true,
    },
    // 'username' is still added by passport-local-mongoose internally,
    // but we override the field it authenticates against to be 'email'.
});

// usernameField: "email" tells passport-local-mongoose to:
//   1. Use the email field for findByUsername() lookups
//   2. Expect req.body.email (not req.body.username) in the login POST
userSchema.plugin(passportLocalMongoose, {
    usernameField: "email",
    usernameLowerCase: true,
    errorMessages: {
        MissingPasswordError:   "No password was given.",
        AttemptTooSoonError:    "Account is currently locked. Try again later.",
        TooManyAttemptsError:   "Account locked due to too many failed login attempts.",
        NoSaltValueStoredError: "Authentication not possible.",
        IncorrectPasswordError: "Incorrect email or password.",
        IncorrectUsernameError: "Incorrect email or password.",
        MissingUsernameError:   "No email was given.",
        UserExistsError:        "A user with that email already exists.",
    },
});

module.exports = mongoose.model("User", userSchema);