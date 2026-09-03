/**
 * Nombre de usuario como segundo identificador de acceso — RF01.2 / HU-01.1.
 *
 * El enunciado siempre pidió entrar «con correo **o** nombre de usuario». El
 * sistema solo sabía lo primero porque no existía dónde guardar lo segundo.
 *
 * Vive aquí, y no dentro de un controlador, porque son tres los sitios que
 * fijan un nombre de usuario —registro del consultorio, alta de colaborador y
 * el perfil de cada persona— y una cuarta que lo lee, el login. La regla que
 * separa un correo de un nombre de usuario tiene que ser exactamente la misma
 * en los cuatro: si el login decide de una forma y el registro de otra, se
 * puede guardar un nombre que el login nunca buscará.
 */

const MINIMO = 3;
const MAXIMO = 30;

/**
 * Formato admitido: minúsculas, dígitos, punto, guion y guion bajo.
 *
 * Lo que queda fuera importa más que lo que entra:
 *
 *   · La arroba, sobre todo. Es lo que permite al login distinguir un correo de
 *     un nombre de usuario mirando el texto, sin preguntar y sin buscar dos
 *     veces. Y evita el abuso obvio: registrar el nombre "socia@bufete.com"
 *     para que quien teclee ese correo caiga en otra cuenta.
 *   · Los acentos y la eñe. Un identificador que se teclea a diario y se dicta
 *     por teléfono no debe depender de la distribución del teclado.
 *   · Los espacios, por lo mismo.
 */
const FORMATO = /^[a-z0-9._-]+$/;

/**
 * Normaliza antes de comparar y antes de guardar.
 *
 * A minúsculas SIEMPRE, en los dos extremos: si se guardara tal cual, "MRojas"
 * y "mrojas" serían dos cuentas distintas para la base de datos y la misma
 * persona para cualquiera que las lea. La unicidad se aplica sobre el texto ya
 * normalizado, así que la reserva del nombre no depende de las mayúsculas.
 */
function normalizar(valor) {
  if (typeof valor !== 'string') return '';
  return valor.trim().toLowerCase();
}

/**
 * ¿Este texto es un correo o un nombre de usuario?
 *
 * Única fuente de esa decisión. La arroba es la frontera, y el formato de
 * arriba la sostiene: ningún nombre de usuario válido puede contenerla.
 */
function pareceCorreo(identificador) {
  return typeof identificador === 'string' && identificador.includes('@');
}

/**
 * Comprueba un nombre de usuario propuesto.
 *
 * @returns {{valido: boolean, error: string|null, valor: string|null}}
 *          `valor` es el texto ya normalizado, listo para guardar.
 */
function validarNombreUsuario(valor) {
  const normalizado = normalizar(valor);

  if (!normalizado) {
    return { valido: false, error: 'El nombre de usuario es obligatorio', valor: null };
  }

  if (normalizado.length < MINIMO || normalizado.length > MAXIMO) {
    return {
      valido: false,
      error: `El nombre de usuario debe tener entre ${MINIMO} y ${MAXIMO} caracteres.`,
      valor: null,
    };
  }

  if (!FORMATO.test(normalizado)) {
    return {
      valido: false,
      error:
        'El nombre de usuario solo admite letras sin tilde, números, punto, guion y guion bajo. No puede llevar arroba ni espacios.',
      valor: null,
    };
  }

  // Un nombre que empieza o acaba en signo se confunde al leerlo y al dictarlo,
  // y ".ana" y "ana." se distinguen entre sí por un carácter que no se ve.
  if (/^[._-]/.test(normalizado) || /[._-]$/.test(normalizado)) {
    return {
      valido: false,
      error: 'El nombre de usuario debe empezar y terminar en letra o número.',
      valor: null,
    };
  }

  return { valido: true, error: null, valor: normalizado };
}

module.exports = {
  validarNombreUsuario,
  normalizar,
  pareceCorreo,
  MINIMO,
  MAXIMO,
};
