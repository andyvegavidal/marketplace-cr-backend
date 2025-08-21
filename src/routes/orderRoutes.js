/**
 * RUTAS DE ÓRDENES
 * 
 * Define todas las rutas relacionadas con la gestión de órdenes,
 * incluyendo creación, consulta y actualización de estados.
 * 
 * @routes OrderRoutes
 * @author Marketplace CR Development Team
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();
const {
  createOrder,
  getMyOrders,
  getStoreOrders,
  getOrderById,
  updateOrderStatus,
  seedOrders
} = require('../controllers/orderController');

// Crear una nueva orden
router.post('/', createOrder);

// Obtener mis órdenes
router.get('/my-orders', getMyOrders);

// Obtener órdenes de una tienda específica
router.get('/store/:storeId', getStoreOrders);

// Crear datos de ejemplo (solo para desarrollo)
router.post('/seed', seedOrders);

// Obtener detalles de una orden específica
router.get('/:id', getOrderById);

// Actualizar estado de una orden
router.put('/:id/status', updateOrderStatus);

module.exports = router;
