/**
 * Política de contraseñas — RNF02.
 *
 * Hasta ahora solo la comprobaba el formulario del navegador. La validación de
 * cliente es usabilidad; la de servidor es seguridad: una petición directa a
 * `POST /api/auth/registro` aceptaba la contraseña "1".
 *
 * Vive aquí, y no dentro del controlador, para que los tres sitios que fijan
 * una contraseña —registro, restablecimiento y alta de usuarios— apliquen
 * exactamente la misma regla. Tres copias serían tres sitios donde relajarla
 * por descuido.
 */

const MINIMO = 8;

const REGLAS = [
  { prueba: (v) => v.length >= MINIMO, falta: `al menos ${MINIMO} caracteres` },
  { prueba: (v) => /[A-ZÁÉÍÓÚÑ]/.test(v), falta: 'una letra mayúscula' },
  { prueba: (v) => /[a-záéíóúñ]/.test(v), falta: 'una letra minúscula' },
  { prueba: (v) => /[0-9]/.test(v), falta: 'un número' },
];

/**
 * Comprueba una contraseña.
 * @returns {{valida: boolean, error: string|null}}
 */
function validarPassword(password) {
  if (typeof password !== 'string' || !password) {
    return { valida: false, error: 'La contraseña es obligatoria' };
  }

  const faltantes = REGLAS.filter((r) => !r.prueba(password)).map((r) => r.falta);

  if (faltantes.length === 0) return { valida: true, error: null };

  // Se enumera TODO lo que falta de una vez. Decirlo de uno en uno obliga a
  // reintentar varias veces para descubrir el conjunto de requisitos.
  const lista =
    faltantes.length === 1
      ? faltantes[0]
      : `${faltantes.slice(0, -1).join(', ')} y ${faltantes[faltantes.length - 1]}`;

  return { valida: false, error: `La contraseña debe tener ${lista}.` };
}

module.exports = { validarPassword, MINIMO };
