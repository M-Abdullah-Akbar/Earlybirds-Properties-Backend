const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const compression = require("compression");
const path = require("path");
require("dotenv").config({
  path: process.env.NODE_ENV === "production" ? "./.env" : "./backend/.env",
});
const { connectDB } = require("./config/database.js");

// Import routes
const authRoutes = require("./routes/auth");
const propertyRoutes = require("./routes/properties");
const uploadRoutes = require("./routes/upload");
const userRoutes = require("./routes/users");
const emailRoutes = require("./routes/email");
const errorHandler = require("./middleware/errorHandler.js");

const app = express();

// Security middleware
app.use(helmet());
// CORS configuration - Allow multiple origins
const allowedOrigins = [
  process.env.Admin_URL,
  process.env.User_URL,
  process.env.BASE_URL,
  "http://localhost:3000",
  "http://localhost:3001",
].filter(Boolean); // Remove any undefined values

console.log("🔧 CORS: Allowed origins:", allowedOrigins);

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        return callback(new Error(`Not allowed by CORS. Origin: ${origin}`));
      }
    },
    credentials: true,
    optionsSuccessStatus: 200,
  })
);

// // Rate limiting - General
// const limiter = rateLimit({
//   windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
//   max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
//   message: {
//     error: "Too many requests from this IP, please try again later.",
//   },
//   standardHeaders: true,
//   legacyHeaders: false,
// });

// // Strict rate limiting for auth endpoints (relaxed for testing)
// const authLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 50, // limit each IP to 50 auth requests per windowMs (increased for testing)
//   message: {
//     error:
//       "Too many authentication attempts from this IP, please try again later.",
//   },
//   standardHeaders: true,
//   legacyHeaders: false,
//   skipSuccessfulRequests: true, // Don't count successful requests
// });

// app.use("/api/", limiter);
// app.use("/api/auth/", authLimiter);

// Body parsing middleware - Increased limits for image uploads
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

// Compression middleware
app.use(compression());

// Serve static files from uploads directory
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// API Routes
app.get("/api", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Real Estate API v1.0",
    version: "1.0.0",
    endpoints: {
      auth: "/api/auth",
      properties: "/api/properties",
    },
  });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/properties", propertyRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/users", userRoutes);
app.use("/api/email", emailRoutes);

app.use(errorHandler);

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({ error: "Route not found" });
});

const PORT = process.env.PORT || 3000;

// Connect to database and start server
const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
