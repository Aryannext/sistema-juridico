/**
 * Informe de expedientes en PDF — RF42.
 *
 * El PDF se entrega a terceros, así que lo que se vigila aquí no es el aspecto
 * —eso se revisa a ojo— sino que el archivo salga íntegro y con el número de
 * páginas correcto. La primera versión metía una página en blanco al final y
 * numeraba «Página 1 de 1» habiendo dos; estas pruebas impiden que vuelva.
 */
const { Writable } = require('stream');
const { generarInforme, describirPeriodo } = require('../modules/reportes/exportacion-pdf');

/** Acumula el PDF en memoria y avisa cuando el documento se cerró. */
function recogerPDF(datos) {
  return new Promise((resolve, reject) => {
    const trozos = [];
    const salida = new Writable({
      write(trozo, _enc, cb) { trozos.push(trozo); cb(); },
    });

    salida.on('finish', () => resolve(Buffer.concat(trozos)));
    salida.on('error', reject);

    generarInforme(datos, salida);
  });
}

/**
 * Cuenta páginas por los objetos `/Type /Page` del PDF.
 * Los objetos de estructura viajan sin comprimir; solo el contenido dibujado
 * se comprime, así que este conteo es fiable.
 */
const contarPaginas = (buffer) => (buffer.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;

const fila = (i) => ({
  cliente: `Cliente ${i}`,
  radicado: `11001310300120260${String(i).padStart(4, '0')}`,
  responsable: 'Ana Torres',
  estado: 'ACTIVO',
  plazosPendientes: 2,
});

const datosBase = (filas = [fila(1)]) => ({
  consultorio: 'Consultorio Jurídico Demo',
  periodo: 'Historial completo',
  generadoPor: 'Ana Torres',
  estados: [{ estado: 'ACTIVO', cantidad: filas.length }],
  porAbogado: [{ nombre: 'Ana Torres', rol: 'ABOGADO', procesos: filas.length }],
  filas,
});

describe('Integridad del archivo', () => {
  it('Produce un PDF válido y cerrado', async () => {
    const pdf = await recogerPDF(datosBase());

    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.toString('latin1').trimEnd().endsWith('%%EOF')).toBe(true);
  });

  it('Un informe corto ocupa una sola página, sin hoja en blanco al final', async () => {
    // El pie de página se escribía dentro del margen inferior y pdfkit lo
    // interpretaba como desbordamiento, añadiendo una página vacía.
    expect(contarPaginas(await recogerPDF(datosBase()))).toBe(1);
  });

  it('Con muchos expedientes pagina de verdad', async () => {
    const muchas = Array.from({ length: 90 }, (_, i) => fila(i + 1));
    expect(contarPaginas(await recogerPDF(datosBase(muchas)))).toBeGreaterThan(1);
  });

  it('Sin expedientes sigue emitiendo el informe, no un archivo vacío', async () => {
    // Un periodo sin movimiento es una respuesta legítima: el informe debe
    // decirlo, no fallar.
    const pdf = await recogerPDF({ ...datosBase([]), estados: [], porAbogado: [] });

    expect(pdf.length).toBeGreaterThan(0);
    expect(contarPaginas(pdf)).toBe(1);
  });

  it('No se atraganta con tildes ni con la ñ', async () => {
    const pdf = await recogerPDF(datosBase([{
      ...fila(1),
      cliente: 'Muñoz Peña & Asociados',
      responsable: 'José Iván Ríos',
    }]));

    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  });
});

describe('Descripción del periodo en la portada', () => {
  it('Traduce cada filtro a algo legible', () => {
    expect(describirPeriodo('mes')).toBe('Mes en curso');
    expect(describirPeriodo('trimestre')).toBe('Últimos tres meses');
    expect(describirPeriodo('anio')).toBe('Año en curso');
  });

  it('Sin filtro, dice que es el historial completo', () => {
    expect(describirPeriodo(undefined)).toBe('Historial completo');
  });

  it('Con rango propio, muestra las dos fechas', () => {
    const texto = describirPeriodo('custom', '2026-01-01', '2026-03-31');
    expect(texto).toMatch(/^Del .+ al .+$/);
  });

  it('Un rango incompleto no imprime «undefined» en la portada', () => {
    expect(describirPeriodo('custom', '2026-01-01', null)).toBe('Historial completo');
  });
});
