const express = require('express');
const router = express.Router();

const productController = require('../controllers/productController');

// Rutas públicas
router.get('/', 
  productController.getProducts
);

router.get('/categories', productController.getCategories);

router.get('/:id', 
  productController.getProductById
);

router.get('/:id/related',
  productController.getRelatedProducts
);

// Rutas para tiendas

router.post('/createproduct',
  productController.createProduct
);

router.put('/:id',
  productController.updateProduct
);

router.delete('/:id',
  productController.deleteProduct
);

// Subir imágenes adicionales a un producto existente
router.post('/:id/images',
  async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Al menos una imagen es requerida'
        });
      }

      const Product = require('../models/Product');
      const Store = require('../models/Store');

      const product = await Product.findById(req.params.id);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Producto no encontrado'
        });
      }

      // Verificar que el producto pertenece a la tienda del usuario
      const store = await Store.findOne({ userId: req.user._id });
      if (!product.storeId.equals(store._id)) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para modificar este producto'
        });
      }

      // Agregar nuevas imágenes
      const newImages = req.files.map(file => `/uploads/${file.filename}`);
      product.images.push(...newImages);
      await product.save();

      res.json({
        success: true,
        message: 'Imágenes agregadas exitosamente',
        data: {
          newImages,
          totalImages: product.images.length
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

// Eliminar imagen específica de un producto
router.delete('/:id/images/:imageIndex',
  async (req, res) => {
    try {
      const { id, imageIndex } = req.params;
      const Product = require('../models/Product');
      const Store = require('../models/Store');

      const product = await Product.findById(id);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Producto no encontrado'
        });
      }

      // Verificar permisos
      const store = await Store.findOne({ userId: req.user._id });
      if (!product.storeId.equals(store._id)) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para modificar este producto'
        });
      }

      const index = parseInt(imageIndex);
      if (index < 0 || index >= product.images.length) {
        return res.status(400).json({
          success: false,
          message: 'Índice de imagen inválido'
        });
      }

      if (product.images.length <= 1) {
        return res.status(400).json({
          success: false,
          message: 'No puedes eliminar la última imagen del producto'
        });
      }

      // Eliminar imagen del array
      const removedImage = product.images.splice(index, 1)[0];
      await product.save();

      // Opcionalmente eliminar archivo físico
      // const { deleteFile } = require('../middleware/uploadMiddleware');
      // const imagePath = `uploads/${removedImage.split('/').pop()}`;
      // deleteFile(imagePath);

      res.json({
        success: true,
        message: 'Imagen eliminada exitosamente',
        data: {
          removedImage,
          remainingImages: product.images
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

module.exports = router;
