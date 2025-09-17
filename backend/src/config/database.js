const mongoose = require("mongoose");
const dns = require("dns");

// Set DNS servers to use Google DNS for better reliability
dns.setServers(["8.8.8.8", "8.8.4.4"]);

// Connect to MongoDB with enhanced error handling
const connectDB = async () => {
  try {
    const Db = process.env.DATABASE;

    // // Enhanced connection options for better reliability
    // const connectionOptions = {
    //   useNewUrlParser: true,
    //   useUnifiedTopology: true,
    //   serverSelectionTimeoutMS: 10000, // 10 seconds
    //   socketTimeoutMS: 45000, // 45 seconds
    //   family: 4, // Use IPv4, skip trying IPv6
    //   bufferCommands: false,
    //   maxPoolSize: 10,
    //   retryWrites: true,
    //   w: "majority",
    // };

    await mongoose.connect(Db);
  } catch (err) {
    console.error("❌ DB connection error:", err);
    process.exit(1);
  }
};

module.exports = { connectDB, mongoose };
