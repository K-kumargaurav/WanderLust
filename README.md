# WanderLust

A full-stack vacation rental platform where users can discover, list, and review unique stays around the world. Built with Node.js, Express 5, MongoDB, and deployed on Render.

**Live Demo:** [wanderlust-0h7o.onrender.com](https://wanderlust-0h7o.onrender.com)

---

## Features

- **User Authentication** -- Signup, login, logout with hashed passwords and rate-limited auth endpoints
- **Password Reset** -- Email-based reset flow with time-limited tokens via Nodemailer
- **Listing CRUD** -- Create, edit, delete listings with ownership verification
- **Multi-Image Upload** -- Up to 3 images per listing, stored on Cloudinary with auto-optimization
- **Interactive Maps** -- Geocoded listings displayed on Mapbox maps
- **Search & Filter** -- Full-text search across title, location, country with 10 category filters
- **Sorting & Pagination** -- Sort by newest, oldest, price (low/high) with paginated results
- **Reviews & Ratings** -- 1-5 star rating system with inline editing and author verification
- **Wishlist** -- Save favorite listings with AJAX toggle (no page reload)
- **User Profile** -- Dashboard showing your listings, reviews, and account stats
- **Tax Toggle** -- Show/hide GST breakdown on listing prices
- **CSRF Protection** -- Session-based tokens on all state-changing forms
- **Security Headers** -- Helmet.js with strict Content Security Policy
- **Responsive Design** -- Editorial luxury aesthetic with Cormorant Garamond + DM Sans typography

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Runtime** | Node.js 22 |
| **Framework** | Express 5 |
| **Database** | MongoDB Atlas + Mongoose 8 |
| **Auth** | Passport.js (local strategy) + passport-local-mongoose |
| **Templates** | EJS + ejs-mate layouts |
| **Image Storage** | Cloudinary + multer |
| **Maps** | Mapbox GL JS + Mapbox Geocoding API |
| **Email** | Nodemailer (Brevo SMTP) |
| **Validation** | Joi |
| **Security** | Helmet, CSRF tokens, express-rate-limit |
| **Sessions** | express-session + connect-mongo |
| **Testing** | Jest + mongodb-memory-server + Supertest |
| **Deployment** | Render |

---

## Project Structure

```
WanderLust/
├── app.js                  # Application entry point
├── cloudConfig.js          # Cloudinary configuration
├── middleware.js            # Auth, CSRF, validation middleware
├── schema.js               # Joi validation schemas
├── package.json
├── .env.example            # Environment variable template
│
├── Controllers/
│   ├── listing.js          # Listing CRUD logic
│   ├── review.js           # Review CRUD logic
│   └── user.js             # Auth, profile, wishlist, password reset
│
├── models/
│   ├── listing.js          # Listing schema (with indexes & GeoJSON)
│   ├── review.js           # Review schema
│   └── user.js             # User schema (passport-local-mongoose)
│
├── route/
│   ├── listing.js          # Listing routes
│   ├── review.js           # Review routes
│   └── user.js             # User routes
│
├── views/
│   ├── layouts/boilerplate.ejs
│   ├── includes/           # navbar, footer, flash
│   ├── listings/           # index, show, new, edit
│   ├── users/              # signup, login, profile, wishlist, forgot/reset password
│   ├── pages/              # privacy, terms
│   └── error.ejs
│
├── public/
│   ├── css/                # style.css, rating.css
│   └── js/                 # script.js, map.js
│
├── init/
│   ├── index.js            # Database seed script
│   └── data.js             # Sample listing data
│
├── utils/
│   ├── expressErr.js       # Custom error class
│   └── wrapAsync.js        # Async error wrapper
│
└── tests/
    ├── models.test.js      # Model & schema tests
    └── validation.test.js  # Joi validation tests
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v22+
- [MongoDB Atlas](https://www.mongodb.com/atlas) account (or local MongoDB)
- [Cloudinary](https://cloudinary.com/) account
- [Mapbox](https://www.mapbox.com/) account
- SMTP provider for emails (e.g., [Brevo](https://www.brevo.com/))

### Installation

```bash
# Clone the repository
git clone https://github.com/K-kumargaurav/WanderLust.git
cd WanderLust

# Install dependencies
npm install

# Create environment file
cp .env.example .env
# Edit .env with your credentials
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `MONGO_URL` | MongoDB connection string |
| `SECRET` | Session secret key |
| `CLOUD_NAME` | Cloudinary cloud name |
| `CLOUD_API_KEY` | Cloudinary API key |
| `CLOUD_API_SECRET` | Cloudinary API secret |
| `MAP_TOKEN` | Mapbox public access token |
| `SMTP_HOST` | SMTP server hostname |
| `SMTP_PORT` | SMTP port (default: 587) |
| `SMTP_USER` | SMTP username |
| `SMTP_PASS` | SMTP password |
| `PORT` | Server port (default: 8080) |
| `NODE_ENV` | `development` or `production` |

### Run

```bash
# Seed the database with sample data
npm run seed

# Start development server (with nodemon)
npm run dev

# Start production server
npm start
```

Visit `http://localhost:8080`

---

## API Routes

### Listings

| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| GET | `/listings` | Browse listings (search, filter, sort, paginate) | No |
| GET | `/listings/new` | New listing form | Yes |
| POST | `/listings` | Create listing | Yes |
| GET | `/listings/:id` | View listing detail | No |
| GET | `/listings/:id/edit` | Edit listing form | Owner |
| PUT | `/listings/:id` | Update listing | Owner |
| DELETE | `/listings/:id` | Delete listing | Owner |

### Reviews

| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| POST | `/listings/:id/reviews` | Add review | Yes |
| PUT | `/listings/:id/reviews/:reviewId` | Edit review | Author |
| DELETE | `/listings/:id/reviews/:reviewId` | Delete review | Author |

### Users

| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| GET | `/signup` | Signup form | No |
| POST | `/signup` | Register account | No |
| GET | `/login` | Login form | No |
| POST | `/login` | Authenticate | No |
| GET | `/logout` | Log out | Yes |
| GET | `/profile` | User dashboard | Yes |
| GET | `/wishlist` | View wishlist | Yes |
| POST | `/wishlist/:id` | Toggle wishlist item | Yes |
| GET | `/forgot-password` | Reset request form | No |
| POST | `/forgot-password` | Send reset email | No |
| GET | `/reset/:token` | Reset password form | No |
| POST | `/reset/:token` | Set new password | No |

### Other

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/` | Redirect to `/listings` |
| GET | `/health` | Health check (returns `{ status: "ok" }`) |
| GET | `/privacy` | Privacy policy |
| GET | `/terms` | Terms of service |

---

## Data Models

### User
```
email        String   (required, unique, lowercase)
username     String   (same as email, used by passport)
hash         String   (auto-generated password hash)
salt         String   (auto-generated)
wishlist     [ObjectId -> Listing]
resetPasswordToken    String
resetPasswordExpires  Date
```

### Listing
```
title        String   (required, 3-120 chars)
description  String   (required, 10-2000 chars)
images       [{url, filename}]  (up to 3)
price        Number   (min: 0)
location     String   (required)
country      String   (required)
category     Enum     (11 categories)
owner        ObjectId -> User
reviews      [ObjectId -> Review]
geometry     GeoJSON Point (auto-geocoded)
createdAt    Date
```

### Review
```
comment      String   (required, 1-1000 chars)
rating       Number   (1-5)
author       ObjectId -> User
createdAt    Date
```

---

## Testing

```bash
# Run all tests (20 tests across 2 suites)
npm test
```

Tests use `mongodb-memory-server` for an isolated in-memory database. Covers:
- Model creation and validation
- Schema constraints (enum, min/max, required)
- Cascade deletion (listing -> reviews)
- Joi validation rules for listings and reviews

---

## Deployment (Render)

1. Push your code to GitHub
2. Create a new **Web Service** on [Render](https://render.com)
3. Connect your GitHub repository
4. Configure:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Node Version:** 22
5. Add all environment variables from `.env.example`
6. Set `NODE_ENV=production`
7. Optionally set `/health` as the health check path

---

## License

ISC
