const express = require("express");
const app = express();
const mongoose = require("mongoose");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const expressErr = require("./utils/expressErr.js");

const listings = require("./route/listing.js");
const reviews = require("./route/review.js");

const MONGO_URL = "mongodb://127.0.0.1:27017/wanderlust";

main()
    .then(() => {
        console.log("Connected to DB.")
    }).catch((err) => {
        console.log(err);
    });

async function main() {
  await mongoose.connect(MONGO_URL);
}

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({extended: true}));
app.use(methodOverride("_method"));
app.engine("ejs", ejsMate);
app.use(express.static(path.join(__dirname, "/public")));

app.get("/", (req, res) => {
    res.send("Hi! I am root.");
});

app.use("/listings", listings);
app.use("/listings/:id/reviews", reviews);

app.all(/(.*)/, (req, res, next) => {
    next(new expressErr(404, "Page Not Found!"));
});

app.use((err, req, res, next) => {
    let {status = 500, message = "---ERROR---"} = err;
    res.status(status).render("error.ejs", { message });
    // res.status(status).send(message);
});

app.listen(8080, () => {
    console.log("Port 8080");
});