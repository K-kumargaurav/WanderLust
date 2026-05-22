const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const _plm = require("passport-local-mongoose");
const passportLocalMongoose = _plm.default || _plm;

const userSchema = new Schema({
    email: {
        type: String,
        required: true,
    },
});

userSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model("User", userSchema);