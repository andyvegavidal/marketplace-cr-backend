const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Store = require('../models/Store');

// Generar JWT
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

const register = async (req, res) => {
  try {
    // Validar campos requeridos
    const requiredFields = ['idNumber', 'username', 'password', 'email', 'fullName', 'country', 'userType'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Campos requeridos faltantes: ${missingFields.join(', ')}`
      });
    }
    
    const {
      idNumber,
      username,
      password,
      email,
      fullName,
      country,
      address,
      phone,
      userType,
      socialNetworks,
      description, // Para tiendas
      categories    // Para tiendas
    } = req.body;

    // Verificar si el usuario ya existe
    const existingUser = await User.findOne({
      $or: [
        { email },
        { username },
        { idNumber }
      ]
    });
    if (existingUser) {
      let field = 'Usuario';
      if (existingUser.email === email) field = 'Email';
      else if (existingUser.username === username) field = 'Nombre de usuario';
      else if (existingUser.idNumber === idNumber) field = 'Número de identificación';
      
      return res.status(400).json({
        success: false,
        message: `${field} ya está registrado`
      });
    }

    // Crear usuario
    const user = new User({
      idNumber,
      username,
      password,
      email,
      fullName,
      country,
      address,
      phone,
      userType,
      socialNetworks: socialNetworks || []
    });
    await user.save();
    // Si es una tienda, crear perfil de tienda
    if (userType === 'store') {
      const store = new Store({
        userId: user._id,
        description: description || '',
        categories: categories || []
      });
      await store.save();
    }
    // Generar token
    const token = generateToken(user._id);

    // Actualizar último login
    user.lastLogin = new Date();
    await user.save();
    res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente',
      data: {
        user: user.getPublicProfile(),
        token
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Login de usuario
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validar que se recibieron los campos requeridos
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email y contraseña son requeridos'
      });
    }

    // Buscar usuario por email
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }

    // Verificar que la cuenta esté activa
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Cuenta desactivada'
      });
    }

    // Verificar contraseña
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }

    // Generar token
    const token = generateToken(user._id);

    // Actualizar último login
    user.lastLogin = new Date();
    await user.save();

    // Si es tienda, incluir información de la tienda
    let userData = user.getPublicProfile();
    if (user.userType === 'store') {
      const store = await Store.findOne({ userId: user._id });
      userData.store = store;
    }

    res.json({
      success: true,
      message: 'Login exitoso',
      data: {
        user: userData,
        token
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Obtener perfil del usuario actual
const getProfile = async (req, res) => {
  try {
    let userData = req.user.getPublicProfile();

    // Si es tienda, incluir información de la tienda
    if (req.user.userType === 'store') {
      const store = await Store.findOne({ userId: req.user._id });
      userData.store = store;
    }

    res.json({
      success: true,
      data: {
        user: userData
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Actualizar perfil
const updateProfile = async (req, res) => {
  try {
    const {
      fullName,
      country,
      address,
      phone,
      socialNetworks,
      // Campos específicos para tiendas
      description,
      categories
    } = req.body;

    // Actualizar usuario
    const updateData = {
      fullName,
      country,
      address,
      phone,
      socialNetworks
    };

    // Remover campos undefined
    Object.keys(updateData).forEach(key => 
      updateData[key] === undefined && delete updateData[key]
    );

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    // Si es tienda, actualizar información de la tienda
    if (user.userType === 'store' && (description !== undefined || categories !== undefined)) {
      const storeUpdateData = {};
      if (description !== undefined) storeUpdateData.description = description;
      if (categories !== undefined) storeUpdateData.categories = categories;

      await Store.findOneAndUpdate(
        { userId: user._id },
        storeUpdateData,
        { new: true, runValidators: true }
      );
    }

    res.json({
      success: true,
      message: 'Perfil actualizado exitosamente',
      data: {
        user: user.getPublicProfile()
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Logout (invalidar token - esto requeriría una blacklist de tokens)
const logout = async (req, res) => {
  try {
    // En una implementación real, aquí podrías:
    // 1. Agregar el token a una blacklist
    // 2. Usar Redis para invalidar tokens
    // 3. Implementar refresh tokens

    res.json({
      success: true,
      message: 'Logout exitoso'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Cambiar contraseña
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Obtener usuario con contraseña
    const user = await User.findById(req.user._id).select('+password');

    // Verificar contraseña actual
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);

    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Contraseña actual incorrecta'
      });
    }

    // Actualizar contraseña
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Contraseña actualizada exitosamente'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Desactivar cuenta
const deactivateAccount = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { isActive: false });

    res.json({
      success: true,
      message: 'Cuenta desactivada exitosamente'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

module.exports = {
  register,
  login,
  logout,
  getProfile,
  updateProfile,
  changePassword,
  deactivateAccount
};
