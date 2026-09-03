/**
 * Quién puede figurar como abogado responsable de un expediente — RN04.
 *
 * *«Un proceso siempre tiene al menos un abogado responsable.»* La base de
 * datos garantizaba la mitad literal de la regla: `id_abogado_resp` es
 * obligatorio, así que **nunca queda vacío**. Pero un campo lleno no es un
 * responsable: `createProceso` aceptaba el identificador que viniera en la
 * petición **sin comprobar absolutamente nada**. Cabían tres expedientes que
 * cumplen la regla en la forma y la incumplen en el fondo:
 *
 *   1. Responsable de **otro consultorio**. La clave foránea no lo impide
 *      —apunta a `usuario`, no a "usuario de este tenant"—, así que era además
 *      una grieta en el aislamiento: bastaba conocer un UUID ajeno.
 *   2. Responsable **inactivo**. Un abogado desvinculado del despacho seguía
 *      figurando como el único que responde por el caso.
 *   3. Responsable que **no es abogado**: un asistente, o incluso un cliente
 *      con acceso al portal. Sus términos no los vigilaría nadie con capacidad
 *      de actuar sobre ellos.
 *
 * Los tres son el mismo fallo visto de tres formas: *nadie vigila ese
 * expediente*, que es exactamente el escenario del que RN04 nace.
 *
 * Vive en su propio archivo porque son tres los sitios que necesitan la misma
 * respuesta —crear el expediente, reasignar el responsable y sumar a alguien al
 * equipo— y tres copias serían tres sitios donde relajarla por descuido.
 */

/**
 * Un asistente puede estar en el equipo del expediente (`ProcesoAbogado` lo
 * admite como `ASISTENTE`), pero **no puede ser el responsable**: la regla pide
 * un *abogado* que responda. El Administrador sí entra: en un consultorio
 * pequeño es el abogado titular, y en uno grande sigue siendo quien asume el
 * caso cuando no hay nadie más.
 */
const ROLES_QUE_PUEDEN_RESPONDER = ['ADMINISTRADOR', 'ABOGADO'];

/**
 * Comprueba que un usuario pueda ser el responsable de un expediente.
 *
 * @param {object} prisma   Cliente de Prisma (se inyecta para poder usarlo
 *                          dentro de una transacción).
 * @param {string} idUsuario
 * @param {string} tenantId Consultorio en sesión.
 * @returns {Promise<{valido: boolean, error: string|null, usuario: object|null}>}
 */
async function validarResponsable(prisma, idUsuario, tenantId) {
  if (!idUsuario || typeof idUsuario !== 'string') {
    return { valido: false, error: 'Debe indicar el abogado responsable del expediente.', usuario: null };
  }

  // El filtro por consultorio va en la misma consulta, no después: un usuario
  // de otra oficina debe ser indistinguible de uno que no existe. Comprobarlo
  // aparte permitiría averiguar qué identificadores están registrados en el
  // sistema por la diferencia entre los dos mensajes de error.
  const usuario = await prisma.usuario.findFirst({
    where: { id_usuario: idUsuario, tenant_id: tenantId },
    select: { id_usuario: true, nombre: true, rol: true, activo: true },
  });

  if (!usuario) {
    return {
      valido: false,
      error: 'El abogado responsable indicado no pertenece a su consultorio.',
      usuario: null,
    };
  }

  if (!usuario.activo) {
    return {
      valido: false,
      error: `${usuario.nombre} tiene la cuenta inactiva y no puede responder por un expediente.`,
      usuario: null,
    };
  }

  if (!ROLES_QUE_PUEDEN_RESPONDER.includes(usuario.rol)) {
    return {
      valido: false,
      error:
        `${usuario.nombre} tiene el rol ${usuario.rol} y no puede ser el abogado responsable. ` +
        'Solo un Abogado o el Administrador pueden serlo; un colaborador sí puede formar parte del equipo.',
      usuario: null,
    };
  }

  return { valido: true, error: null, usuario };
}

module.exports = { validarResponsable, ROLES_QUE_PUEDEN_RESPONDER };
