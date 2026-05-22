const express = require('express');
const router = express.Router();
const clientesController = require('./clientes.controller');
const { authMiddleware } = require('../../middlewares/auth.middleware');
const requirePermission = require('../../middlewares/roles.middleware');
const auditMiddleware = require('../../middlewares/audit.middleware');

router.use(authMiddleware);

router.post('/', requirePermission('CLIENTES', 'CREAR'), auditMiddleware('CLIENTES'), clientesController.createCliente);
router.get('/', requirePermission('CLIENTES', 'LEER'), clientesController.getClientes);
router.get('/:id', requirePermission('CLIENTES', 'LEER'), clientesController.getClienteById);
router.put('/:id', requirePermission('CLIENTES', 'EDITAR'), auditMiddleware('CLIENTES'), clientesController.updateCliente);

module.exports = router;
