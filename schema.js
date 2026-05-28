const Joi = require("joi");
const { LISTING_CATEGORIES } = require("./utils/constants");

module.exports.listingSchema = Joi.object({
    listing: Joi.object({
        title:       Joi.string().trim().min(3).max(120).required(),
        description: Joi.string().trim().min(10).max(2000).required(),
        location:    Joi.string().trim().min(2).max(200).required(),
        country:     Joi.string().trim().min(2).max(100).required(),
        price:       Joi.number().integer().min(0).max(10_000_000).required(),
        category:    Joi.string().valid(...LISTING_CATEGORIES).allow("", null).optional(),
    }).required(),
    _csrf: Joi.string().optional(),
});

module.exports.reviewSchema = Joi.object({
    review: Joi.object({
        rating:  Joi.number().integer().min(1).max(5).required(),
        comment: Joi.string().trim().min(1).max(1000).required(),
    }).required(),
    _csrf: Joi.string().optional(),
});

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

module.exports.messageSchema = Joi.object({
    body:  Joi.string().trim().min(1).max(2000).required(),
    _csrf: Joi.string().optional(),
});

module.exports.conversationSchema = Joi.object({
    listingId:      Joi.string().required(),
    recipientId:    Joi.string().required(),
    bookingId:      Joi.string().optional().allow('', null),
    initialMessage: Joi.string().trim().min(1).max(2000).required(),
    _csrf:          Joi.string().optional(),
});

module.exports.bookingSchema = Joi.object({
    booking: Joi.object({
        checkIn: Joi.date()
            .custom((value, helpers) => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const submitted = new Date(value);
                submitted.setHours(0, 0, 0, 0);

                if (submitted < today) {
                    return helpers.error("date.min");
                }
                return value;
            })
            .required()
            .messages({
                "date.min": "Check-in date cannot be in the past.",
            }),
        checkOut: Joi.date().greater(Joi.ref("checkIn")).required(),
    })
        .required()
        .custom((value, helpers) => {
            const { checkIn, checkOut } = value;
            if (checkOut - checkIn < ONE_DAY_MS) {
                return helpers.error("any.invalid");
            }
            return value;
        })
        .messages({
            "any.invalid":
                "Check-out must be at least 1 night after check-in",
        }),
    _csrf: Joi.string().optional(),
});
