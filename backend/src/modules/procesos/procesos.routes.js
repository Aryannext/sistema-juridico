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

module.exports = router;
