/**
 * RUTAS DE REPORTES - ENDPOINTS DEL SISTEMA DE MODERACIÓN
 * 
 * Define todas las rutas relacionadas con el sistema de reportes,
 * incluyendo autenticación, autorización y validación de datos.
 * 
 * Endpoints implementados:
 * - POST /api/reports - Crear reporte
 * - GET /api/reports - Listar reportes (moderadores)
 * - GET /api/reports/stats - Estadísticas (administradores)
 * - GET /api/reports/:id - Obtener reporte específico
 * - PUT /api/reports/:id/assign - Asignar moderador
 * - POST /api/reports/:id/actions - Agregar acción
 * - PUT /api/reports/:id/resolve - Resolver reporte
 * - GET /api/reports/user/:userId - Reportes de usuario
 * - DELETE /api/reports/:id - Eliminar reporte
 * 
 * @routes ReportRoutes
 * @author Marketplace CR Development Team
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');

// Middlewares temporales para desarrollo
const auth = (req, res, next) => {
  // Middleware temporal - en producción usar middleware real
  req.user = { id: '507f1f77bcf86cd799439011' };
  next();
};

const adminAuth = (req, res, next) => {
  // Middleware temporal - en producción usar middleware real
  next();
};

const {
  createReport,
  getReports,
  getReportById,
  assignModerator,
  addModeratorAction,
  resolveReport,
  getReportStats,
  getUserReports,
  deleteReport
} = require('../controllers/reportController');

// Middleware para manejar errores de validación
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Errores de validación',
      errors: errors.array()
    });
  }
  next();
};

// Middleware para verificar si el usuario puede moderar reportes
const moderatorAuth = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
      return res.status(403).json({
        success: false,
        message: 'Acceso denegado. Se requieren permisos de moderador.'
      });
    }
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error de autorización',
      error: error.message
    });
  }
};

/**
 * @route   POST /api/reports
 * @desc    Crear un nuevo reporte
 * @access  Público (sin auth temporalmente)
 */
router.post('/',
  // auth,
  [
    body('reportType')
      .isIn(['product', 'store', 'user', 'comment', 'review'])
      .withMessage('Tipo de reporte debe ser: product, store, user, comment o review'),
    body('reportedItemId')
      .isMongoId()
      .withMessage('ID del elemento reportado debe ser válido'),
    body('category')
      .isIn([
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
      ])
      .withMessage('Categoría de reporte inválida'),
    body('description')
      .isLength({ min: 10, max: 1000 })
      .withMessage('Descripción debe tener entre 10 y 1000 caracteres')
      .trim(),
    body('evidence')
      .optional()
      .isArray()
      .withMessage('Evidencia debe ser un arreglo'),
    body('evidence.*.type')
      .optional()
      .isIn(['image', 'document', 'video', 'url'])
      .withMessage('Tipo de evidencia inválido'),
    body('evidence.*.url')
      .optional()
      .isURL()
      .withMessage('URL de evidencia debe ser válida'),
    body('tags')
      .optional()
      .isArray()
      .withMessage('Tags debe ser un arreglo'),
    body('isAnonymous')
      .optional()
      .isBoolean()
      .withMessage('isAnonymous debe ser un booleano')
  ],
  handleValidationErrors,
  createReport
);

/**
 * @route   GET /api/reports
 * @desc    Obtener lista de reportes con filtros
 * @access  Público (sin auth temporalmente)
 */
router.get('/',
  // auth,
  // moderatorAuth,
  [
    query('status')
      .optional()
      .isIn(['pending', 'under_review', 'resolved', 'rejected', 'escalated'])
      .withMessage('Estado inválido'),
    query('category')
      .optional()
      .isIn([
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
      ])
      .withMessage('Categoría inválida'),
    query('reportType')
      .optional()
      .isIn(['product', 'store', 'user', 'comment', 'review'])
      .withMessage('Tipo de reporte inválido'),
    query('priority')
      .optional()
      .isIn(['low', 'medium', 'high', 'critical'])
      .withMessage('Prioridad inválida'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Página debe ser un número entero positivo'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Límite debe ser entre 1 y 100'),
    query('sortBy')
      .optional()
      .isIn(['createdAt', 'priority', 'status', 'category'])
      .withMessage('Campo de ordenamiento inválido'),
    query('sortOrder')
      .optional()
      .isIn(['asc', 'desc'])
      .withMessage('Orden debe ser asc o desc')
  ],
  handleValidationErrors,
  getReports
);

