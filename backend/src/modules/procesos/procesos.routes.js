const express = require('express');
const router = express.Router();
const procesosController = require('./procesos.controller');
const { authMiddleware } = require('../../middlewares/auth.middleware');
const requirePermission = require('../../middlewares/roles.middleware');
const auditMiddleware = require('../../middlewares/audit.middleware');

router.use(authMiddleware);

router.post('/', requirePermission('PROCESOS', 'CREAR'), auditMiddleware('PROCESOS'), procesosController.createProceso);
router.get('/', requirePermission('PROCESOS', 'LEER'), procesosController.getProcesos);
router.get('/:id', requirePermission('PROCESOS', 'LEER'), procesosController.getProcesoById);
router.put('/:id', requirePermission('PROCESOS', 'EDITAR'), auditMiddleware('PROCESOS'), procesosController.updateProceso);

// Sprint 2 routes
router.post('/:id/abogados', requirePermission('PROCESOS', 'EDITAR'), auditMiddleware('PROCESOS'), procesosController.addAbogadoProceso);
router.delete('/:id/abogados/:id_usuario', requirePermission('PROCESOS', 'EDITAR'), auditMiddleware('PROCESOS'), procesosController.removeAbogadoProceso);
router.put('/:id/estado', requirePermission('PROCESOS', 'EDITAR'), auditMiddleware('PROCESOS'), procesosController.cambiarEstadoProceso);
router.post('/:id/partes', requirePermission('PROCESOS', 'EDITAR'), auditMiddleware('PROCESOS'), procesosController.addParteProcesal);
router.delete('/:id/partes/:id_parte', requirePermission('PROCESOS', 'EDITAR'), auditMiddleware('PROCESOS'), procesosController.removeParteProcesal);
router.delete('/:id', requirePermission('PROCESOS', 'ELIMINAR'), auditMiddleware('PROCESOS'), procesosController.deleteProcesoDefinitivo);

module.exports = router;
