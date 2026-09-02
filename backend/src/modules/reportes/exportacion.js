/**
 * Exportación del reporte de expedientes a CSV (RF42).
 *
 * Vive fuera del controlador porque armar el archivo es una regla de negocio,
 * no manejo de HTTP: así se puede probar sin simular `req` y `res`.
 */

/** Columnas del archivo, en orden. */
const CABECERA = [
  '#',
  'Cliente',
  'Documento',
  'Radicado',
  'Abogado responsable',
  'Tipo de proceso',
  'Estado',
  'Plazos pendientes',
  'Audiencias',
  'Fecha de creación',
];

const SEPARADOR = ';';

/**
 * Escapa un valor para CSV.
 *
 * La versión anterior interpolaba el valor entre comillas sin escapar nada, de
 * modo que un cliente llamado  Juan "El Rápido" Pérez  rompía la estructura del
 * archivo y descuadraba todas las columnas siguientes. La convención (RFC 4180)
 * es duplicar las comillas internas.
 */
function escapar(valor) {
  if (valor === null || valor === undefined) return '""';
  return `"${String(valor).replace(/"/g, '""')}"`;
}

/** Fecha en formato colombiano; vacío si no hay. */
function fecha(valor) {
  if (!valor) return '';
  return new Date(valor).toLocaleDateString('es-CO');
}

/**
 * Convierte los clientes —con sus expedientes ya filtrados por fecha— en filas.
 *
 * Decisiones de forma, acordadas antes de escribirlo:
 *
 * 1. **Una fila por expediente**, no por cliente. Un cliente con dos procesos
 *    ocupa dos filas repitiendo su nombre. Es lo que permite ordenar, filtrar y
 *    hacer tablas dinámicas en Excel; meter los dos procesos en una sola celda
 *    convertiría el CSV en algo que ya no se puede procesar.
 *
 * 2. **Los clientes sin expedientes también aparecen**, con las columnas del
 *    proceso vacías. Era justo lo que faltaba: exportar con un cliente dado de
 *    alta y ningún expediente devolvía un archivo con solo la cabecera.
 */
function construirFilas(clientes) {
  const filas = [];
  let numero = 0;

  for (const cliente of clientes) {
    const datosCliente = [cliente.nombre, `${cliente.tipo_documento} ${cliente.numero_documento}`];

    if (!cliente.procesos || cliente.procesos.length === 0) {
      numero += 1;
      filas.push([
        numero,
        ...datosCliente,
        '', // radicado
        '', // abogado responsable
        '', // tipo
        'SIN EXPEDIENTES',
        '', // plazos
        '', // audiencias
        fecha(cliente.create_at),
      ]);
      continue;
    }

    for (const proceso of cliente.procesos) {
      numero += 1;
      filas.push([
        numero,
        ...datosCliente,
        proceso.numero_radicado,
        proceso.abogado_resp ? proceso.abogado_resp.nombre : '',
        proceso.tipo_proceso,
        proceso.estado,
        proceso._count ? proceso._count.terminos : 0,
        proceso._count ? proceso._count.audiencias : 0,
        fecha(proceso.create_at),
      ]);
    }
  }

  return filas;
}

/** Arma el contenido completo del archivo. */
function construirCSV(clientes) {
  const filas = construirFilas(clientes);

  // La marca de orden de bytes hace que Excel abra el archivo como UTF-8 y
  // muestre bien las tildes y las eñes.
  let csv = '﻿';
  csv += CABECERA.map(escapar).join(SEPARADOR) + '\n';
  for (const fila of filas) {
    csv += fila.map(escapar).join(SEPARADOR) + '\n';
  }

  return { csv, totalFilas: filas.length };
}

module.exports = { construirCSV, construirFilas, escapar, CABECERA };