/**
 * @route   GET /api/reports/stats
 * @desc    Obtener estadísticas de reportes
 * @access  Privado (administradores)
 */
router.get('/stats',
  auth,
  adminAuth,
  [
    query('timeframe')
      .optional()
      .matches(/^\d+[dwmy]$/)
      .withMessage('Timeframe debe estar en formato: número + d/w/m/y (ej: 30d, 4w, 6m, 1y)')
  ],
  handleValidationErrors,
  getReportStats
);

/**
 * @route   GET /api/reports/user/:userId
 * @desc    Obtener reportes de un usuario específico
 * @access  Privado (el mismo usuario o moderadores)
 */
router.get('/user/:userId',
  auth,
  [
    param('userId')
      .isMongoId()
      .withMessage('ID de usuario debe ser válido'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Página debe ser un número entero positivo'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Límite debe ser entre 1 y 50')
  ],
  handleValidationErrors,
  (req, res, next) => {
    // Verificar que el usuario puede ver estos reportes
    if (req.user.id !== req.params.userId && 
        req.user.role !== 'admin' && 
        req.user.role !== 'moderator') {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para ver estos reportes'
      });
    }
    next();
  },
  getUserReports
);

/**
 * @route   GET /api/reports/:id
 * @desc    Obtener un reporte específico
 * @access  Privado (moderadores y administradores)
 */
router.get('/:id',
  auth,
  moderatorAuth,
  [
    param('id')
      .isMongoId()
      .withMessage('ID de reporte debe ser válido')
  ],
  handleValidationErrors,
  getReportById
);

/**
 * @route   PUT /api/reports/:id/assign
 * @desc    Asignar moderador a un reporte
 * @access  Privado (administradores)
 */
router.put('/:id/assign',
  auth,
  adminAuth,
  [
    param('id')
      .isMongoId()
      .withMessage('ID de reporte debe ser válido'),
    body('moderatorId')
      .isMongoId()
      .withMessage('ID de moderador debe ser válido')
  ],
  handleValidationErrors,
  assignModerator
);

/**
 * @route   POST /api/reports/:id/actions
 * @desc    Agregar acción de moderador
 * @access  Privado (moderadores y administradores)
 */
router.post('/:id/actions',
  auth,
  moderatorAuth,
  [
    param('id')
      .isMongoId()
      .withMessage('ID de reporte debe ser válido'),
    body('action')
      .isIn([
        'reviewed',
        'contacted_user',
        'warning_issued',
        'content_removed',
        'account_suspended',
        'escalated',
        'resolved',
        'rejected'
      ])
      .withMessage('Acción inválida'),
    body('description')
      .isLength({ min: 5, max: 500 })
      .withMessage('Descripción debe tener entre 5 y 500 caracteres')
      .trim()
  ],
  handleValidationErrors,
  addModeratorAction
);

/**
 * @route   PUT /api/reports/:id/resolve
 * @desc    Resolver un reporte
 * @access  Privado (moderadores y administradores)
 */
router.put('/:id/resolve',
  auth,
  moderatorAuth,
  [
    param('id')
      .isMongoId()
      .withMessage('ID de reporte debe ser válido'),
    body('outcome')
      .isIn(['valid', 'invalid', 'partially_valid', 'duplicate'])
      .withMessage('Resultado inválido'),
    body('description')
      .isLength({ min: 10, max: 500 })
      .withMessage('Descripción debe tener entre 10 y 500 caracteres')
      .trim()
  ],
  handleValidationErrors,
  resolveReport
);

/**
 * @route   DELETE /api/reports/:id
 * @desc    Eliminar un reporte
 * @access  Privado (administradores)
 */
router.delete('/:id',
  auth,
  adminAuth,
  [
    param('id')
      .isMongoId()
      .withMessage('ID de reporte debe ser válido')
  ],
  handleValidationErrors,
  deleteReport
);

module.exports = router;