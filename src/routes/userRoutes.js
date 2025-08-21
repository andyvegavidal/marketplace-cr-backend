const express = require('express');
const router = express.Router();

const User = require('../models/User');

// Obtener perfil público de usuario
router.get('/:id',  async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password -email -phone -address -idNumber')
      .populate('store');

    if (!user || !user.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    res.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Buscar usuarios (solo información pública)
router.get('/', async (req, res) => {
  try {
    const { search, userType, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const filter = { isActive: true };
    
    if (userType) {
      filter.userType = userType;
    }

    if (search) {
      filter.$or = [
        { fullName: new RegExp(search, 'i') },
        { username: new RegExp(search, 'i') }
      ];
    }

    const users = await User.find(filter)
      .select('fullName username photo userType country')
      .populate('store', 'description rating')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(filter);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

module.exports = router;
