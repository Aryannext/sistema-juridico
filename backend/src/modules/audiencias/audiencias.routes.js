const express = require('express');
const router = express.Router();
const audienciasController = require('./audiencias.controller');
const { authMiddleware } = require('../../middlewares/auth.middleware');
const requirePermission = require('../../middlewares/roles.middleware');
const auditMiddleware = require('../../middlewares/audit.middleware');

// Apply authentication middleware to all routes
router.use(authMiddleware);

// POST /api/audiencias - Program a new hearing
router.post(
  '/',
  requirePermission('AUDIENCIAS', 'CREAR'),
  auditMiddleware('AUDIENCIAS'),
  audienciasController.createAudiencia
);

// GET /api/audiencias - Get the general legal agenda for the consultorio
router.get(
  '/',
  requirePermission('AUDIENCIAS', 'LEER'),
  audienciasController.getAgendaTenant
);

// GET /api/audiencias/proceso/:id_proceso - Get hearings of a specific legal process
router.get(
  '/proceso/:id_proceso',
  requirePermission('AUDIENCIAS', 'LEER'),
  audienciasController.getAudienciasProceso
);

// PUT /api/audiencias/:id - Update or reschedule a hearing
router.put(
  '/:id',
  requirePermission('AUDIENCIAS', 'EDITAR'),
  auditMiddleware('AUDIENCIAS'),
  audienciasController.updateAudiencia
);

module.exports = router;
