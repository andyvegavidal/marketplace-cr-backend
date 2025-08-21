const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, 'Cantidad debe ser al menos 1'],
    default: 1
  },
  price: {
    type: Number,
    required: true,
    min: [0, 'Precio no puede ser negativo']
  },
  addedAt: {
    type: Date,
    default: Date.now
  }
});

const cartSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  items: [cartItemSchema],
  totalAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  lastModified: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Índices
// Índices para búsquedas (userId ya tiene unique: true)
cartSchema.index({ 'items.productId': 1 });
cartSchema.index({ lastModified: -1 });

// Virtual para obtener información del usuario
cartSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true
});

// Middleware para actualizar totalAmount y lastModified antes de guardar
cartSchema.pre('save', function(next) {
  this.totalAmount = this.items.reduce((total, item) => {
    return total + (item.price * item.quantity);
  }, 0);
  this.lastModified = new Date();
  next();
});

// Método para agregar item al carrito
cartSchema.methods.addItem = function(productId, quantity, price) {
  const existingItem = this.items.find(item => 
    item.productId.toString() === productId.toString()
  );
  
  if (existingItem) {
    existingItem.quantity += quantity;
    existingItem.price = price; // Actualizar precio por si cambió
  } else {
    this.items.push({
      productId,
      quantity,
      price,
      addedAt: new Date()
    });
  }
  
  return this.save();
};

// Método para actualizar cantidad de un item
cartSchema.methods.updateItemQuantity = function(productId, quantity) {
  const item = this.items.find(item => 
    item.productId.toString() === productId.toString()
  );
  
  if (!item) {
    throw new Error('Producto no encontrado en el carrito');
  }
  
  if (quantity <= 0) {
    return this.removeItem(productId);
  }
  
  item.quantity = quantity;
  return this.save();
};

// Método para remover item del carrito
cartSchema.methods.removeItem = function(productId) {
  this.items = this.items.filter(item => 
    item.productId.toString() !== productId.toString()
  );
  return this.save();
};

// Método para limpiar carrito
cartSchema.methods.clear = function() {
  this.items = [];
  this.totalAmount = 0;
  return this.save();
};

// Método para obtener cantidad total de items
cartSchema.methods.getTotalItems = function() {
  return this.items.reduce((total, item) => total + item.quantity, 0);
};

// Método para verificar si el carrito está vacío
cartSchema.methods.isEmpty = function() {
  return this.items.length === 0;
};

// Método para obtener items agrupados por tienda
cartSchema.methods.getItemsByStore = async function() {
  await this.populate('items.productId');
  
  const itemsByStore = {};
  
  for (const item of this.items) {
    if (!item.productId) continue; // Skip if product was deleted
    
    const storeId = item.productId.storeId.toString();
    
    if (!itemsByStore[storeId]) {
      itemsByStore[storeId] = {
        storeId,
        items: [],
        subtotal: 0
      };
    }
    
    itemsByStore[storeId].items.push(item);
    itemsByStore[storeId].subtotal += item.price * item.quantity;
  }
  
  return Object.values(itemsByStore);
};

// Método estático para obtener o crear carrito
cartSchema.statics.getOrCreateCart = async function(userId) {
  let cart = await this.findOne({ userId });
  
  if (!cart) {
    cart = new this({ userId, items: [] });
    await cart.save();
  }
  
  return cart;
};

// Asegurar que virtuals se incluyan en JSON
cartSchema.set('toJSON', { virtuals: true });
cartSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Cart', cartSchema);
