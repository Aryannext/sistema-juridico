const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');

// Registro de Tenant y Admin
router.post('/registro', authController.registro);

// Verificación de Email
router.get('/verificar/:token', authController.verificarEmail);

// Login
router.post('/login', authController.login);

// Verificación 2FA
router.post('/2fa/verificar', authController.verificar2FA);

// Configurar 2FA (Requerirá auth, lo añadiremos luego con middleware)
router.post('/2fa/configurar', authController.configurar2FA);

module.exports = router;
