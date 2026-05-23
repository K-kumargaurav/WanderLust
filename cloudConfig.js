const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "WanderLust_DEV",
    allowedFormats: ["png", "jpg", "jpeg"],
    transformation: [
      {
        width: 2000,
        crop: "limit",
        quality: "auto",
      },
    ],
  },
});

/**
 * Delete an image from Cloudinary by its public ID (filename).
 * Silently logs errors — a failed cleanup should not crash the request.
 */
async function deleteImage(filename) {
  if (!filename) return;
  try {
    await cloudinary.uploader.destroy(filename);
  } catch (err) {
    console.error("Cloudinary delete error:", err.message);
  }
}

module.exports = { cloudinary, storage, deleteImage };
