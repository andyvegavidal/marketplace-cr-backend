const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  // Información del pedido
  orderNumber: {
    type: String,
    unique: true,
    default: function() {
      const timestamp = Date.now().toString();
      const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      return `ORD-${timestamp}-${random}`;
    }
  },
  
  // Usuario que realiza el pedido
  buyer: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Items del pedido
  items: [{
    product: {
      type: mongoose.Schema.ObjectId,
      ref: 'Product',
      required: true
    },
    store: {
      type: mongoose.Schema.ObjectId,
      ref: 'Store',
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    total: {
      type: Number,
      required: true,
      min: 0
    }
  }],
  
  // Información de envío
  shippingAddress: {
    alias: String,
    country: String,
    provincia: String,
    canton: String,
    distrito: String,
    numeroCasillero: String,
    codigoPostal: String,
    observaciones: String
  },
  
  // Información de pago
  paymentMethod: {
    type: String,
    enum: ['credit_card', 'debit_card', 'paypal', 'bank_transfer', 'cash'],
    required: true
  },
  
  paymentStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  
  // Totales
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  
  shippingCost: {
    type: Number,
    default: 0,
    min: 0
  },
  
  tax: {
    type: Number,
    default: 0,
    min: 0
  },
  
  total: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Estado del pedido
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
    default: 'pending'
  },
  
  // Fechas importantes
  estimatedDeliveryDate: Date,
  shippedDate: Date,
  deliveredDate: Date,
  
  // Información de tracking
  trackingNumber: String,
  carrier: String,
  
  // Notas del pedido
  notes: String,
  
  // Información de cancelación
  cancelReason: String,
  cancelledBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  cancelledDate: Date
  
}, {
  timestamps: true
});

// Índices para optimizar consultas
orderSchema.index({ buyer: 1, createdAt: -1 });
orderSchema.index({ 'items.store': 1, createdAt: -1 });
orderSchema.index({ status: 1 });
orderSchema.index({ orderNumber: 1 }, { unique: true });

// Virtual para obtener tiendas involucradas
orderSchema.virtual('stores').get(function() {
  const storeIds = [...new Set(this.items.map(item => item.store.toString()))];
  return storeIds;
});

// Método para generar número de pedido
orderSchema.statics.generateOrderNumber = function() {
  const timestamp = Date.now().toString();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `ORD-${timestamp}-${random}`;
};

// Método para calcular totales
orderSchema.methods.calculateTotals = function() {
  this.subtotal = this.items.reduce((sum, item) => sum + item.total, 0);
  this.total = this.subtotal + this.shippingCost + this.tax;
  return this;
};

// Middleware para generar número de pedido
orderSchema.pre('save', function(next) {
  if (this.isNew && !this.orderNumber) {
    this.orderNumber = this.constructor.generateOrderNumber();
  }
  next();
});

// Middleware para calcular totales automáticamente
orderSchema.pre('save', function(next) {
  this.calculateTotals();
  next();
});

module.exports = mongoose.model('Order', orderSchema);
