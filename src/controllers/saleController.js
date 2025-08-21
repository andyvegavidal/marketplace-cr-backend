/**
 * CONTROLADOR DE VENTAS
 * 
 * Maneja todas las operaciones relacionadas con las ventas realizadas por las tiendas.
 * 
 * @controller SaleController
 * @author Marketplace CR Development Team
 * @version 1.0.0
 */

const jwt = require('jsonwebtoken');
const Sale = require('../models/Sale');
const Store = require('../models/Store');
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
 * Obtener todas las ventas de las tiendas del usuario
 * GET /api/sales/my-sales
 */
const getMySales = async (req, res) => {
  try {
    const user = await verifyToken(req);
    
    const { page = 1, limit = 10, status, storeId } = req.query;
    
    const filters = {
      seller: user._id
    };
    
    if (status) {
      filters.status = status;
    }

    if (storeId) {
      filters.store = storeId;
    }

    const sales = await Sale.find(filters)
      .populate([
        { path: 'product', select: 'name images price' },
        { path: 'store', select: 'description name' },
        { path: 'buyer', select: 'name email' },
        { path: 'order', select: 'orderNumber' }
      ])
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Sale.countDocuments(filters);

    res.json({
      success: true,
      data: {
        sales,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Error al obtener ventas:', error);
    
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
 * Obtener detalles de una venta específica
 * GET /api/sales/:id
 */
const getSaleDetails = async (req, res) => {
  try {
    const user = await verifyToken(req);
    const { id } = req.params;

    const sale = await Sale.findOne({
      _id: id,
      seller: user._id
    }).populate([
      { path: 'product', select: 'name images price description' },
      { path: 'store', select: 'description name contact' },
      { path: 'buyer', select: 'name email phone' },
      { path: 'order', select: 'orderNumber' }
    ]);

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Venta no encontrada'
      });
    }

    res.json({
      success: true,
      data: sale
    });

  } catch (error) {
    console.error('Error al obtener detalles de venta:', error);
    
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
 * Obtener estadísticas de ventas del usuario
 * GET /api/sales/stats
 */
const getSalesStats = async (req, res) => {
  try {
    const user = await verifyToken(req);

    const stats = await Sale.aggregate([
      { $match: { seller: user._id } },
      {
        $group: {
          _id: null,
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' },
          totalNetRevenue: { $sum: '$netAmount' },
          totalCommission: { $sum: '$platformCommission' },
          totalQuantity: { $sum: '$quantity' },
          avgSaleAmount: { $avg: '$totalAmount' }
        }
      }
    ]);

    const statusStats = await Sale.aggregate([
      { $match: { seller: user._id } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          revenue: { $sum: '$totalAmount' }
        }
      }
    ]);

    const monthlyStats = await Sale.aggregate([
      { $match: { seller: user._id } },
      {
        $group: {
          _id: {
            year: { $year: '$saleDate' },
            month: { $month: '$saleDate' }
          },
          count: { $sum: 1 },
          revenue: { $sum: '$totalAmount' },
          netRevenue: { $sum: '$netAmount' }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 }
    ]);

    const topProducts = await Sale.aggregate([
      { $match: { seller: user._id } },
      {
        $group: {
          _id: '$product',
          totalSold: { $sum: '$quantity' },
          revenue: { $sum: '$totalAmount' }
        }
      },
      { $sort: { totalSold: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'productInfo'
        }
      },
      { $unwind: '$productInfo' },
      {
        $project: {
          productName: '$productInfo.name',
          totalSold: 1,
          revenue: 1
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        general: stats[0] || {
          totalSales: 0,
          totalRevenue: 0,
          totalNetRevenue: 0,
          totalCommission: 0,
          totalQuantity: 0,
          avgSaleAmount: 0
        },
        byStatus: statusStats,
        monthly: monthlyStats,
        topProducts: topProducts
      }
    });

  } catch (error) {
    console.error('Error al obtener estadísticas de ventas:', error);
    
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
  getMySales,
  getSaleDetails,
  getSalesStats
};
