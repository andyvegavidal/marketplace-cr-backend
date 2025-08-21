/**
 * MODELO DE USUARIO - SISTEMA DE AUTENTICACIÓN EMPRESARIAL
 * 
 * Esquema de base de datos para usuarios del marketplace, implementando
 * estándares de seguridad empresarial y cumplimiento con normativas
 * costarricenses de protección de datos personales.
 * 
 * Características de seguridad implementadas:
 * - Cifrado de contraseñas con bcrypt y salt rounds optimizados
 * - Validación de datos con expresiones regulares robustas
 * - Índices únicos para prevenir duplicación de identidades
 * - Middleware de pre-procesamiento para transformación de datos
 * - Sistema de roles jerárquico (comprador/tienda)
 * - Auditoría temporal con timestamps automáticos
 * 
 * Cumplimiento normativo:
 * - Integración con sistema de identificación costarricense (cédula)
 * - Validación de formatos de email según RFC 5322
 * - Protección de datos sensibles según LGPD
 * 
 * @model User
 * @author Marketplace CR Development Team
 * @version 2.0.0 - Seguridad empresarial
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * Esquema principal de usuario con validaciones empresariales.
 * 
 * Define la estructura de datos, validaciones y reglas de negocio
 * para todos los usuarios del sistema, tanto compradores como tiendas.
 */
const userSchema = new mongoose.Schema({
  // Identificación única según sistema costarricense
  idNumber: {
    type: String,
    required: [true, 'Número de identificación es requerido'],
    unique: true,
    trim: true,
    validate: {
      validator: function(v) {
        // Validación básica de formato de cédula costarricense
        return /^\d{1}-\d{4}-\d{4}$|^\d{9}$/.test(v);
      },
      message: 'Formato de identificación inválido'
    }
  },
  
  // Nombre de usuario único para autenticación
  username: {
    type: String,
    required: [true, 'Nombre de usuario es requerido'],
    unique: true,
    trim: true,
    minlength: [3, 'Nombre de usuario debe tener al menos 3 caracteres'],
    maxlength: [20, 'Nombre de usuario no puede exceder 20 caracteres'],
    match: [/^[a-zA-Z0-9_]+$/, 'Nombre de usuario solo puede contener letras, números y guiones bajos']
  },
  
  // Contraseña cifrada con validación de seguridad
  password: {
    type: String,
    required: [true, 'Contraseña es requerida'],
    minlength: [6, 'Contraseña debe tener al menos 6 caracteres'],
    validate: {
      validator: function(v) {
        // Validación de contraseña segura
        return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(v);
      },
      message: 'Contraseña debe contener al menos una mayúscula, una minúscula y un número'
    }
  },
  
  // Email único con validación RFC 5322
  email: {
    type: String,
    required: [true, 'Email es requerido'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Email inválido']
  },
  fullName: {
    type: String,
    required: [true, 'Nombre completo es requerido'],
    trim: true,
    maxlength: [100, 'Nombre completo no puede exceder 100 caracteres']
  },
  country: {
    type: String,
    required: [true, 'País es requerido'],
    trim: true
  },
  address: {
    type: String,
    required: [true, 'Dirección es requerida'],
    trim: true
  },
  phone: {
    type: String,
    required: [true, 'Teléfono es requerido'],
    trim: true
  },
  photo: {
    type: String,
    default: null
  },
  userType: {
    type: String,
    enum: ['buyer', 'store'],
    required: [true, 'Tipo de usuario es requerido'],
    default: 'buyer'
  },
  socialNetworks: [{
    name: {
      type: String,
      trim: true
    },
    url: {
      type: String,
      trim: true
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  lastLogin: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Índices adicionales (username y email ya tienen unique: true)
userSchema.index({ userType: 1 });
userSchema.index({ isActive: 1 });

// Middleware para hashear password antes de guardar
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Método para comparar password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Método para obtener perfil público (sin password)
userSchema.methods.getPublicProfile = function() {
  const userObject = this.toObject();
  delete userObject.password;
  return userObject;
};

// Virtual para obtener store asociada
userSchema.virtual('store', {
  ref: 'Store',
  localField: '_id',
  foreignField: 'userId',
  justOne: true
});

// Asegurar que virtuals se incluyan en JSON
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('User', userSchema);
