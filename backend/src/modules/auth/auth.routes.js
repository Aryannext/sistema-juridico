const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');

const { authMiddleware } = require('../../middlewares/auth.middleware');

// Registro de Tenant y Admin
router.post('/registro', authController.registro);

// Verificación de Email
router.get('/verificar/:token', authController.verificarEmail);

// Login
router.post('/login', authController.login);

// Verificación 2FA
router.post('/2fa/verificar', authController.verificar2FA);

// Obtener Perfil de Usuario
router.get('/perfil', authMiddleware, authController.getPerfil);

// Actualizar Preferencias de Alertas
router.put('/preferencias', authMiddleware, authController.updatePreferencias);

// Configurar 2FA (Requerirá auth)
router.post('/2fa/configurar', authMiddleware, authController.configurar2FA);

module.exports = router;
