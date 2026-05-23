const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");

let mongoServer;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

afterEach(async () => {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
        await collections[key].deleteMany({});
    }
});

const User    = require("../models/user");
const Listing = require("../models/listing");
const Review  = require("../models/review");

describe("User model", () => {
    test("should register a new user", async () => {
        const user = new User({ email: "test@example.com", username: "test@example.com" });
        const registered = await User.register(user, "password123");
        expect(registered.email).toBe("test@example.com");
        expect(registered.username).toBe("test@example.com");
        expect(registered.hash).toBeDefined();
    });

    test("should reject duplicate email", async () => {
        const u1 = new User({ email: "dup@example.com", username: "dup@example.com" });
        await User.register(u1, "password123");

        const u2 = new User({ email: "dup@example.com", username: "dup2@example.com" });
        await expect(User.register(u2, "password123")).rejects.toThrow();
    });

    test("should have wishlist array", async () => {
        const user = new User({ email: "wl@example.com", username: "wl@example.com" });
        const registered = await User.register(user, "password123");
        expect(Array.isArray(registered.wishlist)).toBe(true);
        expect(registered.wishlist.length).toBe(0);
    });
});

describe("Listing model", () => {
    test("should create a listing with images array", async () => {
        const listing = new Listing({
            title: "Test Listing",
            description: "A test listing description",
            images: [{ url: "http://example.com/img.jpg", filename: "img" }],
            price: 1000,
            location: "Test City",
            country: "Test Country",
            geometry: { type: "Point", coordinates: [0, 0] },
        });
        const saved = await listing.save();
        expect(saved.images.length).toBe(1);
        expect(saved.images[0].url).toBe("http://example.com/img.jpg");
    });

    test("virtual image returns first image", async () => {
        const listing = new Listing({
            title: "Test",
            description: "Test description text",
            images: [
                { url: "http://first.jpg", filename: "first" },
                { url: "http://second.jpg", filename: "second" },
            ],
            price: 500,
            location: "Loc",
            country: "Country",
            geometry: { type: "Point", coordinates: [0, 0] },
        });
        const saved = await listing.save();
        expect(saved.image.url).toBe("http://first.jpg");
    });

    test("should validate category enum", async () => {
        const listing = new Listing({
            title: "Test",
            description: "Test description text",
            images: [],
            price: 500,
            location: "Loc",
            country: "Country",
            category: "InvalidCategory",
            geometry: { type: "Point", coordinates: [0, 0] },
        });
        await expect(listing.save()).rejects.toThrow();
    });

    test("should accept valid category", async () => {
        const listing = new Listing({
            title: "Test",
            description: "Test description text",
            images: [],
            price: 500,
            location: "Loc",
            country: "Country",
            category: "Mountains",
            geometry: { type: "Point", coordinates: [0, 0] },
        });
        const saved = await listing.save();
        expect(saved.category).toBe("Mountains");
    });

    test("should cascade delete reviews", async () => {
        const review = await new Review({ comment: "Great!", rating: 5 }).save();
        const listing = await new Listing({
            title: "Test",
            description: "Test description text",
            images: [],
            price: 500,
            location: "Loc",
            country: "Country",
            reviews: [review._id],
            geometry: { type: "Point", coordinates: [0, 0] },
        }).save();

        await Listing.findByIdAndDelete(listing._id);
        const foundReview = await Review.findById(review._id);
        expect(foundReview).toBeNull();
    });
});

describe("Review model", () => {
    test("should create a review", async () => {
        const review = new Review({ comment: "Great place!", rating: 5 });
        const saved = await review.save();
        expect(saved.comment).toBe("Great place!");
        expect(saved.rating).toBe(5);
        expect(saved.createdAt).toBeDefined();
    });

    test("should reject rating out of range", async () => {
        const review = new Review({ comment: "Bad", rating: 6 });
        await expect(review.save()).rejects.toThrow();
    });
});
