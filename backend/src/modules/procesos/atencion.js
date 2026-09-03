/**
 * Expedientes que reclaman atención — RF17.3 y RF40.3.
 *
 * Dos avisos que ya existían en la ficha del expediente pero no en el panel
 * principal, que es donde el requisito los pide y donde de verdad sirven: nadie
 * abre un expediente para enterarse de que lo tiene abandonado.
 *
 * - **Incompletos** (RF17): les falta demandante o demandado, así que la
 *   conformación básica del expediente no está cerrada.
 * - **Inactivos** (RF40, RN09): activos y sin ningún movimiento en el plazo
 *   configurado.
 *
 * Vive aparte de `procesos.controller.js` porque ese archivo ya pasa de las 600
 * líneas y está señalado en docs/13-CALIDAD-DE-CODIGO.md.
 */

const DIAS_INACTIVIDAD_POR_DEFECTO = 30;

/**
 * Qué expedientes puede ver quien pregunta.
 *
 * Es la misma regla que aplica `getProcesos` (RF04): el Administrador ve todo
 * el consultorio; los demás, solo aquello de lo que son responsables o donde
 * están asignados. **Se comparte a propósito**: si el panel usara un criterio
 * propio, podría acabar mostrando a un abogado expedientes que su propio
 * listado le oculta.
 */
function filtroDeVisibilidad(usuario, tenantId) {
  const base = { tenant_id: tenantId };

  if (usuario.rol !== 'ADMINISTRADOR') {
    base.OR = [
      { id_abogado_resp: usuario.id_usuario },
      { abogados: { some: { id_usuario: usuario.id_usuario } } },
    ];
  }

  return base;
}

/**
 * Fecha de la última señal de vida del expediente.
 *
 * No basta con `update_at`: un expediente donde solo se han subido documentos o
 * registrado cambios de estado tiene actividad real aunque su fila no se haya
 * tocado. Se toma la más reciente de las tres.
 */
function ultimoMovimiento(proceso) {
  let fecha = proceso.update_at;

  const candidatos = [
    proceso.historial?.[0]?.created_at,
    proceso.documentos?.[0]?.created_at,
    // De la actuación se mira `fecha_registro`, no `fecha_actuacion`: lo que
    // indica que alguien atendió el expediente es cuándo se digitó, no la fecha
    // que trae el juzgado, que puede ser muy anterior.
    proceso.actuaciones?.[0]?.fecha_registro,
  ];

  for (const candidato of candidatos) {
    if (candidato && candidato > fecha) fecha = candidato;
  }

  return fecha;
}

const diasDesde = (fecha) =>
  Math.floor((Date.now() - new Date(fecha).getTime()) / (24 * 60 * 60 * 1000));

/** Un expediente está incompleto si le falta cualquiera de las dos partes. */
function faltanPartes(proceso) {
  const tipos = new Set((proceso.partes || []).map((p) => p.tipo));
  const falta = [];
  if (!tipos.has('DEMANDANTE')) falta.push('demandante');
  if (!tipos.has('DEMANDADO')) falta.push('demandado');
  return falta;
}

module.exports = {
  DIAS_INACTIVIDAD_POR_DEFECTO,
  filtroDeVisibilidad,
  ultimoMovimiento,
  diasDesde,
  faltanPartes,
};
