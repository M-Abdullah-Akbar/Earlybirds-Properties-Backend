/**
 * Script to create SuperAdmin user
 * Run this once to set up the initial SuperAdmin
 */

require("dotenv").config({ path: "./backend/.env" });
const mongoose = require("mongoose");
const User = require("../models/User");

const createSuperAdmin = async () => {
  try {
    // Connect to database
    await mongoose.connect(
      process.env.DATABASE.replace("<PASSWORD>", process.env.DATABASE_PASSWORD)
    );
    console.log("Connected to database");

    // Check if SuperAdmin already exists
    const existingSuperAdmin = await User.findOne({ role: "SuperAdmin" });
    if (existingSuperAdmin) {
      console.log("SuperAdmin already exists:");
      console.log(`Username: ${existingSuperAdmin.username}`);
      console.log(`Email: ${existingSuperAdmin.email}`);
      console.log(`Name: ${existingSuperAdmin.name}`);
      process.exit(0);
    }

    // SuperAdmin credentials from environment variables
    const superAdminData = {
      username: process.env.ADMIN_USERNAME || "superadmin",
      email: process.env.ADMIN_EMAIL || "superadmin@realestate.com",
      name: process.env.ADMIN_NAME || "Super Administrator",
      password: process.env.ADMIN_PASSWORD || "SuperAdmin123!",
      role: "SuperAdmin",
      isActive: true,
    };

    // Don't hash password here - let the User model's pre('save') middleware handle it

    // Create SuperAdmin
    const superAdmin = new User(superAdminData);
    await superAdmin.save();

    console.log("✅ SuperAdmin created successfully!");
    console.log(`Username: ${superAdminData.username}`);
    console.log(`Email: ${superAdminData.email}`);
    console.log(`Name: ${superAdminData.name}`);
    console.log(`Role: ${superAdminData.role}`);
    console.log("\n🔐 Login credentials:");
    console.log(`Username: ${superAdminData.username}`);
    console.log(`Password: ${process.env.ADMIN_PASSWORD || "SuperAdmin123!"}`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error creating SuperAdmin:", error);
    process.exit(1);
  }
};

// Run the script
createSuperAdmin();
