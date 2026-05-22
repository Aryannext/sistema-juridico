const express = require('express');
const router = express.Router();
const tenantController = require('./tenant.controller');
const { authMiddleware, requireRole } = require('../../middlewares/auth.middleware');
const multer = require('multer');

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
      cb(null, true);
    } else {
      cb(new Error('Formato de archivo no soportado. Solo JPG y PNG.'), false);
    }
  }
});

router.get('/perfil', authMiddleware, tenantController.getPerfil);
router.put('/perfil', authMiddleware, requireRole(['ADMINISTRADOR']), upload.single('logo'), tenantController.updatePerfil);

module.exports = router;
