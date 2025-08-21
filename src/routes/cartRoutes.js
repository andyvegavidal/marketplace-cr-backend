const express = require('express');
const router = express.Router();

const Cart = require('../models/Cart');
const Product = require('../models/Product');

// Todas las rutas requieren autenticación

// Obtener carrito del usuario
router.get('/', async (req, res) => {
  try {
    const cart = await Cart.getOrCreateCart(req.user._id);
    
    // Poblar información de productos
    await cart.populate({
      path: 'items.productId',
      select: 'name price images stock isActive',
      populate: {
        path: 'storeId',
        select: 'userId description'
      }
    });

    // Filtrar productos que aún existen y están activos
    cart.items = cart.items.filter(item => 
      item.productId && item.productId.isActive
    );

    // Actualizar total si se filtraron items
    await cart.save();

    res.json({
      success: true,
      data: {
        cart,
        totalItems: cart.getTotalItems(),
        isEmpty: cart.isEmpty()
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Agregar item al carrito
router.post('/items', async (req, res) => {
  try {
    const { productId, quantity } = req.body;

    // Verificar que el producto existe y está disponible
    const product = await Product.findById(productId);
    if (!product || !product.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado o no disponible'
      });
    }

    // Verificar stock
    if (!product.isAvailable(quantity)) {
      return res.status(400).json({
        success: false,
        message: `Stock insuficiente. Solo ${product.stock} disponibles`
      });
    }

    // Verificar que el usuario no esté comprando de su propia tienda
    if (req.user.userType === 'store') {
      const Store = require('../models/Store');
      const userStore = await Store.findOne({ userId: req.user._id });
      if (userStore && product.storeId.equals(userStore._id)) {
        return res.status(400).json({
          success: false,
          message: 'No puedes comprar productos de tu propia tienda'
        });
      }
    }

    const cart = await Cart.getOrCreateCart(req.user._id);
    await cart.addItem(productId, quantity, product.price);

    // Poblar información para respuesta
    await cart.populate({
      path: 'items.productId',
      select: 'name price images stock'
    });

    res.json({
      success: true,
      message: 'Producto agregado al carrito',
      data: {
        cart,
        totalItems: cart.getTotalItems()
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Actualizar cantidad de un item
router.put('/items/:productId', 
  async (req, res) => {
    try {
      const { productId } = req.params;
      const { quantity } = req.body;

      if (!quantity || quantity < 1) {
        return res.status(400).json({
          success: false,
          message: 'Cantidad debe ser mayor a 0'
        });
      }

      // Verificar stock del producto
      const product = await Product.findById(productId);
      if (!product || !product.isActive) {
        return res.status(404).json({
          success: false,
          message: 'Producto no encontrado'
        });
      }

      if (!product.isAvailable(quantity)) {
        return res.status(400).json({
          success: false,
          message: `Stock insuficiente. Solo ${product.stock} disponibles`
        });
      }

      const cart = await Cart.getOrCreateCart();
      await cart.updateItemQuantity(productId, quantity);

      await cart.populate({
        path: 'items.productId',
        select: 'name price images stock'
      });

      res.json({
        success: true,
        message: 'Cantidad actualizada',
        data: {
          cart,
          totalItems: cart.getTotalItems()
        }
      });

    } catch (error) {
      
      if (error.message === 'Producto no encontrado en el carrito') {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }
);

// Remover item del carrito
router.delete('/items/:productId', 
  async (req, res) => {
    try {
      const { productId } = req.params;

      const cart = await Cart.getOrCreateCart(req.user._id);
      await cart.removeItem(productId);

      await cart.populate({
        path: 'items.productId',
        select: 'name price images stock'
      });

      res.json({
        success: true,
        message: 'Producto removido del carrito',
        data: {
          cart,
          totalItems: cart.getTotalItems()
        }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }
);

// Limpiar carrito completo
router.delete('/', async (req, res) => {
  try {
    const cart = await Cart.getOrCreateCart(req.user._id);
    await cart.clear();

    res.json({
      success: true,
      message: 'Carrito limpiado exitosamente',
      data: {
        cart
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Obtener items agrupados por tienda (útil para checkout)
router.get('/grouped', async (req, res) => {
  try {
    const cart = await Cart.getOrCreateCart(req.user._id);
    const itemsByStore = await cart.getItemsByStore();

    res.json({
      success: true,
      data: {
        itemsByStore,
        totalAmount: cart.totalAmount,
        totalItems: cart.getTotalItems()
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Procesar checkout (crear órdenes)
router.post('/checkout', async (req, res) => {
  try {
    const { shippingAddress, paymentMethod } = req.body;

    if (!shippingAddress) {
      return res.status(400).json({
        success: false,
        message: 'Dirección de envío es requerida'
      });
    }

    const cart = await Cart.getOrCreateCart(req.user._id);
    
    if (cart.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'El carrito está vacío'
      });
    }

    // Verificar disponibilidad de todos los productos
    await cart.populate('items.productId');
    
    for (const item of cart.items) {
      if (!item.productId || !item.productId.isActive) {
        return res.status(400).json({
          success: false,
          message: `Producto ${item.productId?.name || 'no encontrado'} ya no está disponible`
        });
      }
      
      if (!item.productId.isAvailable(item.quantity)) {
        return res.status(400).json({
          success: false,
          message: `Stock insuficiente para ${item.productId.name}`
        });
      }
    }

    // Crear órdenes agrupadas por tienda
    const Order = require('../models/Order');
    const itemsByStore = await cart.getItemsByStore();
    const orders = [];

    for (const storeGroup of itemsByStore) {
      const order = new Order({
        userId: req.user._id,
        storeId: storeGroup.storeId,
        items: storeGroup.items.map(item => ({
          productId: item.productId._id,
          name: item.productId.name,
          price: item.price,
          quantity: item.quantity,
          subtotal: item.price * item.quantity
        })),
        totalAmount: storeGroup.subtotal,
        shippingAddress,
        paymentMethod: paymentMethod || 'pending'
      });

      await order.save();
      orders.push(order);

      // Reducir stock de productos
      for (const item of storeGroup.items) {
        await item.productId.reduceStock(item.quantity);
        await item.productId.incrementSales(item.quantity);
      }
    }

    // Limpiar carrito después del checkout exitoso
    await cart.clear();

    // Crear notificaciones para las tiendas
    const Notification = require('../models/Notification');
    for (const order of orders) {
      await Notification.createNotification({
        userId: order.storeId.userId, // Necesitarás poblar esto
        type: 'order',
        title: 'Nueva orden recibida',
        message: `Has recibido una nueva orden por $${order.totalAmount}`,
        data: { orderId: order._id },
        actionUrl: `/orders/${order._id}`
      });
    }

    res.json({
      success: true,
      message: 'Checkout procesado exitosamente',
      data: {
        orders,
        totalOrders: orders.length,
        totalAmount: orders.reduce((sum, order) => sum + order.totalAmount, 0)
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error procesando el checkout'
    });
  }
});

module.exports = router;
