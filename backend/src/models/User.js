const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
      select: false, // Don't include password in queries by default
    },
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [50, "Name cannot exceed 50 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please enter a valid email",
      ],
    },
    role: {
      type: String,
      enum: ["SuperAdmin", "admin"],
      default: "admin", // Default to admin, SuperAdmin is created manually
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    loginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null, // SuperAdmin won't have createdBy
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null, // Track who last updated this user
    },
  },
  {
    timestamps: true,
  }
);

// Index for better query performance
userSchema.index({ username: 1 });
userSchema.index({ email: 1 });

// Hash password before saving
userSchema.pre("save", async function (next) {
  // Only hash password if it's been modified
  if (!this.isModified("password")) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(parseInt(process.env.BCRYPT_ROUNDS));
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Generate JWT token
userSchema.methods.generateAuthToken = function () {
  const expiresIn = process.env.JWT_EXPIRE;
  console.log('JWT_EXPIRE value:', expiresIn);
  
  if (!expiresIn) {
    throw new Error('JWT_EXPIRE environment variable is not set. Please configure it in your deployment environment.');
  }
  
  return jwt.sign(
    {
      id: this._id,
      username: this.username,
      email: this.email,
      role: this.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: expiresIn, // Fallback to 24h if not set
    }
  );
};

// Update last login and reset login attempts
userSchema.methods.updateLastLogin = function () {
  this.lastLogin = new Date();
  this.loginAttempts = 0;
  this.lockUntil = null;
  return this.save();
};

// Increment login attempts and lock account if needed
userSchema.methods.incrementLoginAttempts = function () {
  const maxAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS);
  const lockTime = parseInt(process.env.ACCOUNT_LOCK_TIME) * 60 * 1000; // minutes to milliseconds

  this.loginAttempts += 1;

  // Lock account after max attempts
  if (this.loginAttempts >= maxAttempts) {
    this.lockUntil = new Date(Date.now() + lockTime);
  }

  return this.save();
};

// Check if account is locked
userSchema.methods.isLocked = function () {
  return this.lockUntil && this.lockUntil > new Date();
};

// Transform output (remove sensitive data)
userSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.password;
  delete user.loginAttempts; // Hide security info
  delete user.lockUntil; // Hide security info
  delete user.__v; // Hide Mongoose version key
  return user;
};

module.exports = mongoose.model("User", userSchema);
