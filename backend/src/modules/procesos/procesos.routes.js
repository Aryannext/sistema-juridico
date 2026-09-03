const express = require('express');
const router = express.Router();
const procesosController = require('./procesos.controller');
const { authMiddleware } = require('../../middlewares/auth.middleware');
const requirePermission = require('../../middlewares/roles.middleware');
const auditMiddleware = require('../../middlewares/audit.middleware');

router.use(authMiddleware);

router.post('/', requirePermission('PROCESOS', 'CREAR'), auditMiddleware('PROCESOS'), procesosController.createProceso);
router.get('/', requirePermission('PROCESOS', 'LEER'), procesosController.getProcesos);
// Va ANTES que '/:id': si no, Express interpretaría "atencion" como un id.
router.get('/atencion', requirePermission('PROCESOS', 'LEER'), procesosController.getProcesosAtencion);
router.get('/:id', requirePermission('PROCESOS', 'LEER'), procesosController.getProcesoById);
router.put('/:id', requirePermission('PROCESOS', 'EDITAR'), auditMiddleware('PROCESOS'), procesosController.updateProceso);

// Sprint 2 routes
router.post('/:id/abogados', requirePermission('PROCESOS', 'EDITAR'), auditMiddleware('PROCESOS'), procesosController.addAbogadoProceso);
router.delete('/:id/abogados/:id_usuario', requirePermission('PROCESOS', 'EDITAR'), auditMiddleware('PROCESOS'), procesosController.removeAbogadoProceso);
router.put('/:id/estado', requirePermission('PROCESOS', 'EDITAR'), auditMiddleware('PROCESOS'), procesosController.cambiarEstadoProceso);
// RN04: relevo del abogado responsable. Exige justificación escrita.
router.put('/:id/responsable', requirePermission('PROCESOS', 'EDITAR'), auditMiddleware('PROCESOS'), procesosController.cambiarResponsable);
router.post('/:id/partes', requirePermission('PROCESOS', 'EDITAR'), auditMiddleware('PROCESOS'), procesosController.addParteProcesal);
router.delete('/:id/partes/:id_parte', requirePermission('PROCESOS', 'EDITAR'), auditMiddleware('PROCESOS'), procesosController.removeParteProcesal);
router.delete('/:id', requirePermission('PROCESOS', 'ELIMINAR'), auditMiddleware('PROCESOS'), procesosController.deleteProcesoDefinitivo);

module.exports = router;
