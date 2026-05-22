const express = require('express');
const router = express.Router();
const multer = require('multer');
const documentosController = require('./documentos.controller');
const { authMiddleware } = require('../../middlewares/auth.middleware');
const requirePermission = require('../../middlewares/roles.middleware');
const auditMiddleware = require('../../middlewares/audit.middleware');

// Configure Multer for memory uploads (10MB limit as approved by user)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10 Megabytes
  }
});

// Protect all routes under this module
router.use(authMiddleware);

// POST /api/documentos - Upload a new file (v1)
router.post(
  '/',
  requirePermission('DOCS', 'CREAR'),
  upload.single('archivo'),
  auditMiddleware('DOCS'),
  documentosController.uploadDocumento
);

// POST /api/documentos/:id/version - Upload a new version for an existing file
router.post(
  '/:id/version',
  requirePermission('DOCS', 'CREAR'),
  upload.single('archivo'),
  auditMiddleware('DOCS'),
  documentosController.uploadNuevaVersion
);

// GET /api/documentos/proceso/:id_proceso - Get all documents of a process
router.get(
  '/proceso/:id_proceso',
  requirePermission('DOCS', 'LEER'),
  documentosController.getProcesoDocumentos
);

// GET /api/documentos/:id/versiones - Get all versions of a document
router.get(
  '/:id/versiones',
  requirePermission('DOCS', 'LEER'),
  documentosController.getDocumentoVersiones
);

// GET /api/documentos/download/:id_version - Get a signed secure url to download a version
router.get(
  '/download/:id_version',
  requirePermission('DOCS', 'LEER'),
  documentosController.getVersionDownloadUrl
);

// PATCH /api/documentos/:id/estado - Update document status
router.patch(
  '/:id/estado',
  requirePermission('DOCS', 'EDITAR'),
  auditMiddleware('DOCS'),
  documentosController.updateDocumentoEstado
);

// DELETE /api/documentos/:id/definitivo - Definitive delete of a document (Admin only)
router.delete(
  '/:id/definitivo',
  requirePermission('DOCS', 'ELIMINAR'),
  auditMiddleware('DOCS'),
  documentosController.deleteDocumentoDefinitivo
);

// DELETE /api/documentos/:id - Logical delete of a document
router.delete(
  '/:id',
  requirePermission('DOCS', 'ELIMINAR'),
  auditMiddleware('DOCS'),
  documentosController.deleteDocumento
);

module.exports = router;
