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

/**
 * Limitador dedicado del inicio de sesión — RNF02.8.
 *
 * **Qué protege que el bloqueo por usuario no protege.** La cuenta se bloquea
 * tras 5 intentos fallidos, y eso frena el ataque contra *una* cuenta concreta.
 * No frena el reparto: probar una contraseña común contra cientos de correos
 * distintos nunca llega a 5 fallos en ninguna cuenta, así que el bloqueo por
 * usuario no se dispara jamás. Ese ataque se corta por origen, no por destino.
 *
 * **Por qué 20 y por qué solo cuentan los fallos.** `skipSuccessfulRequests`
 * hace que un acceso correcto no consuma cupo: en un despacho todos comparten
 * la misma dirección IP, y sin eso una mañana de trabajo normal dejaría a la
 * oficina entera fuera. Con 20 fallos cada 15 minutos, un despacho torpe cabe
 * de sobra y un ataque queda en 80 intentos por hora, que no sirve para nada.
 *
 * El margen coincide a propósito con el de `/api/plataforma/login`: la pantalla
 * de acceso es única, y cuando alguien falla la contraseña de su consultorio el
 * navegador prueba también la otra vía. Dos umbrales distintos harían que el
 * primero en agotarse dependiera de un detalle de la interfaz.
 */
const limitadorLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Demasiados intentos de acceso fallidos desde esta conexión. Espera unos minutos.'
  },
});

// Login
router.post('/login', limitadorLogin, authController.login);

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
