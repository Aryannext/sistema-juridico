/**
 * Exportación de la bitácora de auditoría — RNF03.
 *
 * Una bitácora que no se puede exportar solo sirve mientras alguien mira la
 * pantalla. Estas pruebas cuidan las dos cosas que arruinan un CSV de
 * auditoría: que las columnas se descuadren, y que se pierda contexto porque
 * un usuario fue eliminado.
 */
const { construirCSV, construirFilas, escapar, CABECERA } = require('../modules/admin/exportacion-bitacora');

const registro = (extra = {}) => ({
  create_at: new Date('2026-03-15T14:30:00Z'),
  modulo: 'CLIENTES',
  accion: 'CREAR',
  detalle: 'Registró el cliente María Fernanda Rojas',
  ip_adress: '190.85.12.34',
  usuario: { nombre: 'Ana Torres', email: 'ana@bufete.test', rol: 'ABOGADO' },
  ...extra,
});

describe('Estructura del archivo', () => {
  it('Lleva la marca de bytes para que Excel muestre las tildes', () => {
    // Sin la BOM, Excel abre el archivo en Latin-1 y «Registró» sale roto.
    const { csv } = construirCSV([registro()]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it('Encabeza con las nueve columnas acordadas', () => {
    const { csv } = construirCSV([]);
    const cabecera = csv.replace('﻿', '').split('\n')[0];

    expect(CABECERA).toHaveLength(9);
    for (const columna of CABECERA) {
      expect(cabecera).toContain(columna);
    }
  });

  it('Con la bitácora vacía entrega solo la cabecera, no un archivo roto', () => {
    const { csv, totalFilas } = construirCSV([]);

    expect(totalFilas).toBe(0);
    expect(csv.replace('﻿', '').trim().split('\n')).toHaveLength(1);
  });

  it('Numera las filas para poder citar un renglón concreto', () => {
    const filas = construirFilas([registro(), registro(), registro()]);
    expect(filas.map((f) => f[0])).toEqual([1, 2, 3]);
  });
});

describe('Escapado', () => {
  it('Duplica las comillas internas en vez de cortar la columna', () => {
    expect(escapar('Dijo "sí"')).toBe('"Dijo ""sí"""');
  });

  it('Un detalle con punto y coma no parte la fila en dos', () => {
    // El separador es «;»: si el valor no fuera entrecomillado, este detalle
    // desplazaría la IP a una columna que no le corresponde.
    const { csv } = construirCSV([registro({ detalle: 'Editó nombre; teléfono' })]);
    const fila = csv.replace('﻿', '').split('\n')[1];

    expect(fila).toContain('"Editó nombre; teléfono"');
    expect(fila).toContain('"190.85.12.34"');
  });

  it('Un valor nulo sale como celda vacía, no como «null»', () => {
    expect(escapar(null)).toBe('""');
    expect(escapar(undefined)).toBe('""');
  });
});

describe('Contenido de la fila', () => {
  it('Traduce el rol al nombre que ve el usuario', () => {
    // ADR-004: en pantalla ASISTENTE se llama «Colaborador».
    const [fila] = construirFilas([registro({
      usuario: { nombre: 'Luis Gómez', email: 'luis@bufete.test', rol: 'ASISTENTE' },
    })]);

    expect(fila[4]).toBe('Colaborador');
  });

  it('Conserva la hora, no solo la fecha', () => {
    // En una auditoría, «cuándo» sin la hora no responde nada.
    const [fila] = construirFilas([registro()]);
    expect(String(fila[1])).toMatch(/\d{1,2}:\d{2}/);
  });

  it('Si el usuario fue eliminado, la acción no desaparece del informe', () => {
    // Borrar a alguien no puede borrar su rastro: el registro sigue, con el
    // hueco señalado explícitamente.
    const [fila] = construirFilas([registro({ usuario: null })]);

    expect(fila[2]).toBe('(usuario eliminado)');
    expect(fila[6]).toBe('CREAR');
    expect(fila[8]).toBe('190.85.12.34');
  });
});
