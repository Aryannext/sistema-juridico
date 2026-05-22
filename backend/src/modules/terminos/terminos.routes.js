const express = require('express');
const router = express.Router();
const terminosController = require('./terminos.controller');
const { authMiddleware } = require('../../middlewares/auth.middleware');
const requirePermission = require('../../middlewares/roles.middleware');
const auditMiddleware = require('../../middlewares/audit.middleware');

// Apply auth middleware to all routes
router.use(authMiddleware);

// POST /api/terminos - Create a court deadline
router.post(
  '/',
  requirePermission('TERMINO', 'CREAR'),
  auditMiddleware('TERMINO'),
  terminosController.createTermino
);

// GET /api/terminos/vencimientos - Get pending critical deadlines for the dashboard
router.get(
  '/vencimientos',
  requirePermission('TERMINO', 'LEER'),
  terminosController.getAlertasVencimientos
);

// GET /api/terminos/proceso/:id_proceso - Get deadlines associated to a process
router.get(
  '/proceso/:id_proceso',
  requirePermission('TERMINO', 'LEER'),
  terminosController.getProcesoTerminos
);

// PUT /api/terminos/:id/gestion - Resolve a deadline with a justification
router.put(
  '/:id/gestion',
  requirePermission('TERMINO', 'EDITAR'),
  auditMiddleware('TERMINO'),
  terminosController.gestionarTermino
);

module.exports = router;
