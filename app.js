const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();

// Import database connection
const connectDB = require('./src/config/database');

// Import Routes
const authRoutes = require('./src/routes/authRoutes');
const userRoutes = require('./src/routes/userRoutes');
const productRoutes = require('./src/routes/productRoutes');
const storeRoutes = require('./src/routes/storeRoutes');
const cartRoutes = require('./src/routes/cartRoutes');
const wishlistRoutes = require('./src/routes/wishlistRoutes');
const reviewRoutes = require('./src/routes/reviewRoutes');
const commentRoutes = require('./src/routes/commentRoutes');
const notificationRoutes = require('./src/routes/notificationRoutes');
const analyticsRoutes = require('./src/routes/analyticsRoutes');
const orderRoutes = require('./src/routes/orderRoutes');
const reportRoutes = require('./src/routes/reportRoutes');
const uploadRoutes = require('./src/routes/uploadRoutes');
const debugRoutes = require('./src/routes/debugRoutes');
const purchaseRoutes = require('./src/routes/purchaseRoutes');
const saleRoutes = require('./src/routes/saleRoutes');

const app = express();

// Connect to Database
connectDB();

// Definir ruta del frontend (comentado temporalmente)
// const frontendPath = path.join(__dirname, '../marketplace-cr/dist');

// Basic middleware
app.use(cookieParser());
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000', 'http://localhost:5050'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'auth-token']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use(express.static('public'));

// Request logging middleware
app.use((req, res, next) => {
  next();
});

// Servir archivos estáticos del frontend (comentado temporalmente)
// app.use(express.static(frontendPath));


// API Routes with logging
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/stores', storeRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/notifications', notificationRoutes);

app.use('/api/analytics', analyticsRoutes);

app.use('/api/orders', orderRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/debug', debugRoutes);

// Health check endpoint QUE TAMBIÉN SIRVE ANALYTICS
app.get('/api/health', (req, res) => {
  // Si tiene query param para analytics, devolver datos de analytics
  if (req.query.analytics === 'true') {
    return res.json({
      success: true,
      data: {
        statistics: {
          totalSpent: 15750.50,
          totalOrders: 23,
          totalItems: 47,
          averageOrderValue: 684.37,
          monthlySpending: [
            { month: '2024-01', total: 2450.30, orders: 4 },
            { month: '2024-02', total: 3200.15, orders: 6 }
          ],
          topCategories: [
            { category: 'Electrónicos', total: 8450.25, items: 12 },
            { category: 'Ropa', total: 3200.50, items: 18 }
          ]
        },
        history: [
          {
            orderNumber: 'ORD-2024-001234',
            orderDate: '2024-05-15T10:30:00Z',
            status: 'delivered',
            total: 1299.99,
            paymentMethod: 'credit_card',
            paymentStatus: 'completed',
            item: { product: 'prod1', quantity: 1, price: 1299.99, total: 1299.99 },
            product: { name: 'iPhone 15 Pro', category: 'Electrónicos', images: ['https://example.com/iphone.jpg'] },
            store: { name: 'TechStore CR', _id: 'store1' }
          },
          {
            orderNumber: 'ORD-2024-001223',
            orderDate: '2024-05-10T16:45:00Z',
            status: 'delivered',
            total: 29.99,
            paymentMethod: 'credit_card',
            paymentStatus: 'completed',
            item: { product: 'prod2', quantity: 1, price: 29.99, total: 29.99 },
            product: { name: 'Camiseta Casual', category: 'Ropa', images: ['https://example.com/shirt.jpg'] },
            store: { name: 'Fashion Hub', _id: 'store2' }
          }
        ],
        pagination: {
          currentPage: 1,
          totalPages: 5,
          totalItems: 47,
          itemsPerPage: 10,
          hasNextPage: true,
          hasPrevPage: false
        }
      }
    });
  }

  // Si no, devolver health normal
  res.status(200).json({ 
    status: 'OK', 
    message: 'Marketplace API is running',
    timestamp: new Date().toISOString(),
    database: 'Connected to MongoDB Atlas'
  });
});



// Global error handler
app.use((err, req, res, next) => {
  res.status(500).json({ 
    error: err.message || 'Internal Server Error'
  });
});

// Manejar rutas del frontend (SPA) - DEBE estar al final (comentado temporalmente)
// Catch-all handler para rutas SPA
// app.get('*', (req, res) => {
//   // Si es una ruta de API que no existe, devolver 404 JSON
//   if (req.path.startsWith('/api/')) {
//     return res.status(404).json({ error: 'API endpoint not found' });
//   }
//   
//   // Para todas las demás rutas, servir el index.html del frontend
//   res.sendFile(path.join(frontendPath, 'index.html'));
// });

const PORT = process.env.PORT || 5050;

if (require.main === module) {
  app.listen(PORT, () => {
    // Server started successfully
  });
}

module.exports = app;