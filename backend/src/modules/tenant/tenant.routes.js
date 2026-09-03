const express = require('express');
const router = express.Router();
const tenantController = require('./tenant.controller');
const { authMiddleware, requireRole } = require('../../middlewares/auth.middleware');
const { manejarErroresDeSubida } = require('../../middlewares/subida.middleware');
const multer = require('multer');

const MAX_MB = 5;

// WebP se admite porque hoy es lo que descarga cualquier navegador: rechazarlo
// obligaba a convertir el archivo antes de subirlo, sin ninguna razón técnica.
// SVG se deja fuera a propósito: puede contener scripts, y el logotipo se sirve
// desde un dominio público.
const FORMATOS = {
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
  'image/webp': 'WebP',
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (FORMATOS[file.mimetype]) return cb(null, true);
    cb(new Error('Formato de archivo no soportado.'), false);
  },
});

const erroresDeSubida = manejarErroresDeSubida({
  maxMb: MAX_MB,
  formatos: Object.values(FORMATOS).join(', '),
});

router.get('/perfil', authMiddleware, tenantController.getPerfil);

// `erroresDeSubida` va justo después de multer: es donde Express entrega los
// errores que multer lanza antes de llegar al controlador. Sin él, un logotipo
// demasiado grande o en otro formato devolvía un 500 «Algo salió mal!».
router.put(
  '/perfil',
  authMiddleware,
  requireRole(['ADMINISTRADOR']),
  upload.single('logo'),
  erroresDeSubida,
  tenantController.updatePerfil
);

module.exports = router;
