const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'ID de usuario es requerido']
  },
  targetType: {
    type: String,
    enum: ['product', 'store'],
    required: [true, 'Tipo de objetivo es requerido']
  },
  targetId: {
    type: mongoose.Schema.Types.Mixed, // Allow both ObjectId and String
    required: [true, 'ID del objetivo es requerido']
  },
  targetModel: {
    type: String,
    enum: ['Product', 'Store'],
    required: true
  },
  rating: {
    type: Number,
    required: [true, 'Calificación es requerida'],
    min: [1, 'Calificación mínima es 1'],
    max: [5, 'Calificación máxima es 5']
  },
  title: {
    type: String,
    required: [true, 'Título es requerido'],
    trim: true,
    maxlength: [100, 'Título no puede exceder 100 caracteres']
  },
  comment: {
    type: String,
    required: [true, 'Comentario es requerido'],
    trim: true,
    maxlength: [1000, 'Comentario no puede exceder 1000 caracteres']
  },
  helpful: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  helpfulCount: {
    type: Number,
    default: 0
  },
  verified: {
    type: Boolean,
    default: false // Se marca como true si el usuario compró el producto
  },
  // Información adicional
  pros: [{
    type: String,
    trim: true
  }],
  cons: [{
    type: String,
    trim: true
  }],
  // Estado de la reseña
  isActive: {
    type: Boolean,
    default: true
  },
  moderationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'approved'
  },
  moderationReason: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Índices
reviewSchema.index({ userId: 1 });
reviewSchema.index({ targetType: 1, targetId: 1 });
reviewSchema.index({ rating: 1 });
reviewSchema.index({ verified: 1 });
reviewSchema.index({ createdAt: -1 });
reviewSchema.index({ helpfulCount: -1 });
reviewSchema.index({ moderationStatus: 1 });

// Índice compuesto para evitar reseñas duplicadas
reviewSchema.index({ userId: 1, targetType: 1, targetId: 1 }, { unique: true });

// Virtual para obtener información del usuario
reviewSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true
});

// Virtual para obtener información del objetivo
reviewSchema.virtual('target', {
  refPath: 'targetModel',
  localField: 'targetId',
  foreignField: '_id',
  justOne: true
});

// Middleware para establecer targetModel basado en targetType
reviewSchema.pre('save', function(next) {
  if (this.targetType === 'product') {
    this.targetModel = 'Product';
  } else if (this.targetType === 'store') {
    this.targetModel = 'Store';
  }
  next();
});

// Middleware para actualizar contadores después de guardar
reviewSchema.post('save', async function() {
  await this.updateTargetRating();
});

// Middleware para actualizar contadores después de eliminar
reviewSchema.post('remove', async function() {
  await this.updateTargetRating();
});

// Método para actualizar helpful count
reviewSchema.methods.updateHelpfulCount = function() {
  this.helpfulCount = this.helpful.length;
  return this.save();
};

// Método para marcar como útil
reviewSchema.methods.markAsHelpful = function(userId) {
  if (!this.helpful.includes(userId)) {
    this.helpful.push(userId);
    this.helpfulCount = this.helpful.length;
  }
  return this.save();
};

// Método para desmarcar como útil
reviewSchema.methods.unmarkAsHelpful = function(userId) {
  this.helpful = this.helpful.filter(id => !id.equals(userId));
  this.helpfulCount = this.helpful.length;
  return this.save();
};

// Método para actualizar rating del objetivo
reviewSchema.methods.updateTargetRating = async function() {
  try {
    if (this.targetType === 'product') {
      const Product = mongoose.model('Product');
      const product = await Product.findById(this.targetId);
      if (product && typeof product.calculateAverageRating === 'function') {
        await product.calculateAverageRating();
      }
    } else if (this.targetType === 'store') {
      const Store = mongoose.model('Store');
      const store = await Store.findById(this.targetId);
      if (store && typeof store.calculateAverageRating === 'function') {
        await store.calculateAverageRating();
      }
    }
  } catch (error) {
    // Don't throw error, just log it
  }
};

// Método estático para verificar si un usuario puede hacer review
reviewSchema.statics.canUserReview = async function(userId, targetType, targetId) {
  try {
    // Verificar si ya existe una reseña
    const existingReview = await this.findOne({
      userId,
      targetType,
      targetId
    });
    
    if (existingReview) {
      return { canReview: false, reason: 'Ya has hecho una reseña' };
    }
    
    // Para simplificar, permitir reviews sin verificar compras
    // En el futuro se puede agregar verificación de órdenes
    return { canReview: true };
  } catch (error) {
    return { canReview: false, reason: 'Error verificando permisos' };
  }
};

// Método estático para obtener estadísticas de reseñas
reviewSchema.statics.getReviewStats = async function(targetType, targetId) {
  try {
    // Convert targetId to ObjectId if it's a string
    const mongoose = require('mongoose');
    const objectId = mongoose.Types.ObjectId.isValid(targetId) 
      ? new mongoose.Types.ObjectId(targetId) 
      : targetId;

    const stats = await this.aggregate([
      { 
        $match: { 
          targetType, 
          targetId: objectId, 
          isActive: true 
        } 
      },
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const totalReviews = stats.reduce((sum, stat) => sum + stat.count, 0);
    const averageRating = totalReviews > 0 
      ? stats.reduce((sum, stat) => sum + (stat._id * stat.count), 0) / totalReviews 
      : 0;
    
    const distribution = {};
    for (let i = 1; i <= 5; i++) {
      const found = stats.find(stat => stat._id === i);
      distribution[i] = found ? found.count : 0;
    }
    
    return {
      totalReviews,
      averageRating: Math.round(averageRating * 10) / 10,
      distribution
    };
  } catch (error) {
    return {
      totalReviews: 0,
      averageRating: 0,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    };
  }
};

// Asegurar que virtuals se incluyan en JSON
reviewSchema.set('toJSON', { virtuals: true });
reviewSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Review', reviewSchema);
