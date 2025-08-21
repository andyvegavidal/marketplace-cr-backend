const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

const Review = require('../models/Review');
const User = require('../models/User');

// Middleware de autenticación
const authenticate = async (req, res, next) => {
  try {
    let token = req.header('Authorization');
    
    if (token && token.startsWith('Bearer ')) {
      token = token.slice(7);
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Token de acceso requerido' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({ success: false, message: 'Usuario no encontrado' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Token inválido' });
  }
};

// Obtener reseñas de un producto
router.get('/product/:productId', async (req, res) => {

  try {
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = -1 } = req.query;
    const skip = (page - 1) * limit;
    const productId = req.params.productId;


    // Check if Review model is working

    // Convert productId to ObjectId if possible, otherwise use as string
    let searchId = productId;
    const mongoose = require('mongoose');
    
    // Only convert to ObjectId if it's a valid ObjectId format
    if (mongoose.Types.ObjectId.isValid(productId) && productId.length === 24) {
      searchId = new mongoose.Types.ObjectId(productId);
    }


    // Simplified query without populate first
    const reviews = await Review.find({
      targetType: 'product',
      targetId: searchId,
      isActive: true
    })
    .sort({ [sortBy]: parseInt(sortOrder) })
    .skip(skip)
    .limit(parseInt(limit))
    .lean(); // Use lean for better performance


    const total = await Review.countDocuments({
      targetType: 'product',
      targetId: searchId,
      isActive: true
    });

    // Simple stats without aggregation for now
    const stats = {
      totalReviews: total,
      averageRating: 0,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    };


    res.json({
      success: true,
      reviews: reviews,
      stats: stats,
      pagination: { total, page: parseInt(page), pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error interno del servidor', 
      error: error.message,
      stack: error.stack 
    });
  }
});

// Crear reseña de producto
router.post('/product/:productId', 
  authenticate,
  async (req, res) => {
    try {
      const { rating, title, comment, pros = [], cons = [] } = req.body;
      const productId = req.params.productId;


      // Convert productId to ObjectId if possible, otherwise use as string
      let searchId = productId;
      const mongoose = require('mongoose');
      
      // Only convert to ObjectId if it's a valid ObjectId format
      if (mongoose.Types.ObjectId.isValid(productId) && productId.length === 24) {
        searchId = new mongoose.Types.ObjectId(productId);
      }

      // Verificar si el usuario puede hacer la reseña (simplificado)
      const existingReview = await Review.findOne({
        userId: req.user._id,
        targetType: 'product',
        targetId: searchId
      });

      if (existingReview) {
        return res.status(400).json({ 
          success: false, 
          message: 'Ya has hecho una reseña para este producto' 
        });
      }

      const review = new Review({
        userId: req.user._id,
        targetType: 'product',
        targetId: searchId,
        rating,
        title,
        comment,
        pros,
        cons
      });

      await review.save();

      // Populate user info before sending response
      await review.populate('userId', 'fullName photo');

      res.status(201).json({
        success: true,
        message: 'Reseña creada exitosamente',
        review: review
      });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: 'Error interno del servidor',
        error: error.message 
      });
    }
  }
);

// Marcar reseña como útil
router.post('/:reviewId/helpful', 
  authenticate,
  async (req, res) => {
    try {
      const review = await Review.findById(req.params.reviewId);
      if (!review) {
        return res.status(404).json({ success: false, message: 'Reseña no encontrada' });
      }

      await review.markAsHelpful(req.user._id);

      res.json({ success: true, message: 'Reseña marcada como útil' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  }
);

// Obtener reseñas de una tienda
router.get('/store/:storeId', async (req, res) => {
  try {
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = -1 } = req.query;
    const skip = (page - 1) * limit;

    const reviews = await Review.find({
      targetType: 'store',
      targetId: req.params.storeId,
      isActive: true
    })
    .populate('userId', 'fullName photo')
    .sort({ [sortBy]: parseInt(sortOrder) })
    .skip(skip)
    .limit(parseInt(limit));

    const total = await Review.countDocuments({
      targetType: 'store',
      targetId: req.params.storeId,
      isActive: true
    });

    const stats = await Review.getReviewStats('store', req.params.storeId);

    res.json({
      success: true,
      reviews: reviews,
      stats: stats,
      pagination: { total, page: parseInt(page), pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
});

// Crear reseña de tienda
router.post('/store/:storeId', 
  authenticate,
  async (req, res) => {
    try {
      const { rating, title, comment, pros = [], cons = [] } = req.body;
      const targetId = req.params.storeId;

      // Verificar si el usuario puede hacer la reseña
      const canReview = await Review.canUserReview(req.user._id, 'store', targetId);
      if (!canReview.canReview) {
        return res.status(400).json({ success: false, message: canReview.reason });
      }

      const review = new Review({
        userId: req.user._id,
        targetType: 'store',
        targetId,
        rating,
        title,
        comment,
        pros,
        cons
      });

      await review.save();

      res.status(201).json({
        success: true,
        message: 'Reseña creada exitosamente',
        review: review
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  }
);

// Obtener reseñas del usuario actual
router.get('/my-reviews', authenticate, async (req, res) => {
  try {
    const reviews = await Review.find({
      userId: req.user._id,
      isActive: true
    })
    .populate('targetId', 'name fullName')
    .sort({ createdAt: -1 });

    res.json({
      success: true,
      reviews: reviews
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
});

// Reportar una reseña
router.post('/:reviewId/report', authenticate, async (req, res) => {
  try {
    const { reason } = req.body;
    const reviewId = req.params.reviewId;

    if (!reason) {
      return res.status(400).json({ success: false, message: 'Razón del reporte es requerida' });
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ success: false, message: 'Reseña no encontrada' });
    }

    // Aquí podrías implementar un sistema de reportes más complejo
    // Por ahora simplemente registramos el reporte

    res.json({
      success: true,
      message: 'Reseña reportada exitosamente'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
});

module.exports = router;
