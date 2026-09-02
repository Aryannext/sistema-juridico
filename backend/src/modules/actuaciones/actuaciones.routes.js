const express = require('express');
const router = express.Router();
const actuacionesController = require('./actuaciones.controller');
const { authMiddleware } = require('../../middlewares/auth.middleware');
const requirePermission = require('../../middlewares/roles.middleware');
const auditMiddleware = require('../../middlewares/audit.middleware');

// Todas las rutas del módulo requieren autenticación
router.use(authMiddleware);

// La actuación forma parte del expediente, por lo que reutiliza los permisos
// del módulo PROCESOS. No se creó un módulo de permisos nuevo a propósito:
// añadir un valor a ModuloPermiso dejaría a los usuarios existentes sin fila
// de permisos y el middleware les respondería 403.
// Ver docs/11-DECISIONES-ARQUITECTONICAS.md (ADR-010).

// POST /api/actuaciones - Registrar una actuación procesal
router.post(
  '/',
  requirePermission('PROCESOS', 'CREAR'),
  auditMiddleware('ACTUACIONES'),
  actuacionesController.createActuacion
);

// GET /api/actuaciones/proceso/:id_proceso - Actuaciones de un expediente
router.get(
  '/proceso/:id_proceso',
  requirePermission('PROCESOS', 'LEER'),
  actuacionesController.getActuacionesProceso
);

// PUT /api/actuaciones/:id - Corregir una actuación
router.put(
  '/:id',
  requirePermission('PROCESOS', 'EDITAR'),
  auditMiddleware('ACTUACIONES'),
  actuacionesController.updateActuacion
);

// DELETE /api/actuaciones/:id - Eliminar una actuación (solo ADMINISTRADOR)
router.delete(
  '/:id',
  requirePermission('PROCESOS', 'ELIMINAR'),
  auditMiddleware('ACTUACIONES'),
  actuacionesController.deleteActuacion
);

module.exports = router;
