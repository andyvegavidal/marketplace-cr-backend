const mongoose = require('mongoose');

const wishlistItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  addedAt: {
    type: Date,
    default: Date.now
  }
});

const wishlistSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  products: [wishlistItemSchema]
}, {
  timestamps: true
});

// Índices (userId ya tiene unique: true)
wishlistSchema.index({ 'products.productId': 1 });
wishlistSchema.index({ 'products.addedAt': -1 });

// Virtual para obtener información del usuario
wishlistSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true
});

// Método para agregar producto a wishlist
wishlistSchema.methods.addProduct = function(productId) {
  const existingProduct = this.products.find(item => 
    item.productId.toString() === productId.toString()
  );
  
  if (existingProduct) {
    throw new Error('Producto ya está en la lista de deseos');
  }
  
  this.products.push({
    productId,
    addedAt: new Date()
  });
  
  return this.save();
};

// Método para remover producto de wishlist
wishlistSchema.methods.removeProduct = function(productId) {
  this.products = this.products.filter(item => 
    item.productId.toString() !== productId.toString()
  );
  return this.save();
};

// Método para verificar si un producto está en wishlist
wishlistSchema.methods.hasProduct = function(productId) {
  return this.products.some(item => 
    item.productId.toString() === productId.toString()
  );
};

// Método para limpiar wishlist
wishlistSchema.methods.clear = function() {
  this.products = [];
  return this.save();
};

// Método para obtener cantidad de productos
wishlistSchema.methods.getProductsCount = function() {
  return this.products.length;
};

// Método para verificar si wishlist está vacía
wishlistSchema.methods.isEmpty = function() {
  return this.products.length === 0;
};

// Método para obtener productos con información completa
wishlistSchema.methods.getProductsWithDetails = async function() {
  await this.populate({
    path: 'products.productId',
    populate: {
      path: 'storeId',
      select: 'userId description rating'
    }
  });
  
  // Filtrar productos que aún existen
  return this.products.filter(item => item.productId !== null);
};

// Método estático para obtener o crear wishlist
wishlistSchema.statics.getOrCreateWishlist = async function(userId) {
  let wishlist = await this.findOne({ userId });
  
  if (!wishlist) {
    wishlist = new this({ userId, products: [] });
    await wishlist.save();
  }
  
  return wishlist;
};

// Middleware para limpiar productos eliminados
wishlistSchema.pre('save', async function(next) {
  if (this.isModified('products')) {
    const Product = mongoose.model('Product');
    const validProducts = [];
    
    for (const item of this.products) {
      const product = await Product.findById(item.productId);
      if (product && product.active) {
        validProducts.push(item);
      }
    }
    
    this.products = validProducts;
  }
  next();
});

// Asegurar que virtuals se incluyan en JSON
wishlistSchema.set('toJSON', { virtuals: true });
wishlistSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Wishlist', wishlistSchema);
