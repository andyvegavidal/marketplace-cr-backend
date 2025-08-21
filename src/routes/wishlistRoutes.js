const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Wishlist = require('../models/Wishlist');
const Product = require('../models/Product');

// Función simple para verificar token
const getUser = async (req) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return null;
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    return user;
  } catch (error) {
    return null;
  }
};

// GET /api/wishlist - Obtener wishlist
router.get('/', async (req, res) => {
  try {
    const user = await getUser(req);
    if (!user) {
      return res.status(401).json({ success: false, message: 'No autenticado' });
    }

    const wishlist = await Wishlist.findOne({ userId: user._id });
    
    if (wishlist && wishlist.products.length > 0) {
      try {
        await wishlist.populate('products.productId');
      } catch (populateError) {
        // Si falla el populate, devolver sin populate
      }
    }
    
    const responseData = {
      success: true,
      data: {
        items: wishlist?.products || [],
        count: wishlist?.products?.length || 0
      }
    };
    
    res.json(responseData);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

// POST /api/wishlist - Agregar producto
router.post('/', async (req, res) => {
  try {
    const user = await getUser(req);
    if (!user) {
      return res.status(401).json({ success: false, message: 'No autenticado' });
    }

    const { productId } = req.body;
    
    if (!productId) {
      return res.status(400).json({ success: false, message: 'ID de producto requerido' });
    }

    // Validar que productId es un ObjectId válido
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: 'ID de producto inválido' });
    }

    // Verificar que el producto existe
    const productExists = await Product.findById(productId);
    if (!productExists) {
      return res.status(404).json({ success: false, message: 'Producto no encontrado' });
    }

    // Buscar o crear wishlist
    let wishlist = await Wishlist.findOne({ userId: user._id });
    
    if (!wishlist) {
      wishlist = new Wishlist({ userId: user._id, products: [] });
    }

    // Verificar si ya existe
    const exists = wishlist.products.some(item => item.productId.toString() === productId);
    if (exists) {
      return res.status(400).json({ success: false, message: 'Producto ya en wishlist' });
    }

    // Usar MongoDB $addToSet para agregar de forma atómica
    const updatedWishlist = await Wishlist.findByIdAndUpdate(
      wishlist._id,
      { 
        $addToSet: { 
          products: { productId, addedAt: new Date() } 
        } 
      },
      { new: true }
    );
    
    res.json({ success: true, message: 'Producto agregado a wishlist' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

// DELETE /api/wishlist/:productId - Remover producto
router.delete('/:productId', async (req, res) => {
  console.log('Removing product from wishlist');
  try {
    const user = await getUser(req);
    if (!user) {
      return res.status(401).json({ success: false, message: 'No autenticado' });
    }

    const { productId } = req.params;
    
    const wishlist = await Wishlist.findOne({ userId: user._id });
    if (!wishlist) {
      return res.status(404).json({ success: false, message: 'Wishlist no encontrada' });
    }

    // Remover producto
    wishlist.products = wishlist.products.filter(item => 
      item.productId.toString() !== productId
    );
    await wishlist.save();

    res.json({ success: true, message: 'Producto removido de wishlist' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

module.exports = router;
