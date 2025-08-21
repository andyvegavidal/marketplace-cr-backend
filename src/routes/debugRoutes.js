const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Product = require('../models/Product');
const Store = require('../models/Store');

// Ruta para obtener usuarios (SOLO PARA DESARROLLO/TESTING)
router.get('/users', async (req, res) => {
  try {
    const users = await User.find({}, 'email username fullName userType').limit(5);
    res.json({
      success: true,
      users: users.map(user => ({
        email: user.email,
        username: user.username,
        fullName: user.fullName,
        userType: user.userType
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Ruta para crear producto de prueba (SOLO PARA TESTING)
router.post('/create-test-product', async (req, res) => {
  try {
    // Buscar una tienda existente o crear una temporal
    let store = await Store.findOne();
    if (!store) {
      // Crear tienda temporal
      const user = await User.findOne();
      store = new Store({
        name: 'Tienda de Prueba',
        description: 'Tienda temporal para pruebas',
        ownerId: user._id,
        isActive: true,
        categories: ['electronics']
      });
      await store.save();
    }

    // Crear producto de prueba
    const testProduct = new Product({
      id: 'test-product-' + Date.now(),
      name: 'Producto de Prueba para Órdenes',
      description: 'Este es un producto creado específicamente para probar el sistema de órdenes',
      price: 18500,
      stock: 100,
      category: 'electronics',
      subcategory: 'phones',
      images: ['https://via.placeholder.com/300x300?text=Producto+Prueba'],
      storeId: store._id,
      isActive: true,
      salesCount: 0
    });

    await testProduct.save();

    res.json({
      success: true,
      message: 'Producto de prueba creado exitosamente',
      product: {
        _id: testProduct._id,
        name: testProduct.name,
        price: testProduct.price,
        storeId: testProduct.storeId,
        stock: testProduct.stock
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
