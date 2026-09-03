/**
 * Validación del cliente en el servidor — RF06.
 *
 * Antes solo validaba el navegador. Una petición directa a la API sin `nombre`
 * llegaba hasta Prisma, que fallaba con un error de columna obligatoria y el
 * usuario recibía un **500 opaco** en lugar de saber qué le faltaba. Peor: un
 * cliente jurídico podía guardarse sin razón social ni NIT, porque esas
 * columnas admiten nulo en la base para poder compartir tabla con las personas
 * naturales.
 *
 * La regla que la base no puede expresar —«si es jurídica, la razón social es
 * obligatoria»— tiene que vivir aquí.
 */

const TIPOS = ['NATURAL', 'JURIDICA'];

/** Campos que exige la base para cualquier cliente, sea del tipo que sea. */
const COMUNES = [
  ['tipo_documento', 'el tipo de documento'],
  ['numero_documento', 'el número de documento'],
  ['telefono', 'el teléfono'],
  ['email', 'el correo electrónico'],
];

/** Lo que distingue a cada tipo de persona (RF06). */
const SEGUN_TIPO = {
  NATURAL: [['nombre', 'el nombre']],
  JURIDICA: [
    ['razon_social', 'la razón social'],
    ['nit', 'el NIT'],
    ['representante', 'el representante legal'],
  ],
};

const vacio = (v) => v === undefined || v === null || String(v).trim() === '';

/**
 * Une los que faltan en una sola frase.
 *
 * Se enumeran **todos de una vez** y no de uno en uno: obligar a reenviar el
 * formulario para descubrir el siguiente campo que falta es una forma
 * innecesaria de hacer perder el tiempo.
 */
function enumerar(faltantes) {
  if (faltantes.length === 1) return faltantes[0];
  return `${faltantes.slice(0, -1).join(', ')} y ${faltantes[faltantes.length - 1]}`;
}

/**
 * @returns {{valido: boolean, error?: string}}
 */
function validarCliente(datos = {}) {
  if (vacio(datos.tipo) || !TIPOS.includes(datos.tipo)) {
    return { valido: false, error: 'Indica si el cliente es una persona natural o jurídica.' };
  }

  const faltantes = [...COMUNES, ...SEGUN_TIPO[datos.tipo]]
    .filter(([campo]) => vacio(datos[campo]))
    .map(([, nombre]) => nombre);

  if (faltantes.length > 0) {
    return { valido: false, error: `Faltan datos obligatorios: ${enumerar(faltantes)}.` };
  }

  // El correo se comprueba de forma deliberadamente laxa: basta con que tenga
  // forma de dirección. Una expresión estricta rechaza direcciones válidas y
  // poco comunes, y aquí el coste de un falso rechazo es mayor que el de dejar
  // pasar un correo mal escrito, que además se descubre al primer envío.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(datos.email).trim())) {
    return { valido: false, error: 'El correo electrónico no tiene un formato válido.' };
  }

  return { valido: true };
}

module.exports = { validarCliente, TIPOS };
