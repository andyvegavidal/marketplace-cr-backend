const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'ID de usuario es requerido']
  },
  type: {
    type: String,
    enum: ['order', 'review', 'follow', 'product', 'store', 'system', 'comment'],
    required: [true, 'Tipo de notificación es requerido']
  },
  title: {
    type: String,
    required: [true, 'Título es requerido'],
    trim: true,
    maxlength: [100, 'Título no puede exceder 100 caracteres']
  },
  message: {
    type: String,
    required: [true, 'Mensaje es requerido'],
    trim: true,
    maxlength: [300, 'Mensaje no puede exceder 300 caracteres']
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {} // Datos adicionales específicos del tipo
  },
  read: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date,
    default: null
  },
  // Información adicional
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  actionUrl: {
    type: String,
    trim: true // URL a la que debe dirigir la notificación
  },
  expiresAt: {
    type: Date,
    default: null // Para notificaciones temporales
  },
  // Referencias opcionales
  relatedId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null // ID del objeto relacionado (producto, orden, etc.)
  },
  relatedType: {
    type: String,
    enum: ['Product', 'Order', 'Store', 'User', 'Review', 'Comment'],
    default: null
  }
}, {
  timestamps: true
});

// Índices
notificationSchema.index({ userId: 1 });
notificationSchema.index({ read: 1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ priority: 1 });
notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ expiresAt: 1 });
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 }); // Índice compuesto

// Virtual para obtener información del usuario
notificationSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true
});

// Virtual para obtener objeto relacionado
notificationSchema.virtual('related', {
  refPath: 'relatedType',
  localField: 'relatedId',
  foreignField: '_id',
  justOne: true
});

// Método para marcar como leída
notificationSchema.methods.markAsRead = function() {
  if (!this.read) {
    this.read = true;
    this.readAt = new Date();
    return this.save();
  }
  return Promise.resolve(this);
};

// Método para marcar como no leída
notificationSchema.methods.markAsUnread = function() {
  if (this.read) {
    this.read = false;
    this.readAt = null;
    return this.save();
  }
  return Promise.resolve(this);
};

// Método para verificar si está expirada
notificationSchema.methods.isExpired = function() {
  return this.expiresAt && this.expiresAt < new Date();
};

// Método estático para crear notificación
notificationSchema.statics.createNotification = async function(data) {
  const notification = new this(data);
  await notification.save();
  
  // Emitir notificación en tiempo real via Socket.io
  if (global.io) {
    global.io.to(`user_${data.userId}`).emit('new-notification', notification);
  }
  
  return notification;
};

// Método estático para marcar todas como leídas
notificationSchema.statics.markAllAsRead = async function(userId) {
  const result = await this.updateMany(
    { userId, read: false },
    { 
      read: true, 
      readAt: new Date() 
    }
  );
  
  return result;
};

// Método estático para obtener notificaciones del usuario
notificationSchema.statics.getUserNotifications = async function(userId, options = {}) {
  const {
    page = 1,
    limit = 20,
    unreadOnly = false,
    type = null
  } = options;
  
  const skip = (page - 1) * limit;
  
  const filter = { 
    userId,
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } }
    ]
  };
  
  if (unreadOnly) {
    filter.read = false;
  }
  
  if (type) {
    filter.type = type;
  }
  
  const notifications = await this.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('related');
  
  const total = await this.countDocuments(filter);
  const unreadCount = await this.countDocuments({ 
    userId, 
    read: false,
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } }
    ]
  });
  
  return {
    notifications,
    total,
    unreadCount,
    page,
    pages: Math.ceil(total / limit)
  };
};

// Método estático para limpiar notificaciones expiradas
notificationSchema.statics.cleanExpired = async function() {
  const result = await this.deleteMany({
    expiresAt: { $lt: new Date() }
  });
  
  return result;
};

// Método estático para obtener estadísticas
notificationSchema.statics.getStats = async function(userId) {
  const stats = await this.aggregate([
    { 
      $match: { 
        userId,
        $or: [
          { expiresAt: null },
          { expiresAt: { $gt: new Date() } }
        ]
      }
    },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        unreadCount: {
          $sum: { $cond: [{ $eq: ['$read', false] }, 1, 0] }
        }
      }
    }
  ]);
  
  const totalUnread = await this.countDocuments({
    userId,
    read: false,
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } }
    ]
  });
  
  return {
    byType: stats,
    totalUnread
  };
};

// Middleware para eliminar notificaciones expiradas antes de consultar
notificationSchema.pre(/^find/, function(next) {
  this.where({
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } }
    ]
  });
  next();
});

// Asegurar que virtuals se incluyan en JSON
notificationSchema.set('toJSON', { virtuals: true });
notificationSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Notification', notificationSchema);
