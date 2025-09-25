const mongoose = require("mongoose");
const dns = require("dns");

// Set DNS servers to use Google DNS for better reliability
dns.setServers(["8.8.8.8", "8.8.4.4"]);

// Connect to MongoDB with enhanced error handling and performance optimization
const connectDB = async () => {
  try {
    const Db = process.env.DATABASE;

    // Enhanced connection options for better performance and reliability
    const connectionOptions = {
      // Connection pool settings for better performance
      maxPoolSize: 20, // Maximum number of connections in the pool
      minPoolSize: 5,  // Minimum number of connections in the pool
      maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
      
      // Timeout settings to prevent slow responses
      serverSelectionTimeoutMS: 5000, // 5 seconds to select a server
      socketTimeoutMS: 20000, // 20 seconds socket timeout
      connectTimeoutMS: 10000, // 10 seconds connection timeout
      
      // Performance optimizations
      bufferCommands: false, // Disable mongoose buffering
      
      // Network optimizations
      family: 4, // Use IPv4, skip trying IPv6
      retryWrites: true,
      w: "majority",
      
      // Compression for better network performance
      compressors: ['zlib'],
      zlibCompressionLevel: 6,
    };

    await mongoose.connect(Db, connectionOptions);
    
    console.log("✅ MongoDB connected successfully with optimized settings");
    
    // Set up connection event listeners for monitoring
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB disconnected');
    });
    
    mongoose.connection.on('reconnected', () => {
      console.log('🔄 MongoDB reconnected');
    });
    
  } catch (err) {
    console.error("❌ DB connection error:", err);
    process.exit(1);
  }
};

module.exports = { connectDB, mongoose };
