const express = require('express');
const router = express.Router();

const Store = require('../models/Store');
const User = require('../models/User');

// Obtener todas las tiendas públicas
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, sortBy = 'rating', sortOrder = -1 } = req.query;
    const skip = (page - 1) * limit;

    const stores = await Store.find({ isPublic: true })
      .populate('userId', 'fullName photo country')
      .sort({ [sortBy]: parseInt(sortOrder) })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Store.countDocuments({ isPublic: true });

    res.json({
      success: true,
      data: {
        stores,
        pagination: { total, page: parseInt(page), pages: Math.ceil(total / limit) }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
});

// Obtener tienda por userID (debe estar ANTES de /:id)
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const store = await Store.findOne({ userId })
      .populate('userId', 'fullName photo country email address');

    if (!store) {
      return res.status(404).json({ 
        success: false, 
        message: 'No se encontró tienda para este usuario' 
      });
    }

    res.json({ 
      success: true, 
      data: { store } 
    });
  } catch (error) {
    console.error('Error al obtener tienda por userID:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error interno del servidor',
      error: error.message 
    });
  }
});

// Obtener tienda por ID
router.get('/:id', async (req, res) => {
  try {
    const store = await Store.findById(req.params.id)
      .populate('userId', 'fullName photo country socialNetworks');

    if (!store || !store.isPublic) {
      return res.status(404).json({ success: false, message: 'Tienda no encontrada' });
    }

    res.json({ success: true, data: { store } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
});

// Seguir/dejar de seguir tienda
router.post('/:id/follow', async (req, res) => {
  try {
    const store = await Store.findById(req.params.id);
    if (!store) {
      return res.status(404).json({ success: false, message: 'Tienda no encontrada' });
    }

    const isFollowing = store.followers.includes(req.user._id);
    
    if (isFollowing) {
      await store.removeFollower(req.user._id);
      res.json({ success: true, message: 'Dejaste de seguir la tienda', following: false });
    } else {
      await store.addFollower(req.user._id);
      res.json({ success: true, message: 'Ahora sigues la tienda', following: true });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
});

// Actualizar perfil de tienda (solo propietarios)
router.put('/:id', async (req, res) => {
  try {
    const { description, categories, isPublic } = req.body;
    
    const store = await Store.findOneAndUpdate(
      { userId: req.user._id },
      { description, categories, isPublic },
      { new: true, runValidators: true }
    ).populate('userId', 'fullName photo');

    res.json({ success: true, message: 'Perfil actualizado', data: { store } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
});

module.exports = router;
