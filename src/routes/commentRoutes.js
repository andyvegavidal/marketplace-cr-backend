const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

const Comment = require('../models/Comment');
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

// Obtener comentarios de un producto
router.get('/product/:productId', 
  async (req, res) => {
    try {
      const { page = 1, limit = 20 } = req.query;
      const result = await Comment.getProductComments(req.params.productId, { page, limit });

      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  }
);

// Crear comentario
router.post('/product/:productId',
  authenticate,
  async (req, res) => {
    try {
      const { content, parentCommentId } = req.body;

      const comment = new Comment({
        userId: req.user._id,
        productId: req.params.productId,
        content,
        parentCommentId: parentCommentId || null
      });

      await comment.save();
      await comment.populate('user', 'fullName photo');

      res.status(201).json({
        success: true,
        message: 'Comentario creado exitosamente',
        data: { comment }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  }
);

// Dar like a un comentario
router.post('/:commentId/like',
  authenticate,
  async (req, res) => {
    try {
      const comment = await Comment.findById(req.params.commentId);
      if (!comment) {
        return res.status(404).json({ success: false, message: 'Comentario no encontrado' });
      }

      const isLiked = comment.likes.includes(req.user._id);
      
      if (isLiked) {
        await comment.removeLike(req.user._id);
        res.json({ success: true, message: 'Like removido', liked: false });
      } else {
        await comment.addLike(req.user._id);
        res.json({ success: true, message: 'Like agregado', liked: true });
      }
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  }
);

module.exports = router;
