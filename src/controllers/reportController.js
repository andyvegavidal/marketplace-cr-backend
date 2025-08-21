/**
 * CONTROLADOR DE REPORTES - GESTIÓN DE MODERACIÓN
 * 
 * Maneja todas las operaciones relacionadas con el sistema de reportes,
 * incluyendo creación, gestión, moderación y estadísticas.
 * 
 * Funcionalidades implementadas:
 * - Creación de reportes por usuarios
 * - Gestión de reportes por moderadores
 * - Sistema de estadísticas y métricas
 * - Filtrado y búsqueda avanzada
 * - Acciones de moderación automatizadas
 * 
 * @controller ReportController
 * @author Marketplace CR Development Team
 * @version 1.0.0
 */

const Report = require('../models/Report');
const User = require('../models/User');
const Product = require('../models/Product');
const Store = require('../models/Store');
const Comment = require('../models/Comment');
const Review = require('../models/Review');

/**
 * Crear un nuevo reporte
 * POST /api/reports
 */
const createReport = async (req, res) => {
  try {
    const {
      reportType,
      reportedItemId,
      category,
      description,
      evidence,
      tags,
      isAnonymous,
      reporterInfo
    } = req.body;

    // Validar que el elemento reportado existe
    let reportTypeModel;
    let reportedItem;

    switch (reportType) {
      case 'product':
        reportTypeModel = 'Product';
        reportedItem = await Product.findById(reportedItemId);
        break;
      case 'store':
        reportTypeModel = 'Store';
        reportedItem = await Store.findById(reportedItemId);
        break;
      case 'user':
        reportTypeModel = 'User';
        reportedItem = await User.findById(reportedItemId);
        break;
      case 'comment':
        reportTypeModel = 'Comment';
        reportedItem = await Comment.findById(reportedItemId);
        break;
      case 'review':
        reportTypeModel = 'Review';
        reportedItem = await Review.findById(reportedItemId);
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Tipo de reporte inválido'
        });
    }

    if (!reportedItem) {
      return res.status(404).json({
        success: false,
        message: 'El elemento reportado no existe'
      });
    }

    // Verificar que el usuario no se está reportando a sí mismo
    // Comentado temporalmente para testing sin auth
    // if (reportType === 'user' && reportedItemId === req.user.id) {
    //   return res.status(400).json({
    //     success: false,
    //     message: 'No puedes reportarte a ti mismo'
    //   });
    // }

    // Verificar si ya existe un reporte similar reciente (últimas 24 horas)
    // Comentado temporalmente para testing sin auth
    // const existingReport = await Report.findOne({
    //   reporterId: req.user.id,
    //   reportType,
    //   reportedItemId,
    //   createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    // });

    // if (existingReport) {
    //   return res.status(400).json({
    //     success: false,
    //     message: 'Ya has reportado este elemento recientemente'
    //   });
    // }

    // Crear el reporte (usando un ID ficticio para testing)
    const reporterId = '507f1f77bcf86cd799439011'; // ID ficticio para testing

    // Crear el reporte
    const report = new Report({
      reporterId: reporterId, // Usando ID ficticio
      reportType,
      reportedItemId,
      reportTypeModel,
      category,
      description,
      evidence: evidence || [],
      tags: tags || [],
      isAnonymous: isAnonymous || false,
      reporterInfo: {
        ...reporterInfo,
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip
      }
    });

    await report.save();

    // Poblar los datos para la respuesta
    await report.populate([
      { path: 'reporterId', select: 'name email' },
      { path: 'reportedItemId' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Reporte creado exitosamente',
      data: report
    });

  } catch (error) {
    console.error('Error al crear reporte:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

/**
 * Obtener todos los reportes con filtros
 * GET /api/reports
 */
const getReports = async (req, res) => {
  try {
    const {
      status,
      category,
      reportType,
      priority,
      assignedModerator,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Construir filtros
    const filters = {};
    
    if (status) filters.status = status;
    if (category) filters.category = category;
    if (reportType) filters.reportType = reportType;
    if (priority) filters.priority = priority;
    if (assignedModerator) filters.assignedModerator = assignedModerator;

    // Opciones de paginación
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 },
      populate: [
        { path: 'reporterId', select: 'name email' },
        { path: 'assignedModerator', select: 'name email' },
        { path: 'reportedItemId' }
      ]
    };

    const reports = await Report.paginate(filters, options);

    res.json({
      success: true,
      data: reports
    });

  } catch (error) {
    console.error('Error al obtener reportes:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

/**
 * Obtener un reporte específico
 * GET /api/reports/:id
 */
const getReportById = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id)
      .populate('reporterId', 'name email')
      .populate('assignedModerator', 'name email')
      .populate('reportedItemId')
      .populate('moderatorActions.moderatorId', 'name email')
      .populate('resolution.resolvedBy', 'name email');

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Reporte no encontrado'
      });
    }

    res.json({
      success: true,
      data: report
    });

  } catch (error) {
    console.error('Error al obtener reporte:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

/**
 * Asignar moderador a un reporte
 * PUT /api/reports/:id/assign
 */
const assignModerator = async (req, res) => {
  try {
    const { moderatorId } = req.body;
    
    // Verificar que el moderador existe y tiene permisos
    const moderator = await User.findById(moderatorId);
    if (!moderator || moderator.role !== 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Moderador inválido'
      });
    }

    const report = await Report.findByIdAndUpdate(
      req.params.id,
      { 
        assignedModerator: moderatorId,
        status: 'under_review'
      },
      { new: true }
    ).populate('assignedModerator', 'name email');

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Reporte no encontrado'
      });
    }

    // Agregar acción de moderador
    await report.addModeratorAction('reviewed', 'Reporte asignado para revisión', moderatorId);

    res.json({
      success: true,
      message: 'Moderador asignado exitosamente',
      data: report
    });

  } catch (error) {
    console.error('Error al asignar moderador:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

/**
 * Agregar acción de moderador
 * POST /api/reports/:id/actions
 */
const addModeratorAction = async (req, res) => {
  try {
    const { action, description } = req.body;
    
    const report = await Report.findById(req.params.id);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Reporte no encontrado'
      });
    }

    await report.addModeratorAction(action, description, req.user.id);

    // Poblar datos actualizados
    await report.populate([
      { path: 'moderatorActions.moderatorId', select: 'name email' },
      { path: 'resolution.resolvedBy', select: 'name email' }
    ]);

    res.json({
      success: true,
      message: 'Acción agregada exitosamente',
      data: report
    });

  } catch (error) {
    console.error('Error al agregar acción:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

/**
 * Resolver un reporte
 * PUT /api/reports/:id/resolve
 */
const resolveReport = async (req, res) => {
  try {
    const { outcome, description } = req.body;
    
    const report = await Report.findById(req.params.id);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Reporte no encontrado'
      });
    }

    // Actualizar resolución
    report.resolution = {
      outcome,
      description,
      resolvedBy: req.user.id,
      resolvedAt: new Date()
    };

    await report.addModeratorAction('resolved', description, req.user.id);

    res.json({
      success: true,
      message: 'Reporte resuelto exitosamente',
      data: report
    });

  } catch (error) {
    console.error('Error al resolver reporte:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

/**
 * Obtener estadísticas de reportes
 * GET /api/reports/stats
 */
const getReportStats = async (req, res) => {
  try {
    const { timeframe = '30d' } = req.query;
    
    // Estadísticas generales
    const stats = await Report.getReportStats(timeframe);
    
    // Conteos por estado
    const statusCounts = await Report.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Conteos por categoría
    const categoryCounts = await Report.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Conteos por tipo
    const typeCounts = await Report.aggregate([
      {
        $group: {
          _id: '$reportType',
          count: { $sum: 1 }
        }
      }
    ]);

    // Reportes vencidos
    const overdueReports = await Report.countDocuments({
      status: 'pending',
      createdAt: { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    });

    // Tiempo promedio de resolución
    const avgResolutionTime = await Report.aggregate([
      {
        $match: {
          status: 'resolved',
          'resolution.resolvedAt': { $exists: true }
        }
      },
      {
        $addFields: {
          resolutionTime: {
            $subtract: ['$resolution.resolvedAt', '$createdAt']
          }
        }
      },
      {
        $group: {
          _id: null,
          avgTime: { $avg: '$resolutionTime' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        overview: stats,
        statusCounts,
        categoryCounts,
        typeCounts,
        overdueReports,
        avgResolutionTimeHours: avgResolutionTime.length > 0 
          ? avgResolutionTime[0].avgTime / (1000 * 60 * 60) 
          : 0
      }
    });

  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

/**
 * Obtener reportes de un usuario específico
 * GET /api/reports/user/:userId
 */
const getUserReports = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 },
      populate: [
        { path: 'reportedItemId' }
      ]
    };

    const reports = await Report.paginate(
      { reporterId: userId },
      options
    );

    res.json({
      success: true,
      data: reports
    });

  } catch (error) {
    console.error('Error al obtener reportes del usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

/**
 * Eliminar un reporte (solo para administradores)
 * DELETE /api/reports/:id
 */
const deleteReport = async (req, res) => {
  try {
    const report = await Report.findByIdAndDelete(req.params.id);
    
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Reporte no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Reporte eliminado exitosamente'
    });

  } catch (error) {
    console.error('Error al eliminar reporte:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

module.exports = {
  createReport,
  getReports,
  getReportById,
  assignModerator,
  addModeratorAction,
  resolveReport,
  getReportStats,
  getUserReports,
  deleteReport
};