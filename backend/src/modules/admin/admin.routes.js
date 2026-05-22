const express = require('express');
const router = express.Router();
const adminController = require('./admin.controller');
const { authMiddleware, requireRole } = require('../../middlewares/auth.middleware');

// Todas las rutas de administración requieren estar autenticado y tener rol ADMINISTRADOR
router.use(authMiddleware);
router.use(requireRole(['ADMINISTRADOR']));

// Ruta de auditoría
router.get('/auditoria', adminController.getAuditoria);

// Rutas de gestión de usuarios y sus permisos
router.get('/usuarios', adminController.getUsuarios);
router.get('/permisos/:id_usuario', adminController.getPermisos);
router.put('/permisos/:id_usuario', adminController.updatePermisos);

module.exports = router;
