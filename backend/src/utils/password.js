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
  // HU-01.6 pedía "mínimo 8 caracteres, mayúscula, número y carácter especial"
  // desde el principio, y el criterio figuraba como cumplido. No lo estaba: de
  // las cuatro exigencias solo se comprobaban tres, y "Segura2026" pasaba.
  //
  // Se añadió el 3 de septiembre de 2026, al revisar HU-01 entera. No invalida
  // ninguna contraseña existente —esta comprobación solo corre al fijar una
  // nueva: registro, restablecimiento y alta de colaborador—, así que nadie se
  // queda fuera; solo se aplica de aquí en adelante.
  //
  // El conjunto se define por exclusión (ni letra, ni dígito, ni espacio) en vez
  // de por una lista de signos permitidos: una lista deja fuera lo que no se le
  // ocurrió a quien la escribió, y rechazar un carácter que el usuario eligió a
  // conciencia empuja hacia contraseñas más pobres, no más seguras.
  {
    prueba: (v) => /[^\p{L}\p{N}\s]/u.test(v),
    falta: 'un carácter especial',
  },
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
