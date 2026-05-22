const express = require('express');
const router = express.Router();
const notificacionesController = require('./notificaciones.controller');
const { authMiddleware } = require('../../middlewares/auth.middleware');

// Proteger todas las rutas del módulo
router.use(authMiddleware);

// GET /api/notificaciones - Listar alertas activas del usuario
router.get('/', notificacionesController.getNotificacionesUsuario);

// PUT /api/notificaciones/:id/gestionar - Resolver/Cerrar una alerta con validaciones
router.put('/:id/gestionar', notificacionesController.gestionarNotificacion);

module.exports = router;
