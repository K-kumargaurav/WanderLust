const { listingSchema, reviewSchema } = require("../schema");

describe("Joi listingSchema", () => {
    test("should validate a correct listing", () => {
        const { error } = listingSchema.validate({
            listing: {
                title: "Test Listing",
                description: "A description that is at least 10 chars",
                location: "Mumbai",
                country: "India",
                price: 5000,
            },
        });
        expect(error).toBeUndefined();
    });

    test("should reject missing title", () => {
        const { error } = listingSchema.validate({
            listing: {
                description: "A description that is at least 10 chars",
                location: "Mumbai",
                country: "India",
                price: 5000,
            },
        });
        expect(error).toBeDefined();
    });

    test("should reject short description", () => {
        const { error } = listingSchema.validate({
            listing: {
                title: "Test",
                description: "Short",
                location: "Mumbai",
                country: "India",
                price: 5000,
            },
        });
        expect(error).toBeDefined();
    });

    test("should reject negative price", () => {
        const { error } = listingSchema.validate({
            listing: {
                title: "Test",
                description: "A valid description here",
                location: "Mumbai",
                country: "India",
                price: -100,
            },
        });
        expect(error).toBeDefined();
    });

    test("should accept valid category", () => {
        const { error } = listingSchema.validate({
            listing: {
                title: "Test",
                description: "A valid description here",
                location: "Mumbai",
                country: "India",
                price: 5000,
                category: "Mountains",
            },
        });
        expect(error).toBeUndefined();
    });

    test("should reject invalid category", () => {
        const { error } = listingSchema.validate({
            listing: {
                title: "Test",
                description: "A valid description here",
                location: "Mumbai",
                country: "India",
                price: 5000,
                category: "InvalidCategory",
            },
        });
        expect(error).toBeDefined();
    });

    test("should allow CSRF token in body", () => {
        const { error } = listingSchema.validate({
            listing: {
                title: "Test",
                description: "A valid description here",
                location: "Mumbai",
                country: "India",
                price: 5000,
            },
            _csrf: "some-token",
        });
        expect(error).toBeUndefined();
    });
});

describe("Joi reviewSchema", () => {
    test("should validate a correct review", () => {
        const { error } = reviewSchema.validate({
            review: { rating: 4, comment: "Nice place" },
        });
        expect(error).toBeUndefined();
    });

    test("should reject rating > 5", () => {
        const { error } = reviewSchema.validate({
            review: { rating: 6, comment: "Nice place" },
        });
        expect(error).toBeDefined();
    });

    test("should reject empty comment", () => {
        const { error } = reviewSchema.validate({
            review: { rating: 3, comment: "" },
        });
        expect(error).toBeDefined();
    });
});
