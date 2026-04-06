/**
 * Database connection module.
 *
 * Uses Mongoose to connect to MongoDB. The connection string is read
 * from the MONGODB_URI environment variable.
 *
 * Called once at server startup (server.js → start()).
 */
import mongoose from "mongoose";

const connectDB = async () => {
  // mongoose.connect() returns a Mongoose instance whose `.connection`
  // property exposes host, port, database name, etc.
  const conn = await mongoose.connect(process.env.MONGODB_URI);
  console.log(`MongoDB connected: ${conn.connection.host}`);
};

export default connectDB;