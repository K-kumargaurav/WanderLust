const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const _plm = require("passport-local-mongoose");
const passportLocalMongoose = _plm.default || _plm;

const userSchema = new Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
});

userSchema.plugin(passportLocalMongoose, {
    errorMessages: {
        MissingPasswordError:
            "No password was given.",

        AttemptTooSoonError:
            "Account is currently locked. Try again later.",

        TooManyAttemptsError:
            "Account locked due to too many failed login attempts.",

        NoSaltValueStoredError:
            "Authentication not possible.",

        IncorrectPasswordError:
            "Incorrect email or password.",

        IncorrectUsernameError:
            "Incorrect email or password.",

        MissingUsernameError:
            "No email was given.",

        UserExistsError:
            "A user with that email already exists.",
    },
});

module.exports = mongoose.model("User", userSchema);