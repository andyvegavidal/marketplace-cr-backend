/**
 * RUTAS DE COMPRAS
 * 
 * Maneja todas las rutas relacionadas con las compras de los usuarios.
 * 
 * @routes PurchaseRoutes
 * @author Marketplace CR Development Team
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();
const purchaseController = require('../controllers/purchaseController');

/**
 * @route GET /api/purchases/my-purchases
 * @desc Obtener todas las compras del usuario autenticado
 * @access Private
 */
router.get('/my-purchases', purchaseController.getMyPurchases);

/**
 * @route GET /api/purchases/stats
 * @desc Obtener estadísticas de compras del usuario
 * @access Private
 */
router.get('/stats', purchaseController.getPurchaseStats);

/**
 * @route GET /api/purchases/:id
 * @desc Obtener detalles de una compra específica
 * @access Private
 */
router.get('/:id', purchaseController.getPurchaseDetails);

module.exports = router;
