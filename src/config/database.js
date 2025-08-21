const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoURI = process.env.ATLAS_URI || 'mongodb://localhost:27017/marketplace';
    
    const conn = await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    const collections = await mongoose.connection.db.listCollections().toArray();
    
  } catch (error) {
    // Server will continue running without database
    return false;
  }
};

module.exports = connectDB;