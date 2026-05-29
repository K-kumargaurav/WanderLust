require('dotenv').config({
  path: require('path').join(__dirname, '../.env')
});

const mongoose = require('mongoose');
const User     = require('../models/user');

const ADMIN_EMAIL = 'kumargaurav74930@gmail.com';

async function makeAdmin() {
  await mongoose.connect(process.env.MONGO_URL);
  console.log('Connected to DB.');

  const user = await User.findOne({
    email: ADMIN_EMAIL.toLowerCase()
  });

  if (!user) {
    console.error(`No user found with email: ${ADMIN_EMAIL}`);
    console.log('Make sure you have signed up with this email first.');
    await mongoose.disconnect();
    process.exit(1);
  }

  user.role = 'admin';
  await user.save();

  console.log(`✓ Admin role granted to: ${user.email}`);
  console.log(`  Username: ${user.username}`);
  console.log(`  User ID:  ${user._id}`);

  await mongoose.disconnect();
  console.log('Done.');
}

makeAdmin().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
