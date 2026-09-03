const express = require('express');
const router = express.Router();
const multer = require('multer');
const documentosController = require('./documentos.controller');
const { authMiddleware } = require('../../middlewares/auth.middleware');
const requirePermission = require('../../middlewares/roles.middleware');
const auditMiddleware = require('../../middlewares/audit.middleware');

const { manejarErroresDeSubida } = require('../../middlewares/subida.middleware');

const MAX_MB = 10;

/**
 * Formatos admitidos en un expediente judicial (RF18).
 *
 * Antes NO había ningún filtro: se podía adjuntar un ejecutable a un
 * expediente, y quedaba almacenado y disponible para descarga. En un sistema
 * que comparten varios usuarios de un despacho, eso es una vía para distribuir
 * un archivo dañino con la apariencia de una prueba documental.
 *
 * La lista cubre lo que de verdad se aporta a un proceso: escritos, pruebas
 * escaneadas, fotografías y hojas de cálculo.
 */
const FORMATOS = {
  'application/pdf': 'PDF',
  'application/msword': 'DOC',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'application/vnd.ms-excel': 'XLS',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
  'image/webp': 'WebP',
  'image/tiff': 'TIFF',
  'text/plain': 'TXT',
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (FORMATOS[file.mimetype]) return cb(null, true);
    cb(new Error('Formato de archivo no soportado.'), false);
  },
});

// Va inmediatamente después de multer en cada ruta de subida: es donde Express
// entrega los errores que multer lanza antes de llegar al controlador. Sin
// esto, un archivo de más de 10 MB devolvía un 500 «Algo salió mal!».
const erroresDeSubida = manejarErroresDeSubida({
  maxMb: MAX_MB,
  formatos: Object.values(FORMATOS).join(', '),
});

// Protect all routes under this module
router.use(authMiddleware);

// POST /api/documentos - Upload a new file (v1)
router.post(
  '/',
  requirePermission('DOCS', 'CREAR'),
  upload.single('archivo'),
  erroresDeSubida,
  auditMiddleware('DOCS'),
  documentosController.uploadDocumento
);

// POST /api/documentos/:id/version - Upload a new version for an existing file
router.post(
  '/:id/version',
  requirePermission('DOCS', 'CREAR'),
  upload.single('archivo'),
  erroresDeSubida,
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
