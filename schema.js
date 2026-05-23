const Joi = require("joi");
const { LISTING_CATEGORIES } = require("./models/listing");

module.exports.listingSchema = Joi.object({
    listing: Joi.object({
        title:       Joi.string().trim().min(3).max(120).required(),
        description: Joi.string().trim().min(10).max(2000).required(),
        location:    Joi.string().trim().min(2).max(200).required(),
        country:     Joi.string().trim().min(2).max(100).required(),
        price:       Joi.number().integer().min(0).max(10_000_000).required(),
        // image is optional here because multer handles it separately;
        // when present (e.g. edit form sending the existing URL) it must be a URI.
        image:       Joi.string().uri().allow("", null).optional(),
        category:    Joi.string().valid(...LISTING_CATEGORIES).allow("", null).optional(),
    }).required(),
});

module.exports.reviewSchema = Joi.object({
    review: Joi.object({
        rating:  Joi.number().integer().min(1).max(5).required(),
        comment: Joi.string().trim().min(1).max(1000).required(),
    }).required(),
});