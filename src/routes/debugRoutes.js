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

module.exports = router;
