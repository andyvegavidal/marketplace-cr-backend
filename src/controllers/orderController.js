/**
 * CONTROLADOR DE ÓRDENES
 * 
 * Maneja todas las operaciones relacionadas con órdenes de compra,
 * incluyendo creación, gestión y consultas para reportes.
 * 
 * @controller OrderController
 * @author Marketplace CR Development Team
 * @version 1.0.0
 */

const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Store = require('../models/Store');
const User = require('../models/User');
const Purchase = require('../models/Purchase');
const Sale = require('../models/Sale');

// Función helper para verificar token y obtener usuario
const verifyToken = async (req) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      throw new Error('Token no proporcionado');
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user) {
      throw new Error('Usuario no encontrado');
    }
    
    return user;
  } catch (error) {
    throw new Error('Token inválido o usuario no encontrado');
  }
};

/**
 * Crear una nueva orden
 * POST /api/orders
 */
const createOrder = async (req, res) => {
  try {
    // Verificar autenticación PRIMERO
    const user = await verifyToken(req);
    
    const {
      items,
      shippingAddress,
      paymentMethod,
      subtotal,
      shippingCost = 0,
      tax = 0
    } = req.body;

    // Validar que se proporcionen items
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Debe proporcionar al menos un producto'
      });
    }

    // Validar que todos los productos existan y estén activos
    for (const item of items) {
      const product = await Product.findById(item.product);
      if (!product || !product.isActive) {
        return res.status(400).json({
          success: false,
          message: `Producto ${item.product} no disponible`
        });
      }
      
      // Validar stock disponible
      if (product.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Stock insuficiente para ${product.name}`
        });
      }
    }

    // Crear la orden
    const order = new Order({
      buyer: user._id,
      items: items.map(item => ({
        ...item,
        total: item.price * item.quantity
      })),
      shippingAddress,
      paymentMethod,
      subtotal,
      shippingCost,
      tax,
      total: subtotal + shippingCost + tax
    });

    await order.save();

    // Actualizar stock de productos y crear registros de compras/ventas
    for (const item of items) {
      // Actualizar stock del producto
      await Product.findByIdAndUpdate(
        item.product,
        { 
          $inc: { 
            stock: -item.quantity,
            salesCount: item.quantity
          }
        }
      );

      // Obtener información del producto y la tienda para los registros
      const product = await Product.findById(item.product).populate('store');
      const store = await Store.findById(item.store).populate('userId');

      // Crear registro de compra
      const purchase = new Purchase({
        order: order._id,
        buyer: user._id,
        product: item.product,
        store: item.store,
        quantity: item.quantity,
        unitPrice: item.price,
        totalAmount: item.total,
        paymentMethod: paymentMethod,
        paymentStatus: 'completed',
        status: 'completed'
      });

      await purchase.save();

      // Crear registro de venta
      const sale = new Sale({
        order: order._id,
        store: item.store,
        seller: store.userId._id,
        buyer: user._id,
        product: item.product,
        quantity: item.quantity,
        unitPrice: item.price,
        totalAmount: item.total,
        platformCommissionRate: 0.05, // 5% de comisión
        paymentMethod: paymentMethod,
        paymentStatus: 'completed',
        status: 'completed'
      });

      await sale.save();

  
    }

    // Poblar datos para la respuesta
    await order.populate([
      { path: 'buyer', select: 'name email' },
      { path: 'items.product', select: 'name images' },
      { path: 'items.store', select: 'description' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Orden creada exitosamente',
      data: order
    });

  } catch (error) {
    console.error('Error al crear orden:', error);
    
    // Si es error de autenticación, retornar 401
    if (error.message.includes('Token') || error.message.includes('Usuario')) {
      return res.status(401).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

/**
 * Obtener órdenes del usuario
 * GET /api/orders/my-orders
 */
const getMyOrders = async (req, res) => {
  try {
    // Verificar autenticación
    const user = await verifyToken(req);
    
    const { page = 1, limit = 10, status } = req.query;
    
    const filters = {
      buyer: user._id
    };
    
    if (status) {
      filters.status = status;
    }

    const orders = await Order.find(filters)
      .populate([
        { path: 'items.product', select: 'name images' },
        { path: 'items.store', select: 'description' }
      ])
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Order.countDocuments(filters);

    res.json({
      success: true,
      data: {
        orders,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Error al obtener mis órdenes:', error);
    
    // Si es error de autenticación, retornar 401
    if (error.message.includes('Token') || error.message.includes('Usuario')) {
      return res.status(401).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

/**
 * Obtener órdenes de una tienda
 * GET /api/orders/store/:storeId
 */
const getStoreOrders = async (req, res) => {
  try {
    const { storeId } = req.params;
    console.log('🔍 Buscando órdenes para tienda:', storeId);
    
    const { page = 1, limit = 10, status, startDate, endDate } = req.query;
    console.log('📄 Parámetros de consulta:', { page, limit, status, startDate, endDate });

    // Validar ObjectId del storeId
    let storeObjectId;
    try {
      storeObjectId = new mongoose.Types.ObjectId(storeId);
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: 'ID de tienda inválido'
      });
    }

    // Construir filtros base - usar $elemMatch para buscar en array de items
    const matchFilters = {
      items: {
        $elemMatch: {
          store: storeObjectId
        }
      }
    };
    
    // Agregar filtro de estado si se proporciona
    if (status) {
      matchFilters.status = status;
    }

    // Agregar filtros de fecha si se proporcionan
    if (startDate || endDate) {
      matchFilters.createdAt = {};
      if (startDate) {
        matchFilters.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        matchFilters.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
      }
    }
    
    console.log('🔍 Filtros aplicados:', JSON.stringify(matchFilters, null, 2));

    // Pipeline de agregación mejorado
    const aggregationPipeline = [
      // Paso 1: Filtrar órdenes que contengan items de la tienda
      { $match: matchFilters },
      
      // Paso 2: Filtrar items de la tienda específica y calcular totales
      {
        $addFields: {
          storeItems: {
            $filter: {
              input: '$items',
              cond: { $eq: ['$$this.store', storeObjectId] }
            }
          }
        }
      },
      
      // Paso 3: Calcular totales específicos de la tienda
      {
        $addFields: {
          storeSubtotal: {
            $sum: {
              $map: {
                input: '$storeItems',
                in: { $multiply: ['$$this.quantity', '$$this.price'] }
              }
            }
          },
          storeItemCount: { $size: '$storeItems' }
        }
      },
      
      // Paso 4: Lookup para información de productos
      {
        $lookup: {
          from: 'products',
          localField: 'storeItems.product',
          foreignField: '_id',
          as: 'productInfo'
        }
      },
      
      // Paso 5: Lookup para información del comprador
      {
        $lookup: {
          from: 'users',
          localField: 'buyer',
          foreignField: '_id',
          as: 'buyerInfo'
        }
      },
      
      // Paso 6: Procesar items con información de productos
      {
        $addFields: {
          processedItems: {
            $map: {
              input: '$storeItems',
              as: 'item',
              in: {
                $mergeObjects: [
                  '$$item',
                  {
                    product: {
                      $let: {
                        vars: {
                          productData: {
                            $arrayElemAt: [
                              {
                                $filter: {
                                  input: '$productInfo',
                                  cond: { $eq: ['$$this._id', '$$item.product'] }
                                }
                              },
                              0
                            ]
                          }
                        },
                        in: {
                          _id: '$$productData._id',
                          name: '$$productData.name',
                          images: '$$productData.images',
                          category: '$$productData.category',
                          price: '$$productData.price'
                        }
                      }
                    }
                  }
                ]
              }
            }
          }
        }
      },
      
      // Paso 7: Proyección final
      {
        $project: {
          _id: 1,
          orderNumber: 1,
          status: 1,
          paymentMethod: 1,
          paymentStatus: 1,
          createdAt: 1,
          updatedAt: 1,
          shippingAddress: 1,
          // Totales originales de la orden completa
          originalTotal: '$total',
          originalSubtotal: '$subtotal',
          shippingCost: 1,
          tax: 1,
          // Totales específicos de la tienda
          storeSubtotal: 1,
          storeItemCount: 1,
          // Items de la tienda con información de productos
          items: '$processedItems',
          // Información del comprador
          buyer: {
            $let: {
              vars: {
                buyerData: { $arrayElemAt: ['$buyerInfo', 0] }
              },
              in: {
                _id: '$$buyerData._id',
                name: '$$buyerData.name',
                email: '$$buyerData.email'
              }
            }
          }
        }
      },
      
      // Paso 8: Filtrar órdenes que tengan al menos un item de la tienda
      {
        $match: {
          storeItemCount: { $gt: 0 }
        }
      },
      
      // Paso 9: Ordenar por fecha de creación (más recientes primero)
      { $sort: { createdAt: -1 } }
    ];

    // Ejecutar agregación con paginación
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const paginatedPipeline = [
      ...aggregationPipeline,
      { $skip: skip },
      { $limit: parseInt(limit) }
    ];

    console.log('🔄 Ejecutando agregación...');
    const orders = await Order.aggregate(paginatedPipeline);

    // Contar total de documentos para paginación
    const countPipeline = [
      { $match: matchFilters },
      {
        $addFields: {
          storeItems: {
            $filter: {
              input: '$items',
              cond: { $eq: ['$$this.store', storeObjectId] }
            }
          }
        }
      },
      {
        $match: {
          $expr: { $gt: [{ $size: '$storeItems' }, 0] }
        }
      },
      { $count: 'total' }
    ];
    
    const countResult = await Order.aggregate(countPipeline);
    const total = countResult[0]?.total || 0;

    console.log(`✅ Encontradas ${orders.length} órdenes de un total de ${total} para la tienda ${storeId}`);

    // Calcular estadísticas adicionales
    const stats = {
      totalOrders: total,
      totalRevenue: orders.reduce((sum, order) => sum + (order.storeSubtotal || 0), 0),
      totalItems: orders.reduce((sum, order) => sum + (order.storeItemCount || 0), 0)
    };

    res.json({
      success: true,
      data: {
        orders,
        stats,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });

  } catch (error) {
    console.error('❌ Error al obtener órdenes de tienda:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

/**
 * Obtener detalles de una orden
 * GET /api/orders/:id
 */
const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate([
        { path: 'buyer', select: 'name email' },
        { path: 'items.product', select: 'name images price' },
        { path: 'items.store', select: 'description' }
      ]);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Orden no encontrada'
      });
    }

    res.json({
      success: true,
      data: order
    });

  } catch (error) {
    console.error('Error al obtener orden:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

/**
 * Actualizar estado de una orden
 * PUT /api/orders/:id/status
 */
const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const { id } = req.params;

    const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Estado de orden inválido'
      });
    }

    const order = await Order.findByIdAndUpdate(
      id,
      { 
        status,
        ...(status === 'shipped' && { shippedDate: new Date() }),
        ...(status === 'delivered' && { deliveredDate: new Date() }),
        ...(status === 'cancelled' && { cancelledDate: new Date() })
      },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Orden no encontrada'
      });
    }

    res.json({
      success: true,
      message: 'Estado de orden actualizado',
      data: order
    });

  } catch (error) {
    console.error('Error al actualizar estado de orden:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

/**
 * Crear datos de ejemplo para testing
 * POST /api/orders/seed
 */
const seedOrders = async (req, res) => {
  try {
    // Obtener algunos productos y tiendas para crear órdenes de ejemplo
    const products = await Product.find({ isActive: true }).limit(10);
    const stores = await Store.find().limit(5);
    
    if (products.length === 0 || stores.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Se necesitan productos y tiendas existentes para crear órdenes de ejemplo'
      });
    }

    const sampleOrders = [];
    const statuses = ['confirmed', 'processing', 'shipped', 'delivered'];
    
    // Crear 10 órdenes de ejemplo (reducido para testing)
    for (let i = 0; i < 10; i++) {
      try {
        const randomProducts = products.sort(() => 0.5 - Math.random()).slice(0, Math.floor(Math.random() * 2) + 1);
        
        const items = randomProducts.map(product => {
          const quantity = Math.floor(Math.random() * 2) + 1;
          const store = stores[Math.floor(Math.random() * stores.length)];
          
          return {
            product: product._id,
            store: store._id,
            quantity,
            price: product.price,
            total: product.price * quantity
          };
        });

        const subtotal = items.reduce((sum, item) => sum + item.total, 0);
        const shippingCost = 0; // Envío gratis
        const tax = subtotal * 0.13; // 13% IVA
        
        // Generar un número único usando timestamp + índice
        // const uniqueOrderNumber = `ORD-${Date.now()}-${i.toString().padStart(3, '0')}`;
        
        const orderData = {
          // orderNumber: uniqueOrderNumber, // Dejar que el modelo lo genere automáticamente
          buyer: '507f1f77bcf86cd799439011', // ID ficticio
          items,
          shippingAddress: {
            country: 'Costa Rica',
            provincia: 'San José',
            canton: 'San José',
            distrito: 'Carmen',
            numeroCasillero: '123'
          },
          paymentMethod: 'credit_card',
          paymentStatus: 'completed',
          subtotal,
          shippingCost,
          tax,
          total: subtotal + shippingCost + tax,
          status: statuses[Math.floor(Math.random() * statuses.length)]
        };

        // Crear orden individualmente
        const order = new Order(orderData);
        
        // Establecer fecha aleatoria después de crear el objeto
        order.createdAt = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000);
        
        await order.save();
        sampleOrders.push(order);
        
        // Pequeña pausa para evitar duplicados por timestamp
        await new Promise(resolve => setTimeout(resolve, 10));
        
      } catch (orderError) {
        console.error(`Error creando orden ${i}:`, orderError.message);
        continue; // Continuar con la siguiente orden
      }
    }

    res.json({
      success: true,
      message: `${sampleOrders.length} órdenes de ejemplo creadas exitosamente`,
      data: { 
        count: sampleOrders.length,
        orders: sampleOrders.map(o => ({ id: o._id, orderNumber: o.orderNumber, total: o.total }))
      }
    });

  } catch (error) {
    console.error('Error al crear órdenes de ejemplo:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

module.exports = {
  createOrder,
  getMyOrders,
  getStoreOrders,
  getOrderById,
  updateOrderStatus,
  seedOrders
};
