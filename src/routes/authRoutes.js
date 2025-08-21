const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

const authController = require('../controllers/authController');
const User = require('../models/User');

// Función para verificar autenticación (misma que en wishlist)
const verifyAuth = async (req, res) => {
  try {
    let token = req.header('Authorization');
    
    if (token && token.startsWith('Bearer ')) {
      token = token.slice(7);
    }

    if (!token) {
      return { error: 'Token de acceso requerido', status: 401 };
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'k8M6D3puL&s');
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return { error: 'Usuario no encontrado', status: 401 };
    }

    if (!user.isActive) {
      return { error: 'Cuenta desactivada', status: 401 };
    }

    return { user };

  } catch (error) {
    return { error: 'Token inválido', status: 401 };
  }
};

// Rutas públicas
router.post('/register', authController.register);
router.post('/login', authController.login);

// Rutas protegidas
router.get('/me', async (req, res) => {
  const authResult = await verifyAuth(req, res);
  if (authResult.error) {
    return res.status(authResult.status).json({
      success: false,
      message: authResult.error
    });
  }
  req.user = authResult.user;
  authController.getProfile(req, res);
});

router.put('/profile', async (req, res) => {
  const authResult = await verifyAuth(req, res);
  if (authResult.error) {
    return res.status(authResult.status).json({
      success: false,
      message: authResult.error
    });
  }
  req.user = authResult.user;
  authController.updateProfile(req, res);
});

router.post('/logout', async (req, res) => {
  const authResult = await verifyAuth(req, res);
  if (authResult.error) {
    return res.status(authResult.status).json({
      success: false,
      message: authResult.error
    });
  }
  req.user = authResult.user;
  authController.logout(req, res);
});

// Cambiar contraseña
router.patch('/change-password', [
  require('express-validator').body('currentPassword')
    .notEmpty()
    .withMessage('Contraseña actual es requerida'),
  require('express-validator').body('newPassword')
    .isLength({ min: 6 })
    .withMessage('Nueva contraseña debe tener al menos 6 caracteres')
], async (req, res) => {
  const authResult = await verifyAuth(req, res);
  if (authResult.error) {
    return res.status(authResult.status).json({
      success: false,
      message: authResult.error
    });
  }
  req.user = authResult.user;
  authController.changePassword(req, res);
});

// Subir avatar
router.post('/upload-avatar', async (req, res) => {
  try {
    const authResult = await verifyAuth(req, res);
    if (authResult.error) {
      return res.status(authResult.status).json({
        success: false,
        message: authResult.error
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Archivo de imagen requerido'
      });
    }

    const User = require('../models/User');
    const photoUrl = `/uploads/${req.file.filename}`;
    
    await User.findByIdAndUpdate(authResult.user._id, { photo: photoUrl });

    res.json({
      success: true,
      message: 'Avatar actualizado exitosamente',
      data: {
        photoUrl
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Desactivar cuenta
router.patch('/deactivate', async (req, res) => {
  const authResult = await verifyAuth(req, res);
  if (authResult.error) {
    return res.status(authResult.status).json({
      success: false,
      message: authResult.error
    });
  }
  req.user = authResult.user;
  authController.deactivateAccount(req, res);
});

module.exports = router;
