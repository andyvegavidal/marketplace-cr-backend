/**
 * MODELO DE REPORTES - SISTEMA DE MODERACIÓN DEL MARKETPLACE
 * 
 * Esquema de base de datos para el sistema de reportes que permite a los usuarios
 * reportar productos, tiendas, comentarios o usuarios inapropiados.
 * 
 * Características implementadas:
 * - Sistema de categorización de reportes
 * - Estados de procesamiento (pendiente, en revisión, resuelto, rechazado)
 * - Evidencia multimedia (capturas de pantalla, etc.)
 * - Sistema de prioridades
 * - Auditoría temporal completa
 * - Referencias a diferentes tipos de contenido reportable
 * 
 * @model Report
 * @author Marketplace CR Development Team
 * @version 1.0.0
 */

const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

/**
 * Esquema principal de reportes con validaciones empresariales.
 */
const reportSchema = new mongoose.Schema({
  // Usuario que hace el reporte
  reporterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'ID del usuario reportador es requerido']
  },

  // Tipo de contenido reportado
  reportType: {
    type: String,
    required: [true, 'Tipo de reporte es requerido'],
    enum: {
      values: ['product', 'store', 'user', 'comment', 'review'],
      message: 'Tipo de reporte debe ser: product, store, user, comment o review'
    }
  },

  // ID del contenido reportado (flexible según el tipo)
  reportedItemId: {
    type: mongoose.Schema.Types.ObjectId,
    required: [true, 'ID del elemento reportado es requerido'],
    refPath: 'reportTypeModel'
  },

  // Modelo de referencia dinámico
  reportTypeModel: {
    type: String,
    required: true,
    enum: ['Product', 'Store', 'User', 'Comment', 'Review']
  },

  // Categoría específica del reporte
  category: {
    type: String,
    required: [true, 'Categoría del reporte es requerida'],
    enum: {
      values: [
        'inappropriate_content',
        'spam',
        'fake_product',
        'copyright_violation',
        'harassment',
        'scam',
        'violence',
        'hate_speech',
        'adult_content',
        'misleading_information',
        'other'
      ],
      message: 'Categoría de reporte inválida'
    }
  },

  // Descripción detallada del reporte
  description: {
    type: String,
    required: [true, 'Descripción del reporte es requerida'],
    trim: true,
    minlength: [10, 'Descripción debe tener al menos 10 caracteres'],
    maxlength: [1000, 'Descripción no puede exceder 1000 caracteres']
  },

  // Evidencia adjunta (URLs de imágenes, documentos, etc.)
  evidence: [{
    type: {
      type: String,
      enum: ['image', 'document', 'video', 'url'],
      required: true
    },
    url: {
      type: String,
      required: true
    },
    description: {
      type: String,
      maxlength: [200, 'Descripción de evidencia no puede exceder 200 caracteres']
    }
  }],

  // Estado del reporte
  status: {
    type: String,
    default: 'pending',
    enum: {
      values: ['pending', 'under_review', 'resolved', 'rejected', 'escalated'],
      message: 'Estado debe ser: pending, under_review, resolved, rejected o escalated'
    }
  },

  // Prioridad del reporte
  priority: {
    type: String,
    default: 'medium',
    enum: {
      values: ['low', 'medium', 'high', 'critical'],
      message: 'Prioridad debe ser: low, medium, high o critical'
    }
  },

  // Moderador asignado
  assignedModerator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  // Acciones tomadas por el moderador
  moderatorActions: [{
    action: {
      type: String,
      required: true,
      enum: ['reviewed', 'contacted_user', 'warning_issued', 'content_removed', 'account_suspended', 'escalated', 'resolved', 'rejected']
    },
    description: {
      type: String,
      required: true,
      maxlength: [500, 'Descripción de acción no puede exceder 500 caracteres']
    },
    moderatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],

  // Resolución del reporte
  resolution: {
    outcome: {
      type: String,
      enum: ['valid', 'invalid', 'partially_valid', 'duplicate'],
      default: null
    },
    description: {
      type: String,
      maxlength: [500, 'Descripción de resolución no puede exceder 500 caracteres']
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    resolvedAt: {
      type: Date,
      default: null
    }
  },

  // Información adicional del reportador
  reporterInfo: {
    userAgent: String,
    ipAddress: String,
    location: {
      country: String,
      region: String,
      city: String
    }
  },

  // Tags para categorización adicional
  tags: [{
    type: String,
    trim: true,
    maxlength: [50, 'Tag no puede exceder 50 caracteres']
  }],

  // Indica si es un reporte anónimo
  isAnonymous: {
    type: Boolean,
    default: false
  },

  // Número de reportes similares (para detectar patrones)
  relatedReports: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Report'
  }],

  // Metadatos del sistema
  systemMetadata: {
    autoFlagged: {
      type: Boolean,
      default: false
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: null
    },
    source: {
      type: String,
      enum: ['user_report', 'automated_detection', 'moderator_review'],
      default: 'user_report'
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices para optimización de consultas
reportSchema.index({ reporterId: 1, createdAt: -1 });
reportSchema.index({ reportType: 1, reportedItemId: 1 });
reportSchema.index({ status: 1, priority: -1, createdAt: -1 });
reportSchema.index({ assignedModerator: 1, status: 1 });
reportSchema.index({ category: 1, status: 1 });

// Plugin de paginación
reportSchema.plugin(mongoosePaginate);

// Virtual para obtener el tiempo transcurrido desde el reporte
reportSchema.virtual('timeElapsed').get(function() {
  return Date.now() - this.createdAt;
});

// Virtual para verificar si el reporte está vencido (más de 7 días pendiente)
reportSchema.virtual('isOverdue').get(function() {
  const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
  return this.status === 'pending' && this.timeElapsed > sevenDaysInMs;
});

// Middleware pre-save para auto-asignar prioridad basada en categoría
reportSchema.pre('save', function(next) {
  const highPriorityCategories = ['violence', 'hate_speech', 'harassment', 'scam'];
  const mediumPriorityCategories = ['inappropriate_content', 'fake_product', 'copyright_violation'];
  
  if (this.isNew && !this.priority) {
    if (highPriorityCategories.includes(this.category)) {
      this.priority = 'high';
    } else if (mediumPriorityCategories.includes(this.category)) {
      this.priority = 'medium';
    } else {
      this.priority = 'low';
    }
  }
  next();
});

// Método estático para obtener estadísticas de reportes
reportSchema.statics.getReportStats = async function(timeframe = '30d') {
  const days = parseInt(timeframe);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return await this.aggregate([
    { $match: { createdAt: { $gte: startDate } } },
    {
      $group: {
        _id: {
          status: '$status',
          category: '$category'
        },
        count: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: '$_id.status',
        categories: {
          $push: {
            category: '$_id.category',
            count: '$count'
          }
        },
        total: { $sum: '$count' }
      }
    }
  ]);
};

// Método de instancia para agregar acción de moderador
reportSchema.methods.addModeratorAction = function(action, description, moderatorId) {
  this.moderatorActions.push({
    action,
    description,
    moderatorId,
    timestamp: new Date()
  });
  
  // Actualizar estado si es necesario
  if (action === 'resolved') {
    this.status = 'resolved';
    this.resolution.resolvedBy = moderatorId;
    this.resolution.resolvedAt = new Date();
  } else if (action === 'rejected') {
    this.status = 'rejected';
    this.resolution.resolvedBy = moderatorId;
    this.resolution.resolvedAt = new Date();
  } else if (action === 'escalated') {
    this.status = 'escalated';
    this.priority = this.priority === 'critical' ? 'critical' : 'high';
  }
  
  return this.save();
};

module.exports = mongoose.model('Report', reportSchema);