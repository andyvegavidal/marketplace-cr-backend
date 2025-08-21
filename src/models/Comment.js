const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'ID de usuario es requerido']
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'ID de producto es requerido']
  },
  content: {
    type: String,
    required: [true, 'Contenido del comentario es requerido'],
    trim: true,
    maxlength: [500, 'Comentario no puede exceder 500 caracteres']
  },
  parentCommentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment',
    default: null // Para respuestas a comentarios
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  likesCount: {
    type: Number,
    default: 0
  },
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date,
    default: null
  },
  // Estado del comentario
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
commentSchema.index({ userId: 1 });
commentSchema.index({ productId: 1 });
commentSchema.index({ parentCommentId: 1 });
commentSchema.index({ createdAt: -1 });
commentSchema.index({ likesCount: -1 });
commentSchema.index({ isActive: 1 });

// Virtual para obtener información del usuario
commentSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true
});

// Virtual para obtener información del producto
commentSchema.virtual('product', {
  ref: 'Product',
  localField: 'productId',
  foreignField: '_id',
  justOne: true
});

// Virtual para obtener comentario padre
commentSchema.virtual('parentComment', {
  ref: 'Comment',
  localField: 'parentCommentId',
  foreignField: '_id',
  justOne: true
});

// Virtual para obtener respuestas
commentSchema.virtual('replies', {
  ref: 'Comment',
  localField: '_id',
  foreignField: 'parentCommentId'
});

// Método para actualizar conteo de likes
commentSchema.methods.updateLikesCount = function() {
  this.likesCount = this.likes.length;
  return this.save();
};

// Método para dar like
commentSchema.methods.addLike = function(userId) {
  if (!this.likes.includes(userId)) {
    this.likes.push(userId);
    this.likesCount = this.likes.length;
  }
  return this.save();
};

// Método para quitar like
commentSchema.methods.removeLike = function(userId) {
  this.likes = this.likes.filter(id => !id.equals(userId));
  this.likesCount = this.likes.length;
  return this.save();
};

// Método para editar comentario
commentSchema.methods.editContent = function(newContent) {
  this.content = newContent;
  this.isEdited = true;
  this.editedAt = new Date();
  return this.save();
};

// Método para verificar si es respuesta
commentSchema.methods.isReply = function() {
  return this.parentCommentId !== null;
};

// Método para verificar si el usuario puede editar
commentSchema.methods.canEdit = function(userId) {
  return this.userId.toString() === userId.toString();
};

// Método para verificar si el usuario puede eliminar
commentSchema.methods.canDelete = function(userId) {
  return this.userId.toString() === userId.toString();
};

// Método estático para obtener comentarios de un producto con respuestas
commentSchema.statics.getProductComments = async function(productId, options = {}) {
  const {
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    sortOrder = -1
  } = options;
  
  const skip = (page - 1) * limit;
  
  // Obtener comentarios principales (no respuestas)
  const comments = await this.find({
    productId,
    parentCommentId: null,
    isActive: true
  })
  .populate('user', 'username fullName photo')
  .populate({
    path: 'replies',
    match: { isActive: true },
    populate: {
      path: 'user',
      select: 'username fullName photo'
    }
  })
  .sort({ [sortBy]: sortOrder })
  .skip(skip)
  .limit(limit);
  
  const total = await this.countDocuments({
    productId,
    parentCommentId: null,
    isActive: true
  });
  
  return {
    comments,
    total,
    page,
    pages: Math.ceil(total / limit)
  };
};

// Método estático para obtener estadísticas de comentarios
commentSchema.statics.getCommentStats = async function(productId) {
  const stats = await this.aggregate([
    { $match: { productId, isActive: true } },
    {
      $group: {
        _id: null,
        totalComments: { $sum: 1 },
        totalReplies: {
          $sum: {
            $cond: [{ $ne: ['$parentCommentId', null] }, 1, 0]
          }
        },
        totalLikes: { $sum: '$likesCount' }
      }
    }
  ]);
  
  return stats[0] || {
    totalComments: 0,
    totalReplies: 0,
    totalLikes: 0
  };
};

// Middleware para limpiar respuestas cuando se elimina un comentario padre
commentSchema.pre('remove', async function(next) {
  if (!this.parentCommentId) {
    // Si es un comentario padre, eliminar todas sus respuestas
    await this.constructor.deleteMany({ parentCommentId: this._id });
  }
  next();
});

// Asegurar que virtuals se incluyan en JSON
commentSchema.set('toJSON', { virtuals: true });
commentSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Comment', commentSchema);
