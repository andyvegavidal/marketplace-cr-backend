const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Import models
const Order = require('../models/Order');
const Product = require('../models/Product');
const Store = require('../models/Store');
const User = require('../models/User');

console.log('🔧 CARGANDO analyticsRoutes.js');

// Test endpoint
router.get('/test', (req, res) => {
  console.log('🔧 ENDPOINT DE PRUEBA /analytics/test FUNCIONANDO');
  res.json({ 
    success: true, 
    message: 'Analytics routes funcionando correctamente',
    timestamp: new Date().toISOString()
  });
});

// Purchase History for Buyers - SOLO DATOS REALES
router.get('/buyer/purchase-history', async (req, res) => {
  try {
    console.log('🔧 ENDPOINT /analytics/buyer/purchase-history - DATOS REALES');
    
    const { 
      userId = '68a57c9ca4fac74da98768e6', // Usuario de prueba por defecto
      page = 1, 
      limit = 10, 
      startDate = null, 
      endDate = null, 
      category = null, 
      storeId = null 
    } = req.query;

    // Build date filter
    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate + 'T23:59:59.999Z');

    // Build match stage for aggregation
    const matchStage = {
      buyer: new mongoose.Types.ObjectId(userId),
      status: { $in: ['confirmed', 'completed', 'delivered'] }
    };

    if (Object.keys(dateFilter).length > 0) {
      matchStage.createdAt = dateFilter;
    }

    // Get statistics
    const statsResult = await Order.aggregate([
      { $match: matchStage },
      { $unwind: '$items' },
      {
        $group: {
          _id: null,
          totalSpent: { $sum: '$items.total' },
          totalOrders: { $addToSet: '$_id' },
          totalItems: { $sum: '$items.quantity' }
        }
      },
      {
        $addFields: {
          totalOrders: { $size: '$totalOrders' },
          averageOrderValue: { 
            $cond: {
              if: { $gt: [{ $size: '$totalOrders' }, 0] },
              then: { $divide: ['$totalSpent', { $size: '$totalOrders' }] },
              else: 0
            }
          }
        }
      }
    ]);

    const stats = statsResult[0] || {
      totalSpent: 0,
      totalOrders: 0,
      totalItems: 0,
      averageOrderValue: 0
    };

    // Get monthly trends
    const monthlyStats = await Order.aggregate([
      { $match: matchStage },
      { $unwind: '$items' },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          total: { $sum: '$items.total' },
          orders: { $addToSet: '$_id' }
        }
      },
      {
        $addFields: {
          month: {
            $concat: [
              { $toString: '$_id.year' },
              '-',
              { $toString: { $add: [100, '$_id.month'] } } // Para formato 01, 02, etc.
            ]
          },
          orders: { $size: '$orders' }
        }
      },
      { $project: { _id: 0, month: { $substr: ['$month', 0, 7] }, total: 1, orders: 1 } },
      { $sort: { month: 1 } }
    ]);

    // Get category breakdown
    const categoryStats = await Order.aggregate([
      { $match: matchStage },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'products',
          localField: 'items.product',
          foreignField: '_id',
          as: 'productInfo'
        }
      },
      { $unwind: '$productInfo' },
      {
        $group: {
          _id: '$productInfo.category',
          total: { $sum: '$items.total' },
          items: { $sum: '$items.quantity' }
        }
      },
      {
        $project: {
          _id: 0,
          category: '$_id',
          total: 1,
          items: 1
        }
      },
      { $sort: { total: -1 } }
    ]);

    // Get paginated order history
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const orders = await Order.aggregate([
      { $match: matchStage },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'products',
          localField: 'items.product',
          foreignField: '_id',
          as: 'productInfo'
        }
      },
      {
        $lookup: {
          from: 'stores',
          localField: 'items.store',
          foreignField: '_id',
          as: 'storeInfo'
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'storeInfo.userId',
          foreignField: '_id',
          as: 'storeUserInfo'
        }
      },
      {
        $project: {
          orderNumber: 1,
          orderDate: '$createdAt',
          status: 1,
          total: '$items.total',
          paymentMethod: 1,
          paymentStatus: 1,
          item: {
            product: '$items.product',
            quantity: '$items.quantity',
            price: '$items.price',
            total: '$items.total'
          },
          product: {
            name: { $arrayElemAt: ['$productInfo.name', 0] },
            category: { $arrayElemAt: ['$productInfo.category', 0] },
            images: { $arrayElemAt: ['$productInfo.images', 0] }
          },
          store: {
            name: { $arrayElemAt: ['$storeUserInfo.fullName', 0] },
            _id: { $arrayElemAt: ['$storeInfo._id', 0] }
          }
        }
      },
      { $sort: { orderDate: -1 } },
      { $skip: skip },
      { $limit: parseInt(limit) }
    ]);

    // Get total count for pagination
    const totalItemsResult = await Order.aggregate([
      { $match: matchStage },
      { $unwind: '$items' },
      { $count: 'total' }
    ]);
    
    const totalItems = totalItemsResult[0]?.total || 0;
    const totalPages = Math.ceil(totalItems / parseInt(limit));

    console.log('✅ Datos reales obtenidos de la base de datos');
    console.log(`📊 Stats: ${stats.totalOrders} órdenes, ₡${stats.totalSpent.toLocaleString()}`);
    
    return res.json({
      success: true,
      data: {
        statistics: {
          ...stats,
          monthlySpending: monthlyStats,
          topCategories: categoryStats
        },
        history: orders,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems,
          itemsPerPage: parseInt(limit),
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        }
      }
    });

  } catch (error) {
    console.error('❌ Error en purchase-history:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

console.log('🔧 EXPORTANDO ANALYTICS ROUTER');
module.exports = router;
