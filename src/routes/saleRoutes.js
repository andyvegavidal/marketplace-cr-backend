/**
 * RUTAS DE VENTAS
 * 
 * Maneja todas las rutas relacionadas con las ventas de las tiendas.
 * 
 * @routes SaleRoutes
 * @author Marketplace CR Development Team
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();
const saleController = require('../controllers/saleController');

/**
 * @route GET /api/sales/my-sales
 * @desc Obtener todas las ventas del usuario autenticado
 * @access Private
 */
router.get('/my-sales', saleController.getMySales);

/**
 * @route GET /api/sales/stats
 * @desc Obtener estadísticas de ventas del usuario
 * @access Private
 */
router.get('/stats', saleController.getSalesStats);

/**
 * @route GET /api/sales/:id
 * @desc Obtener detalles de una venta específica
 * @access Private
 */
router.get('/:id', saleController.getSaleDetails);

module.exports = router;
