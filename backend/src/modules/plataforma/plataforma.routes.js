const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();

const controlador = require('./plataforma.controller');
const { plataformaMiddleware } = require('../../middlewares/plataforma.middleware');

/**
 * Rutas de administración de la PLATAFORMA.
 *
 * No hay ruta de registro a propósito: los administradores se crean solo con
 * `npm run crear-admin-plataforma` en el servidor. Una pantalla de alta sería
 * una puerta más expuesta a internet para la cuenta de mayor privilegio.
 */

// Limitador propio. Esta es la credencial más valiosa del sistema: el limitador
// general de la API (1000 peticiones cada 15 minutos) no sirve para protegerla.
//
// El margen es de 20 y no de 10 por una interacción concreta: la pantalla de
// acceso es única, así que cuando alguien falla la contraseña de SU consultorio
// el navegador prueba también aquí por si fuera un administrador de plataforma.
// Con un margen estrecho, un usuario torpe dejaría fuera al administrador que
// compartiera su dirección IP —en un despacho, todos.
//
// `skipSuccessfulRequests` hace que solo cuenten los intentos fallidos, que es
// lo que interesa frenar.
const limitadorLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Espere unos minutos.' },
});

router.post('/login', limitadorLogin, controlador.login);

// Todo lo demás exige una sesión de plataforma.
router.use(plataformaMiddleware);

router.get('/resumen', controlador.resumen);
router.get('/consultorios', controlador.listarConsultorios);
router.patch('/consultorios/:id/estado', controlador.cambiarEstadoConsultorio);
router.delete('/consultorios/:id', controlador.eliminarConsultorio);
router.get('/bitacora', controlador.bitacora);

module.exports = router;
