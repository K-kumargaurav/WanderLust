const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync.js");
const expressErr = require("../utils/expressErr.js");
const {listingSchema} = require("../schema.js");
const Listing = require("../models/listing");

const validateListing = (req, res, next) => {
    let {error} = listingSchema.validate(req.body);
    if(error) {
        let errMsg = error.details.map((el) => el.message).join(",");
        throw new expressErr(404, errMsg)
    }else {
        next();
    }
}

//INDEX ROUTE
router.get("/", wrapAsync( async(req, res) => {
    const allListings = await Listing.find({});
    res.render("listings/index.ejs", {allListings});
}));

//NEW ROUTE
router.get("/new", wrapAsync( async (req, res) => {
    res.render("listings/new.ejs");
}));

//SHOW ROUTE
router.get("/:id", async (req, res) => {
    let {id} = req.params;
    const listing = await Listing.findById(id).populate("reviews");
    if(!listing) {
        req.flash("error", "Listing does not Exist!");
        res.redirect("/listings");
    }
    res.render("listings/show.ejs", {listing});
});

// CREATE ROUTE
router.post("/", validateListing, wrapAsync(async (req, res) => {
    const newListing = new Listing(req.body.listing);
    await newListing.save();
    req.flash("success", "New Listing Created!");
    res.redirect("/listings");
}));

// EDIT ROUTE
router.get("/:id/edit", wrapAsync( async (req, res) => {
    let {id} = req.params;
    const listing = await Listing.findById(id);
    if(!listing) {
        req.flash("error", "Listing does not exist!");
        res.redirect("/listings");
    }
    res.render("listings/edit.ejs", {listing});
}));

// UPDATE ROUTE
router.put("/:id", validateListing, wrapAsync( async (req, res) => {
    let {id} = req.params;
    await Listing.findByIdAndUpdate(id, {...req.body.listing} );
    req.flash("success", "Listing Updated!");
    res.redirect(`/listings/${id}`);
}));

// DELETE ROUTE
router.delete("/:id", wrapAsync( async(req, res) => {
    let {id} = req.params;
    let deletedListing = await Listing.findByIdAndDelete(id);
    console.log(deletedListing);
    req.flash("success", "Listing Deleted!");
    res.redirect("/listings");
}));

module.exports = router;