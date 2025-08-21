const mongoose = require('mongoose');

const purchaseSchema = new mongoose.Schema({
  // Referencia a la orden original
  order: {
    type: mongoose.Schema.ObjectId,
    ref: 'Order',
    required: true
  },
  
  // Usuario que realiza la compra
  buyer: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Producto comprado
  product: {
    type: mongoose.Schema.ObjectId,
    ref: 'Product',
    required: true
  },
  
  // Tienda del producto
  store: {
    type: mongoose.Schema.ObjectId,
    ref: 'Store',
    required: true
  },
  
  // Detalles de la compra
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
  
  // Estado de la compra
  status: {
    type: String,
    enum: ['completed', 'cancelled', 'refunded'],
    default: 'completed'
  },
  
  // Fechas importantes
  purchaseDate: {
    type: Date,
    default: Date.now
  },
  
  // Notas adicionales
  notes: String

}, {
  timestamps: true
});

// Índices para optimizar consultas
purchaseSchema.index({ buyer: 1, createdAt: -1 });
purchaseSchema.index({ product: 1, createdAt: -1 });
purchaseSchema.index({ store: 1, createdAt: -1 });
purchaseSchema.index({ order: 1 });
purchaseSchema.index({ status: 1 });
purchaseSchema.index({ purchaseDate: -1 });

// Virtual para calcular la ganancia de la compra (precio total - descuentos)
purchaseSchema.virtual('totalCost').get(function() {
  return this.totalAmount;
});

// Método para cancelar compra
purchaseSchema.methods.cancel = function(reason) {
  this.status = 'cancelled';
  this.notes = reason || 'Compra cancelada';
  return this.save();
};

// Método para procesar reembolso
purchaseSchema.methods.refund = function(reason) {
  this.status = 'refunded';
  this.notes = reason || 'Compra reembolsada';
  return this.save();
};

module.exports = mongoose.model('Purchase', purchaseSchema);
