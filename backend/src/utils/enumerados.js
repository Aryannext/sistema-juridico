/**
 * Los valores de enumerado que la API acepta del cliente, en un solo sitio.
 *
 * ── Por qué existe este archivo ─────────────────────────────────────────
 *
 * El mismo defecto ha aparecido **seis veces** en este proyecto, siempre con
 * la misma forma: un campo de enumerado llega en la petición, se vuelca en
 * Prisma sin mirarlo, y un valor inventado revienta contra la restricción de
 * la base devolviendo un **500 que no explica nada**.
 *
 *   · el tamaño del archivo (RF18)        · la categoría documental (RF19)
 *   · el tipo de actuación (RF56)         · el estado de la audiencia
 *   · la visibilidad del documento        · el tipo de parte procesal
 *
 * Se corrigió cuatro veces por separado, escribiendo la lista otra vez en cada
 * controlador. Eso no arregla el patrón: lo reproduce. Mientras la lista viva
 * junto al código que la usa, el próximo campo nuevo nacerá sin validar y nadie
 * lo notará hasta que alguien reciba el 500.
 *
 * Aquí están todas, y `enumerados.test.js` comprueba que coincidan con
 * `schema.prisma`. Si alguien añade un valor al esquema y olvida este archivo,
 * la prueba falla y lo dice.
 */

const ENUMERADOS = {
  CategoriaDocumento: ['DEMANDA', 'PRUEBA', 'CONTRATO', 'ESCRITO', 'NOTIFICACION', 'PROVIDENCIA', 'OTRO'],
  VisibilidadDocumento: ['PRIVADO', 'COMPARTIDO_CLIENTE', 'VISIBLE_COLAB'],
  EstadoDocumento: ['ACTIVO', 'INACTIVO', 'REEMPLAZADO'],
  EstadoAudiencia: ['PROGRAMADA', 'REALIZADA', 'CANCELADA'],
  EstadoProceso: ['ACTIVO', 'SUSPENDIDO', 'ARCHIVADO', 'FINALIZADO'],
  EstadoTermino: ['PENDIENTE', 'CUMPLIDO', 'CUMPLIDO_TARDIO', 'INCUMPLIDO'],
  TipoParte: ['DEMANDANTE', 'DEMANDADO', 'VICTIMA', 'TERCEROS', 'CLIENTE', 'OTRO'],
  TipoActuacion: ['AUTO', 'SENTENCIA', 'NOTIFICACION', 'AUDIENCIA', 'MEMORIAL', 'DEMANDA', 'CONTESTACION', 'RECURSO', 'TRASLADO', 'OTRO'],
  TipoCliente: ['NATURAL', 'JURIDICA'],
  CanalNotificacion: ['PLATAFORMA', 'EMAIL', 'AMBOS'],
  PrioridadNotificacion: ['ALTA', 'MEDIA', 'BAJA'],
  RolProcesoAbogado: ['ABOGADO', 'ASISTENTE'],
};

/**
 * Cómo se llama cada cosa en el mensaje de error. En castellano y con el
 * artículo puesto, porque el mensaje lo lee una persona: *«Categoría no
 * válida»* sirve; *«CategoriaDocumento inválido»* no.
 */
const NOMBRES = {
  CategoriaDocumento: 'La categoría del documento',
  VisibilidadDocumento: 'La visibilidad del documento',
  EstadoDocumento: 'El estado del documento',
  EstadoAudiencia: 'El estado de la audiencia',
  EstadoProceso: 'El estado del expediente',
  EstadoTermino: 'El estado del término',
  TipoParte: 'El tipo de parte procesal',
  TipoActuacion: 'El tipo de actuación',
  TipoCliente: 'El tipo de cliente',
  CanalNotificacion: 'El canal de notificación',
  PrioridadNotificacion: 'La prioridad',
  RolProcesoAbogado: 'El rol en el proceso',
};

/**
 * Comprueba un valor contra su enumerado.
 *
 * **Un valor ausente se admite**: casi todos estos campos son opcionales en su
 * petición —actualizar una audiencia sin tocar su estado es legítimo— y quien
 * lo necesite obligatorio lo comprueba aparte. Lo que aquí se rechaza es un
 * valor *presente y equivocado*, que es lo que reventaba contra la base.
 *
 * @returns {{valido: boolean, error: string|null}}
 */
function validarEnum(enumerado, valor) {
  if (valor === undefined || valor === null || valor === '') {
    return { valido: true, error: null };
  }

  const admitidos = ENUMERADOS[enumerado];
  if (!admitidos) {
    // Un enumerado que no está en este archivo es un error de programación, no
    // del usuario: se avisa fuerte en vez de dejar pasar el valor sin mirar.
    throw new Error(`No hay lista declarada para el enumerado ${enumerado}.`);
  }

  if (admitidos.includes(valor)) return { valido: true, error: null };

  return {
    valido: false,
    error: `${NOMBRES[enumerado] || enumerado} no es válida. Valores admitidos: ${admitidos.join(', ')}.`,
  };
}

module.exports = { ENUMERADOS, validarEnum };
