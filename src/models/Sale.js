const mongoose = require('mongoose');

const saleSchema = new mongoose.Schema({
  // Referencia a la orden original
  order: {
    type: mongoose.Schema.ObjectId,
    ref: 'Order',
    required: true
  },
  
  // Tienda que realiza la venta
  store: {
    type: mongoose.Schema.ObjectId,
    ref: 'Store',
    required: true
  },
  
  // Vendedor (propietario de la tienda)
  seller: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Comprador
  buyer: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Producto vendido
  product: {
    type: mongoose.Schema.ObjectId,
    ref: 'Product',
    required: true
  },
  
  // Detalles de la venta
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  
  unitPrice: {
    type: Number,
    required: true,
    min: 0
  },
  
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Costos y comisiones
  platformCommission: {
    type: Number,
    default: 0,
    min: 0
  },
  
  platformCommissionRate: {
    type: Number,
    default: 0.05, // 5% por defecto
    min: 0,
    max: 1
  },
  
  netAmount: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Información del pago
  paymentMethod: {
    type: String,
    enum: ['credit_card', 'debit_card', 'paypal', 'bank_transfer', 'cash'],
    required: true
  },
  
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'completed'
  },
  
  // Estado de la venta
  status: {
    type: String,
    enum: ['completed', 'cancelled', 'refunded'],
    default: 'completed'
  },
  
  // Fechas importantes
  saleDate: {
    type: Date,
    default: Date.now
  },
  
  // Notas adicionales
  notes: String,
  
  // Información de devolución/reembolso
  refundReason: String,
  refundAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  refundDate: Date

}, {
  timestamps: true
});

// Índices para optimizar consultas
saleSchema.index({ store: 1, createdAt: -1 });
saleSchema.index({ seller: 1, createdAt: -1 });
saleSchema.index({ buyer: 1, createdAt: -1 });
saleSchema.index({ product: 1, createdAt: -1 });
saleSchema.index({ order: 1 });
saleSchema.index({ status: 1 });
saleSchema.index({ saleDate: -1 });
saleSchema.index({ paymentStatus: 1 });

// Virtual para calcular la ganancia neta del vendedor
saleSchema.virtual('sellerProfit').get(function() {
  return this.netAmount;
});

// Middleware para calcular comisión y monto neto
saleSchema.pre('save', function(next) {
  if (this.isModified('totalAmount') || this.isModified('platformCommissionRate')) {
    this.platformCommission = this.totalAmount * this.platformCommissionRate;
    this.netAmount = this.totalAmount - this.platformCommission;
  }
  next();
});

// Método para procesar reembolso
saleSchema.methods.processRefund = function(amount, reason) {
  this.status = 'refunded';
  this.refundAmount = amount || this.totalAmount;
  this.refundReason = reason;
  this.refundDate = new Date();
  this.paymentStatus = 'refunded';
  return this.save();
};

// Método para cancelar venta
saleSchema.methods.cancel = function(reason) {
  this.status = 'cancelled';
  this.notes = reason || 'Venta cancelada';
  return this.save();
};

module.exports = mongoose.model('Sale', saleSchema);
