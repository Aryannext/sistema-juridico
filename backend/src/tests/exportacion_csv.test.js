/**
 * Exportación del reporte a CSV (RF42).
 *
 * El defecto que originó esta reescritura: un consultorio con un cliente dado
 * de alta y ningún expediente se descargaba un archivo con solo la cabecera,
 * porque la consulta partía del expediente y no del cliente.
 */
const { construirCSV, construirFilas, escapar, CABECERA } = require('../modules/reportes/exportacion');

const proceso = (extra = {}) => ({
  numero_radicado: '41001310300120260014500',
  tipo_proceso: 'ORDINARIO',
  estado: 'ACTIVO',
  create_at: new Date('2026-03-10T12:00:00Z'),
  abogado_resp: { nombre: 'Ana Torres' },
  _count: { terminos: 2, audiencias: 1 },
  ...extra,
});

const cliente = (extra = {}) => ({
  nombre: 'María Fernanda Rojas',
  tipo_documento: 'CC',
  numero_documento: '1075123456',
  create_at: new Date('2026-02-01T12:00:00Z'),
  procesos: [],
  ...extra,
});

describe('Clientes sin expedientes', () => {
  it('Aparecen en el archivo, que era justo lo que faltaba', () => {
    const filas = construirFilas([cliente()]);

    expect(filas).toHaveLength(1);
    expect(filas[0][1]).toBe('María Fernanda Rojas');
    expect(filas[0][2]).toBe('CC 1075123456');
  });

  it('Se marcan como SIN EXPEDIENTES en lugar de dejar la fila a medias', () => {
    const filas = construirFilas([cliente()]);
    const columnaEstado = CABECERA.indexOf('Estado');

    expect(filas[0][columnaEstado]).toBe('SIN EXPEDIENTES');
    expect(filas[0][CABECERA.indexOf('Radicado')]).toBe('');
  });
});

describe('Un cliente con varios expedientes', () => {
  it('Ocupa una fila por expediente, repitiendo sus datos', () => {
    const filas = construirFilas([
      cliente({
        procesos: [
          proceso({ numero_radicado: 'RAD-1' }),
          proceso({ numero_radicado: 'RAD-2', estado: 'ARCHIVADO' }),
        ],
      }),
    ]);

    expect(filas).toHaveLength(2);
    expect(filas.map((f) => f[CABECERA.indexOf('Radicado')])).toEqual(['RAD-1', 'RAD-2']);
    // El nombre se repite: es lo que permite ordenar y filtrar en Excel.
    expect(filas[0][1]).toBe(filas[1][1]);
  });

  it('La numeración es correlativa sobre las filas, no sobre los clientes', () => {
    const filas = construirFilas([
      cliente({ nombre: 'Cliente A', procesos: [proceso(), proceso()] }),
      cliente({ nombre: 'Cliente B', numero_documento: '999', procesos: [proceso()] }),
      cliente({ nombre: 'Cliente C', numero_documento: '888' }),
    ]);

    expect(filas.map((f) => f[0])).toEqual([1, 2, 3, 4]);
  });
});

describe('Formato del archivo', () => {
  it('Empieza con la marca de bytes que hace que Excel lea UTF-8', () => {
    const { csv } = construirCSV([cliente()]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it('Escapa las comillas en lugar de romper la estructura', () => {
    // Antes se interpolaba entre comillas sin escapar: este nombre descuadraba
    // todas las columnas siguientes.
    expect(escapar('Juan "El Rápido" Pérez')).toBe('"Juan ""El Rápido"" Pérez"');
  });

  it('Un nombre con comillas no altera el número de columnas', () => {
    const { csv } = construirCSV([cliente({ nombre: 'Juan "El Rápido" Pérez' })]);
    const lineas = csv.trim().split('\n');
    const columnasCabecera = lineas[0].split(';').length;
    const columnasFila = lineas[1].split(';').length;

    expect(columnasFila).toBe(columnasCabecera);
    expect(columnasCabecera).toBe(CABECERA.length);
  });

  it('Un nombre con punto y coma tampoco', () => {
    const { csv } = construirCSV([cliente({ nombre: 'Gómez; Herrera y Asociados' })]);
    const lineas = csv.trim().split('\n');
    // El punto y coma va dentro de comillas, así que un lector conforme a
    // RFC 4180 no lo toma como separador.
    expect(lineas[1]).toContain('"Gómez; Herrera y Asociados"');
  });

  it('Cuenta las filas, no los clientes', () => {
    const { totalFilas } = construirCSV([
      cliente({ procesos: [proceso(), proceso()] }),
      cliente({ nombre: 'Otro', numero_documento: '777' }),
    ]);
    expect(totalFilas).toBe(3);
  });

  it('Sin datos, entrega solo la cabecera y no falla', () => {
    const { csv, totalFilas } = construirCSV([]);
    expect(totalFilas).toBe(0);
    expect(csv.trim().split('\n')).toHaveLength(1);
  });
});

describe('Columnas', () => {
  it('Son las acordadas y en el orden acordado', () => {
    expect(CABECERA).toEqual([
      '#', 'Cliente', 'Documento', 'Radicado', 'Abogado responsable',
      'Tipo de proceso', 'Estado', 'Plazos pendientes', 'Audiencias', 'Fecha de creación',
    ]);
  });

  it('Toleran un expediente sin abogado responsable', () => {
    const filas = construirFilas([
      cliente({ procesos: [proceso({ abogado_resp: null })] }),
    ]);
    expect(filas[0][CABECERA.indexOf('Abogado responsable')]).toBe('');
  });
});
