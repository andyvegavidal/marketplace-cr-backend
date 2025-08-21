const express = require('express');
const router = express.Router();

// Subir archivo genérico
router.post('/file',
  (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Archivo requerido'
        });
      }

      const fileUrl = getFileUrl(req, req.file.filename);

      res.json({
        success: true,
        message: 'Archivo subido exitosamente',
        data: {
          filename: req.file.filename,
          originalName: req.file.originalname,
          size: req.file.size,
          url: fileUrl
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error subiendo archivo'
      });
    }
  }
);

// Subir múltiples archivos
router.post('/files',
  (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Al menos un archivo es requerido'
        });
      }

      const files = req.files.map(file => ({
        filename: file.filename,
        originalName: file.originalname,
        size: file.size,
        url: getFileUrl(req, file.filename)
      }));

      res.json({
        success: true,
        message: 'Archivos subidos exitosamente',
        data: { files }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error subiendo archivos'
      });
    }
  }
);

module.exports = router;
