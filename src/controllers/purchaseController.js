/**
 * CONTROLADOR DE COMPRAS
 * 
 * Maneja todas las operaciones relacionadas con las compras realizadas por los usuarios.
 * 
 * @controller PurchaseController
 * @author Marketplace CR Development Team
 * @version 1.0.0
 */

const jwt = require('jsonwebtoken');
const Purchase = require('../models/Purchase');
const User = require('../models/User');

// Función helper para verificar token y obtener usuario
const verifyToken = async (req) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      throw new Error('Token no proporcionado');
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user) {
      throw new Error('Usuario no encontrado');
    }
    
    return user;
  } catch (error) {
    throw new Error('Token inválido o usuario no encontrado');
  }
};

/**
 * Obtener todas las compras del usuario
 * GET /api/purchases/my-purchases
 */
const getMyPurchases = async (req, res) => {
  try {
    const user = await verifyToken(req);
    
    const { page = 1, limit = 10, status } = req.query;
    
    const filters = {
      buyer: user._id
    };
    
    if (status) {
      filters.status = status;
    }

    const purchases = await Purchase.find(filters)
      .populate([
        { path: 'product', select: 'name images price' },
        { path: 'store', select: 'description name' },
        { path: 'order', select: 'orderNumber' }
      ])
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Purchase.countDocuments(filters);

    res.json({
      success: true,
      data: {
        purchases,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Error al obtener compras:', error);
    
    if (error.message.includes('Token') || error.message.includes('Usuario')) {
      return res.status(401).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

/**
 * Obtener detalles de una compra específica
 * GET /api/purchases/:id
 */
const getPurchaseDetails = async (req, res) => {
  try {
    const user = await verifyToken(req);
    const { id } = req.params;

    const purchase = await Purchase.findOne({
      _id: id,
      buyer: user._id
    }).populate([
      { path: 'product', select: 'name images price description' },
      { path: 'store', select: 'description name contact' },
      { path: 'order', select: 'orderNumber trackingNumber' }
    ]);

    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: 'Compra no encontrada'
      });
    }

    res.json({
      success: true,
      data: purchase
    });

  } catch (error) {
    console.error('Error al obtener detalles de compra:', error);
    
    if (error.message.includes('Token') || error.message.includes('Usuario')) {
      return res.status(401).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

/**
 * Obtener estadísticas de compras del usuario
 * GET /api/purchases/stats
 */
const getPurchaseStats = async (req, res) => {
  try {
    const user = await verifyToken(req);

    const stats = await Purchase.aggregate([
      { $match: { buyer: user._id } },
      {
        $group: {
          _id: null,
          totalPurchases: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
          totalQuantity: { $sum: '$quantity' },
          avgPurchaseAmount: { $avg: '$totalAmount' }
        }
      }
    ]);

    const statusStats = await Purchase.aggregate([
      { $match: { buyer: user._id } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const monthlyStats = await Purchase.aggregate([
      { $match: { buyer: user._id } },
      {
        $group: {
          _id: {
            year: { $year: '$purchaseDate' },
            month: { $month: '$purchaseDate' }
          },
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 }
    ]);

    res.json({
      success: true,
      data: {
        general: stats[0] || {
          totalPurchases: 0,
          totalAmount: 0,
          totalQuantity: 0,
          avgPurchaseAmount: 0
        },
        byStatus: statusStats,
        monthly: monthlyStats
      }
    });

  } catch (error) {
    console.error('Error al obtener estadísticas de compras:', error);
    
    if (error.message.includes('Token') || error.message.includes('Usuario')) {
      return res.status(401).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

module.exports = {
  getMyPurchases,
  getPurchaseDetails,
  getPurchaseStats
};
