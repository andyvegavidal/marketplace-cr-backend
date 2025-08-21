const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    required: [true, 'ID de tienda es requerido']
  },
  name: {
    type: String,
    required: [true, 'Nombre del producto es requerido'],
    trim: true,
    maxlength: [100, 'Nombre no puede exceder 100 caracteres']
  },
  description: {
    type: String,
    required: [true, 'Descripción es requerida'],
    trim: true,
    maxlength: [1000, 'Descripción no puede exceder 1000 caracteres']
  },
  category: {
    type: String,
    required: [true, 'Categoría es requerida'],
    trim: true
  },
  price: {
    type: Number,
    required: [true, 'Precio es requerido'],
    min: [0, 'Precio no puede ser negativo']
  },
  stock: {
    type: Number,
    required: [true, 'Stock es requerido'],
    min: [0, 'Stock no puede ser negativo'],
    default: 0
  },
  physicalLocation: {
    type: String,
    required: [true, 'Ubicación física es requerida'],
    trim: true
  },
  averageShippingTime: {
    type: String,
    required: [true, 'Tiempo promedio de envío es requerido'],
    trim: true
  },
  images: [{
    type: String,
    required: true
  }],
  featured: {
    type: Boolean,
    default: false
  },
  publishDate: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Estadísticas del producto
  views: {
    type: Number,
    default: 0
  },
  salesCount: {
    type: Number,
    default: 0
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  reviewsCount: {
    type: Number,
    default: 0
  },
  // Información adicional
  specifications: {
    type: Map,
    of: String,
    default: new Map()
  },
  tags: [{
    type: String,
    trim: true
  }],
  // SEO
  slug: {
    type: String,
    unique: true,
    sparse: true
  },
  // Configuraciones del producto
  settings: {
    allowReviews: {
      type: Boolean,
      default: true
    },
    allowComments: {
      type: Boolean,
      default: true
    },
    trackInventory: {
      type: Boolean,
      default: true
    }
  }
}, {
  timestamps: true
});

// Índices
productSchema.index({ storeId: 1 });
productSchema.index({ category: 1 });
productSchema.index({ featured: 1 });
productSchema.index({ isActive: 1 });
productSchema.index({ price: 1 });
productSchema.index({ rating: -1 });
productSchema.index({ salesCount: -1 });
productSchema.index({ views: -1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ name: 'text', description: 'text' }); // Para búsqueda de texto

// Virtual para obtener información de la tienda
productSchema.virtual('store', {
  ref: 'Store',
  localField: 'storeId',
  foreignField: '_id',
  justOne: true
});

// Virtual para obtener reseñas
productSchema.virtual('reviews', {
  ref: 'Review',
  localField: '_id',
  foreignField: 'targetId',
  match: { targetType: 'product' }
});

// Virtual para obtener comentarios
productSchema.virtual('comments', {
  ref: 'Comment',
  localField: '_id',
  foreignField: 'productId'
});

// Middleware para generar slug antes de guardar
productSchema.pre('save', function(next) {
  if (this.isModified('name') && !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9 -]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim('-') + '-' + this._id.toString().slice(-6);
  }
  next();
});

// Método para incrementar vistas
productSchema.methods.incrementViews = function() {
  this.views += 1;
  return this.save();
};

// Método para incrementar ventas
productSchema.methods.incrementSales = function(quantity = 1) {
  this.salesCount += quantity;
  return this.save();
};

// Método para reducir stock
productSchema.methods.reduceStock = function(quantity) {
  if (this.stock < quantity) {
    throw new Error('Stock insuficiente');
  }
  this.stock -= quantity;
  return this.save();
};

// Método para calcular rating promedio
productSchema.methods.calculateAverageRating = async function() {
  const Review = mongoose.model('Review');
  const reviews = await Review.find({ 
    targetId: this._id, 
    targetType: 'product' 
  });
  
  if (reviews.length === 0) {
    this.rating = 0;
    this.reviewsCount = 0;
  } else {
    const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
    this.rating = Math.round((sum / reviews.length) * 10) / 10; // Redondear a 1 decimal
    this.reviewsCount = reviews.length;
  }
  
  return this.save();
};

// Método para verificar disponibilidad
productSchema.methods.isAvailable = function(quantity = 1) {
  return this.isActive && this.stock >= quantity;
};

// Asegurar que virtuals se incluyan en JSON
productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Product', productSchema);
