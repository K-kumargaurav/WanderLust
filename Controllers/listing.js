const Listing = require("../models/listing");

// INDEX
module.exports.index = async(req, res) => {
    const allListings = await Listing.find({});
    res.render("listings/index.ejs", {allListings});
};

// CREATE
module.exports.renderNewForm = (req, res) => {
    res.render("listings/new.ejs");
};

// SHOW
module.exports.showListing = async (req, res) => {
    let {id} = req.params;
    const listing = await Listing.findById(id).populate({path : "reviews", populate : "author",}).populate("owner");
    if(!listing) {
        req.flash("error", "Listing does not Exist!");
        res.redirect("/listings");
    }
    console.log(listing);
    res.render("listings/show.ejs", {listing});
};

// CREATE
module.exports.createListing = async (req, res) => {
    let url = req.file.path;
    let filename = req.file.filename;

    const newListing = new Listing(req.body.listing);
    newListing.owner = req.user._id;
    newListing.image = {url, filename};
    await newListing.save();
    req.flash("success", "New Listing Created!");
    res.redirect("/listings");
};

// EDIT
module.exports.renderEditForm = async (req, res) => {
    let {id} = req.params;
    const listing = await Listing.findById(id);
    if(!listing) {
        req.flash("error", "Listing does not exist!");
        res.redirect("/listings");
    }
    res.render("listings/edit.ejs", {listing});
};

// UPDATE
module.exports.updateListing = async (req, res) => {
    let {id} = req.params;
    await Listing.findByIdAndUpdate(id, {...req.body.listing} );
    req.flash("success", "Listing Updated!");
    return res.redirect(`/listings/${id}`);
};

// DELETE
module.exports.destroyListing = async(req, res) => {
    let {id} = req.params;
    let deletedListing = await Listing.findByIdAndDelete(id);
    console.log(deletedListing);
    req.flash("success", "Listing Deleted!");
    res.redirect("/listings");
};