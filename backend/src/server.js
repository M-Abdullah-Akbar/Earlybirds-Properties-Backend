const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const path = require("path");
// Load environment variables
const fs = require('fs');
let envPath = "./backend/.env"; // Default for development

// Check if we're running the built version (from dist folder)
if (fs.existsSync("./dist/.env")) {
  envPath = "./dist/.env";
} else if (fs.existsSync("./.env")) {
  envPath = "./.env";
}

require("dotenv").config({ path: envPath });
const { connectDB, mongoose } = require("./config/database.js");

// Import routes
const authRoutes = require("./routes/auth");
const propertyRoutes = require("./routes/properties");
const propertyApprovalRoutes = require("./routes/propertyApproval");
const uploadRoutes = require("./routes/upload");
const userRoutes = require("./routes/users");
const emailRoutes = require("./routes/email");
const newsletterRoutes = require("./routes/newsletter");
const blogRoutes = require("./routes/blogs");
const blogCategoryRoutes = require("./routes/blogCategories");
const blogCategoryApprovalRoutes = require("./routes/blogCategoryApproval");
const errorHandler = require("./middleware/errorHandler.js");

const app = express();

// Security middleware - optimized for performance
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false, // Disable for better performance
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow cross-origin resources
}));

// Performance headers - add early to all responses
app.use((req, res, next) => {
  // Enable keep-alive for better connection reuse
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Keep-Alive', 'timeout=5, max=1000');

  // Add performance hints
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-DNS-Prefetch-Control', 'on');

  // Enable HTTP/2 Server Push hints (if supported)
  if (req.path.startsWith('/uploads/') && req.path.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
    res.setHeader('Link', `<${req.path}>; rel=preload; as=image`);
  }

  next();
});
// CORS configuration - Allow multiple origins
const allowedOrigins = [
  process.env.Admin_URL,
  process.env.User_URL,
  process.env.BASE_URL,
  "https://vocal-genie-167c56.netlify.app/",
  "https://singular-cupcake-772ab9.netlify.app/",
  "http://localhost:3000",
  "http://localhost:3001",
].filter(Boolean); // Remove any undefined values

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

// Body parsing middleware - Increased limits for image uploads
app.use(express.json({ limit: "110mb" }));
app.use(express.urlencoded({ extended: true, limit: "110mb" }));

// Compression middleware - optimized for better performance
app.use(compression({
  level: 6, // Balance between compression and CPU usage (1-9, 6 is optimal)
  threshold: 1024, // Only compress responses > 1KB
  filter: (req, res) => {
    // Don't compress if client doesn't support it
    if (req.headers['x-no-compression']) {
      return false;
    }
    // Use compression for all other requests
    return compression.filter(req, res);
  }
}));

// Serve static files from uploads directory with optimized caching
app.use("/uploads", express.static(path.join(__dirname, "../uploads"), {
  maxAge: '1y', // Cache for 1 year
  immutable: true,
  etag: true,
  lastModified: true,
  setHeaders: (res, path) => {
    // Set aggressive caching for images
    if (path.match(/\.(jpg|jpeg|png|gif|webp|avif|svg)$/i)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
}));

// Request logging middleware - only in development to reduce overhead
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(
      `🌐 Incoming request: ${req.method} ${req.originalUrl
      } - ${new Date().toISOString()}`
    );
    next();
  });
}

// API Routes - with caching headers
app.get("/api", (req, res) => {
  // Set cache headers for API info endpoint
  res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
  res.status(200).json({
    success: true,
    message: "Real Estate API v1.0",
    version: "1.0.0",
    endpoints: {
      auth: "/api/auth",
      properties: "/api/properties",
      blogs: "/api/blogs",
      blogCategories: "/api/blog-categories",
    },
  });
});

const apicache = require('apicache');
const cache = apicache.middleware;

// Routes
app.use("/api/auth", authRoutes);
// Cache properties and blogs for 5 minutes to reduce DB load
app.use("/api/properties", cache('5 minutes'), propertyRoutes);
app.use("/api/property-approval", propertyApprovalRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/users", userRoutes);
app.use("/api/email", emailRoutes);
app.use("/api/newsletter", newsletterRoutes);
app.use("/api/blogs", cache('5 minutes'), blogRoutes);
app.use("/api/blog-categories", cache('5 minutes'), blogCategoryRoutes);
app.use("/api/blog-category-approval", blogCategoryApprovalRoutes);

app.use(errorHandler);

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({ error: "Route not found" });
});

const PORT = process.env.PORT || 3000;

// Optimize Express app settings for better performance
app.set('etag', 'strong'); // Enable ETags for caching
app.set('x-powered-by', false); // Remove X-Powered-By header (already handled by helmet)

// Connect to database and start server
const startServer = async () => {
  try {
    // Connect to database first
    await connectDB();

    // Start server with optimized settings
    const server = app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`⚡ Performance optimizations enabled`);
    });

    // Optimize server settings for better performance
    server.keepAliveTimeout = 65000; // 65 seconds (slightly longer than load balancer)
    server.headersTimeout = 66000; // 66 seconds (slightly longer than keepAliveTimeout)

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM signal received: closing HTTP server');
      server.close(() => {
        console.log('HTTP server closed');
        mongoose.connection.close(false, () => {
          console.log('MongoDB connection closed');
          process.exit(0);
        });
      });
    });

  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
