/**
 * Exportación de la bitácora de auditoría — RNF03.
 *
 * El requisito exige que la bitácora sea «exportable con filtros». Sin
 * exportación, un registro de auditoría solo sirve mientras alguien esté
 * mirando la pantalla: no se puede entregar a un tercero, ni archivar, ni
 * aportar como soporte.
 *
 * Se separa del controlador porque componer el archivo es una regla de negocio,
 * no manejo de HTTP, y así se prueba sin simular `req` y `res`.
 */

const CABECERA = [
  '#',
  'Fecha y hora',
  'Usuario',
  'Correo',
  'Rol',
  'Módulo',
  'Acción',
  'Detalle',
  'Dirección IP',
];

const SEPARADOR = ';';

/**
 * Escapa un valor para CSV duplicando las comillas internas (RFC 4180).
 * Sin esto, un detalle que contenga comillas descuadra todas las columnas.
 */
function escapar(valor) {
  if (valor === null || valor === undefined) return '""';
  return `"${String(valor).replace(/"/g, '""')}"`;
}

/** Fecha y hora completas: en una auditoría, la hora importa tanto como el día. */
function fechaHora(valor) {
  if (!valor) return '';
  return new Date(valor).toLocaleString('es-CO');
}

/** Nombre legible del rol (ver ADR-004). */
function nombreRol(rol) {
  const NOMBRES = {
    ADMINISTRADOR: 'Administrador',
    ABOGADO: 'Abogado',
    ASISTENTE: 'Colaborador',
    CLIENTE: 'Cliente',
  };
  return NOMBRES[rol] || rol || '';
}

function construirFilas(registros) {
  return registros.map((r, i) => [
    i + 1,
    fechaHora(r.create_at),
    r.usuario ? r.usuario.nombre : '(usuario eliminado)',
    r.usuario ? r.usuario.email : '',
    r.usuario ? nombreRol(r.usuario.rol) : '',
    r.modulo,
    r.accion,
    r.detalle,
    r.ip_adress,
  ]);
}

/** Arma el archivo completo. */
function construirCSV(registros) {
  const filas = construirFilas(registros);

  // La marca de orden de bytes hace que Excel lo abra como UTF-8 y muestre
  // bien las tildes.
  let csv = '﻿';
  csv += CABECERA.map(escapar).join(SEPARADOR) + '\n';
  for (const fila of filas) {
    csv += fila.map(escapar).join(SEPARADOR) + '\n';
  }

  return { csv, totalFilas: filas.length };
}

module.exports = { construirCSV, construirFilas, escapar, CABECERA };
