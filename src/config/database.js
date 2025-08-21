const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoURI = process.env.ATLAS_URI || 'mongodb://localhost:27017/marketplace';
    
    console.log('🔄 Conectando a MongoDB...');
    console.log('URI:', mongoURI.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@'));
    
    const conn = await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);
    
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('📁 Colecciones disponibles:', collections.map(c => c.name).join(', '));
    
  } catch (error) {
    console.error('❌ Error connecting to MongoDB:', error.message);
    
    if (error.message.includes('IP') || error.message.includes('whitelist')) {
      console.log('\n🔧 SOLUCIÓN SUGERIDA:');
      console.log('1. Ve a MongoDB Atlas: https://cloud.mongodb.com/');
      console.log('2. Network Access > Add IP Address');
      console.log('3. Agrega tu IP actual o usa 0.0.0.0/0 (desarrollo)');
      console.log('4. Guarda y espera unos minutos\n');
    }
    
    console.log('🔄 El servidor continuará ejecutándose sin base de datos');
    return false;
  }
};

module.exports = connectDB;