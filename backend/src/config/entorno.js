/**
 * Comprobaciones del entorno que se hacen ANTES de aceptar peticiones.
 *
 * Hasta ahora, sin `JWT_SECRET` el servidor arrancaba igual y fallaba en el
 * primer inicio de sesión, con un error de `jsonwebtoken` que no dice qué
 * falta. Peor aún: con la clave de ejemplo del `.env.example` arrancaba y
 * funcionaba, firmando tokens con un secreto que está publicado en el
 * repositorio. Cualquiera podría fabricar un token de administrador de
 * cualquier consultorio.
 *
 * Por eso se comprueba al arrancar y, si algo está mal, el proceso no llega a
 * escuchar: un contenedor que se reinicia en bucle con un mensaje claro se
 * detecta enseguida; uno que funciona con una clave conocida, no.
 */

/** Longitud mínima. `openssl rand -hex 32`, la orden del doc 12, da 64. */
const LONGITUD_MINIMA_JWT = 32;

/** Valores de ejemplo publicados en el repositorio: nunca son un secreto. */
const SECRETOS_DE_EJEMPLO = new Set([
  'clave-larga-y-aleatoria-de-al-menos-32-caracteres', // backend/.env.example y doc 09
  'pega-aqui-la-salida-de-openssl-rand-hex-32', // README
  'alguna_clave_secreta_aleatoria', // README, versiones anteriores
]);

/** Devuelve la lista de problemas encontrados; vacía si el entorno es válido. */
function problemasDelEntorno(env = process.env) {
  const problemas = [];
  const secreto = env.JWT_SECRET;

  if (!secreto) {
    problemas.push('JWT_SECRET no está definida.');
  } else if (SECRETOS_DE_EJEMPLO.has(secreto)) {
    problemas.push('JWT_SECRET tiene el valor de ejemplo del repositorio; genera uno con `openssl rand -hex 32`.');
  } else if (secreto.length < LONGITUD_MINIMA_JWT) {
    problemas.push(`JWT_SECRET tiene ${secreto.length} caracteres; el mínimo es ${LONGITUD_MINIMA_JWT}.`);
  }

  return problemas;
}

/** Lanza un error con todos los problemas juntos, para no corregirlos de uno en uno. */
function validarEntorno(env = process.env) {
  const problemas = problemasDelEntorno(env);
  if (problemas.length > 0) {
    throw new Error(`Configuración inválida, el servidor no arranca:\n  - ${problemas.join('\n  - ')}`);
  }
}

module.exports = { problemasDelEntorno, validarEntorno, LONGITUD_MINIMA_JWT };
