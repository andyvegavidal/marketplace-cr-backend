const Product = require('../models/Product');
const Store = require('../models/Store');
const mongoose = require('mongoose');

// Obtener lista paginada de productos con filtros
const getProducts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 100,
      sortBy = 'createdAt',
      sortOrder = -1,
      category,
      minPrice,
      maxPrice,
      search,
      storeId,
      featured
    } = req.query;

    const filter = { isActive: true };
    
    if (category) {
      filter.category = new RegExp(category, 'i');
    }
    
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }
    
    if (storeId) {
      filter.storeId = storeId;
    }
    
    if (featured !== undefined) {
      filter.featured = featured === 'true';
    }

    if (search) {
      filter.$text = { $search: search };
    }

    const skip = (page - 1) * limit;
    const sortOptions = { [sortBy]: parseInt(sortOrder) };

    const products = await Product.find(filter)
      .populate('storeId', 'userId description rating verified')
      .populate({
        path: 'storeId',
        populate: {
          path: 'userId',
          select: 'fullName photo'
        }
      })
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Product.countDocuments(filter);

    res.json({
      success: true,
      data: {
        products,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / limit),
          limit: parseInt(limit)
        }
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Obtener producto por ID
const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('storeId', 'userId description rating verified totalSales')
      .populate({
        path: 'storeId',
        populate: {
          path: 'userId',
          select: 'fullName photo country'
        }
      });

    if (!product || !product.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }

    await product.incrementViews();

    res.json({
      success: true,
      data: { product }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Crear producto (solo tiendas)
const createProduct = async (req, res) => {
  try {
    // Verificar JWT
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token de autorización requerido'
      });
    }

    let userId;
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      userId = decoded.userId;
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Token inválido'
      });
    }

    const {
      name,
      description,
      category,
      price,
      stock,
      physicalLocation,
      averageShippingTime,
      featured = false,
      specifications = {},
      tags = []
    } = req.body;

    // Obtener tienda del usuario
    const store = await Store.findOne({ userId: userId });
    
    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Perfil de tienda no encontrado. El usuario debe ser una tienda.'
      });
    }

    // Manejar imágenes
    let images = [];
    if (req.files && req.files.length > 0) {
      images = req.files.map(file => `/uploads/${file.filename}`);
    }

    if (images.length === 0) {
      images = ['/uploads/default-product.jpg'];
    }

    const product = new Product({
      storeId: store._id,
      name,
      description,
      category,
      price,
      stock,
      physicalLocation,
      averageShippingTime,
      images,
      featured,
      specifications: new Map(Object.entries(specifications)),
      tags
    });

    await product.save();

    // Actualizar contador de productos en la tienda
    await Store.findByIdAndUpdate(store._id, {
      $inc: { totalProducts: 1 }
    });

    res.status(201).json({
      success: true,
      message: 'Producto creado exitosamente',
      data: { product }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Actualizar producto
const updateProduct = async (req, res) => {
  try {
    // Verificar JWT
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token de autorización requerido'
      });
    }

    let userId;
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      userId = decoded.userId;
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Token inválido'
      });
    }

    const productId = req.params.id;
    const updateData = req.body;

    // Verificar que el producto existe
    const product = await Product.findById(productId).populate('storeId');
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }

    // Verificar permisos
    if (!product.storeId || !product.storeId.userId || !product.storeId.userId.equals(userId)) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para actualizar este producto'
      });
    }

    // Preparar datos de actualización
    const cleanUpdateData = {
      name: updateData.name,
      description: updateData.description,
      price: updateData.price,
      category: updateData.category,
      stock: updateData.stock,
      physicalLocation: updateData.physicalLocation,
      averageShippingTime: updateData.averageShippingTime,
      specifications: updateData.specifications,
      isActive: updateData.isActive !== undefined ? updateData.isActive : product.isActive
    };

    if (updateData.images && Array.isArray(updateData.images)) {
      cleanUpdateData.images = updateData.images;
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      cleanUpdateData,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Producto actualizado exitosamente',
      data: updatedProduct
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Eliminar producto
const deleteProduct = async (req, res) => {
  try {
    // Verificar JWT
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token de autorización requerido'
      });
    }

    let userId;
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      userId = decoded.userId;
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Token inválido'
      });
    }

    const productId = req.params.id;

    const product = await Product.findById(productId).populate('storeId');
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }

    if (!product.storeId.userId.equals(userId)) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para eliminar este producto'
      });
    }

    // Marcar como inactivo en lugar de eliminar
    await Product.findByIdAndUpdate(productId, { isActive: false });

    await Store.findByIdAndUpdate(product.storeId._id, {
      $inc: { totalProducts: -1 }
    });

    res.json({
      success: true,
      message: 'Producto eliminado exitosamente'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Obtener productos de una tienda específica
const getStoreProducts = async (req, res) => {
  try {
    const { storeId } = req.params;
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = -1,
      category,
      featured
    } = req.query;

    const store = await Store.findById(storeId);
    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Tienda no encontrada'
      });
    }

    const filter = { storeId, isActive: true };
    
    if (category) {
      filter.category = new RegExp(category, 'i');
    }
    
    if (featured !== undefined) {
      filter.featured = featured === 'true';
    }

    const skip = (page - 1) * limit;
    const sortOptions = { [sortBy]: parseInt(sortOrder) };

    const products = await Product.find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Product.countDocuments(filter);

    res.json({
      success: true,
      data: {
        products,
        store,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / limit),
          limit: parseInt(limit)
        }
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Obtener categorías disponibles
const getCategories = async (req, res) => {
  try {
    const categories = await Product.distinct('category', { isActive: true });
    
    res.json({
      success: true,
      data: {
        categories: categories.sort()
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Obtener productos relacionados
const getRelatedProducts = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 5 } = req.query;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }

    // Buscar productos relacionados por categoría
    const relatedProducts = await Product.find({
      _id: { $ne: id },
      category: product.category,
      isActive: true
    })
    .populate('storeId', 'userId description rating')
    .limit(parseInt(limit))
    .sort({ rating: -1, salesCount: -1 });

    res.json({
      success: true,
      data: { relatedProducts }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getStoreProducts,
  getCategories,
  getRelatedProducts
};
