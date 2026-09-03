const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const authController = require('./auth.controller');
const recuperacion = require('./recuperacion.controller');

const { authMiddleware } = require('../../middlewares/auth.middleware');

/**
 * Limitador para las rutas que ENVÍAN CORREO a una dirección indicada por quien
 * llama. Sin él, cualquiera podría usar la plataforma para inundar el buzón de
 * otra persona: escribe su correo, repite mil veces, y los mensajes salen
 * firmados por nosotros. Además de la molestia, quema la reputación del
 * remitente y acabaría mandando a spam el correo legítimo.
 *
 * El limitador general de la API (1000 cada 15 minutos) es inútil para esto.
 */
const limitadorCorreo = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Has solicitado demasiados correos. Espera unos minutos antes de volver a intentarlo.'
  },
});

// Registro de Tenant y Admin
router.post('/registro', authController.registro);

// Verificación de Email
router.get('/verificar/:token', authController.verificarEmail);

// Reenvío del correo de verificación (RF54)
router.post('/reenviar-verificacion', limitadorCorreo, recuperacion.reenviarVerificacion);

// Recuperación de contraseña (HU-01)
router.post('/recuperar', limitadorCorreo, recuperacion.solicitarRecuperacion);
router.post('/restablecer', recuperacion.restablecerPassword);

// Login
router.post('/login', authController.login);

// Verificación 2FA
router.post('/2fa/verificar', authController.verificar2FA);

// Cierre de sesión — deja constancia en la bitácora (RF05)
router.post('/logout', authMiddleware, authController.logout);

// Obtener Perfil de Usuario
router.get('/perfil', authMiddleware, authController.getPerfil);

// Actualizar Preferencias de Alertas
router.put('/preferencias', authMiddleware, authController.updatePreferencias);

// Fijar, cambiar o retirar el propio nombre de usuario (RF01.2)
router.patch('/nombre-usuario', authMiddleware, authController.actualizarNombreUsuario);

// Configurar 2FA (Requerirá auth)
router.post('/2fa/configurar', authMiddleware, authController.configurar2FA);

module.exports = router;
