const express = require('express');
const router = express.Router();

const Notification = require('../models/Notification');

// Obtener notificaciones del usuario
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, unreadOnly = false, type } = req.query;
    
    const result = await Notification.getUserNotifications(req.user._id, {
      page: parseInt(page),
      limit: parseInt(limit),
      unreadOnly: unreadOnly === 'true',
      type
    });

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
});

// Marcar notificación como leída
router.put('/:id/read', async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notificación no encontrada' });
    }

    await notification.markAsRead();

    res.json({ success: true, message: 'Notificación marcada como leída' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
});

// Marcar todas las notificaciones como leídas
router.post('/mark-all-read', async (req, res) => {
  try {
    await Notification.markAllAsRead(req.user._id);

    res.json({ success: true, message: 'Todas las notificaciones marcadas como leídas' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
});

// Eliminar notificación
router.delete('/:id', async (req, res) => {
  try {
    const result = await Notification.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!result) {
      return res.status(404).json({ success: false, message: 'Notificación no encontrada' });
    }

    res.json({ success: true, message: 'Notificación eliminada' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
});

module.exports = router;
