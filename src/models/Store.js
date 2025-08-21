const mongoose = require('mongoose');

const storeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  description: {
    default: '',
    type: String,
    required: [false, 'Descripción de la tienda es requerida'],
    trim: true,
    maxlength: [500, 'Descripción no puede exceder 500 caracteres']
  },
  categories: [{
    type: String,
    trim: true
  }],
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  totalSales: {
    type: Number,
    default: 0,
    min: 0
  },
  joinDate: {
    type: Date,
    default: Date.now
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  followers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  followersCount: {
    type: Number,
    default: 0
  },
  verified: {
    type: Boolean,
    default: false
  },
  // Estadísticas adicionales
  totalProducts: {
    type: Number,
    default: 0
  },
  totalReviews: {
    type: Number,
    default: 0
  },
  responseTime: {
    type: Number, // en horas
    default: 24
  },
  // Configuraciones de la tienda
  settings: {
    allowReviews: {
      type: Boolean,
      default: true
    },
    allowComments: {
      type: Boolean,
      default: true
    },
    autoAcceptOrders: {
      type: Boolean,
      default: false
    }
  }
}, {
  timestamps: true
});

// Índices
storeSchema.index({ userId: 1 });
storeSchema.index({ isPublic: 1 });
storeSchema.index({ verified: 1 });
storeSchema.index({ rating: -1 });
storeSchema.index({ totalSales: -1 });
storeSchema.index({ categories: 1 });

// Virtual para obtener información del usuario
storeSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true
});

// Virtual para obtener productos
storeSchema.virtual('products', {
  ref: 'Product',
  localField: '_id',
  foreignField: 'storeId'
});

// Virtual para obtener reseñas
storeSchema.virtual('reviews', {
  ref: 'Review',
  localField: '_id',
  foreignField: 'targetId',
  match: { targetType: 'store' }
});

// Middleware para actualizar contadores
storeSchema.methods.updateFollowersCount = function() {
  this.followersCount = this.followers.length;
  return this.save();
};

// Método para agregar seguidor
storeSchema.methods.addFollower = function(userId) {
  if (!this.followers.includes(userId)) {
    this.followers.push(userId);
    this.followersCount = this.followers.length;
  }
  return this.save();
};

// Método para remover seguidor
storeSchema.methods.removeFollower = function(userId) {
  this.followers = this.followers.filter(id => !id.equals(userId));
  this.followersCount = this.followers.length;
  return this.save();
};

// Método para calcular rating promedio
storeSchema.methods.calculateAverageRating = async function() {
  const Review = mongoose.model('Review');
  const reviews = await Review.find({ 
    targetId: this._id, 
    targetType: 'store' 
  });
  
  if (reviews.length === 0) {
    this.rating = 0;
    this.totalReviews = 0;
  } else {
    const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
    this.rating = Math.round((sum / reviews.length) * 10) / 10; // Redondear a 1 decimal
    this.totalReviews = reviews.length;
  }
  
  return this.save();
};

// Asegurar que virtuals se incluyan en JSON
storeSchema.set('toJSON', { virtuals: true });
storeSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Store', storeSchema);
