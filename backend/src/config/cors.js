/**
 * Orígenes a los que el navegador puede llamar la API desde otro dominio.
 *
 * Antes se usaba `cors()` sin opciones, que responde
 * `Access-Control-Allow-Origin: *` a cualquiera: cualquier página de internet
 * podía leer las respuestas de la API desde el navegador de un usuario. Con el
 * token en `localStorage` no viaja solo —no es una cookie—, pero abrir la API
 * a todos los orígenes no aporta nada y quita una capa de defensa.
 *
 * ── Por qué en producción casi no hace falta ────────────────────────────
 *
 * En el VPS el frontend y la API comparten dominio: Nginx sirve la SPA en
 * `/sistema-juridico/` y reenvía `/sistema-juridico/api/` al contenedor. Una
 * llamada al mismo origen no necesita cabeceras CORS. Donde sí hace falta es en
 * desarrollo, con Vite en el 5173 y la API en el 3000.
 *
 * ── De dónde sale la lista ──────────────────────────────────────────────
 *
 *   1. `CORS_ORIGENES`, separados por comas, si está definida.
 *   2. Si no, el origen de `FRONTEND_URL`, que ya existe para los enlaces del
 *      correo y apunta al frontend que corresponde a cada entorno.
 *   3. Si tampoco está, ninguno: solo funcionan las llamadas del mismo origen.
 *
 * Un origen que no está en la lista no recibe la cabecera y el navegador
 * bloquea la respuesta. La petición no se rechaza en el servidor, porque las
 * herramientas sin navegador (curl, el vigilante externo) no envían `Origin`
 * y no deben quedarse fuera.
 */

/** Convierte una URL en su origen (`esquema://host:puerto`), o null si no es válida. */
function aOrigen(url) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function origenesPermitidos(env = process.env) {
  if (env.CORS_ORIGENES) {
    return env.CORS_ORIGENES.split(',')
      .map((o) => aOrigen(o.trim()))
      .filter(Boolean);
  }

  const delFrontend = env.FRONTEND_URL ? aOrigen(env.FRONTEND_URL) : null;
  return delFrontend ? [delFrontend] : [];
}

function opcionesCors(env = process.env) {
  return { origin: origenesPermitidos(env) };
}

module.exports = { origenesPermitidos, opcionesCors };
