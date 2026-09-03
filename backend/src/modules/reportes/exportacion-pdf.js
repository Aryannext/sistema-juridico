const PDFDocument = require('pdfkit');

/**
 * Informe de expedientes en PDF — RF42.
 *
 * El CSV sirve para procesar; el PDF sirve para **entregar**: a un socio, a un
 * cliente o como soporte de una reunión. Son usos distintos y por eso el
 * requisito pide los dos.
 *
 * Se genera en memoria y se envía como flujo, sin escribir en disco: un informe
 * es efímero y guardarlo en el servidor solo añadiría archivos que limpiar.
 */

const ORO = '#B8860B';
const GRIS = '#555555';
const MARGEN = 45;

/** Traduce el filtro de la petición a algo legible en la portada. */
function describirPeriodo(filtro, desde, hasta) {
  if (filtro === 'mes') return 'Mes en curso';
  if (filtro === 'trimestre') return 'Últimos tres meses';
  if (filtro === 'anio') return 'Año en curso';
  if (filtro === 'custom' && desde && hasta) {
    const f = (d) => new Date(d).toLocaleDateString('es-CO');
    return `Del ${f(desde)} al ${f(hasta)}`;
  }
  return 'Historial completo';
}

const NOMBRE_ROL = {
  ADMINISTRADOR: 'Administrador', ABOGADO: 'Abogado',
  ASISTENTE: 'Colaborador', CLIENTE: 'Cliente',
};

/**
 * Construye el documento y lo escribe en el flujo de respuesta.
 *
 * @param {object} datos  consultorio, periodo, estadísticas y filas
 * @param {stream} salida donde volcar el PDF
 */
function generarInforme(datos, salida) {
  const { consultorio, periodo, generadoPor, estados, porAbogado, filas } = datos;

  const doc = new PDFDocument({ size: 'A4', margin: MARGEN, bufferPages: true });
  doc.pipe(salida);

  // ── Encabezado ──────────────────────────────────────────────────
  doc.fontSize(20).fillColor(ORO).text('Informe de expedientes', { align: 'left' });
  doc.moveDown(0.2);
  doc.fontSize(13).fillColor('#000').text(consultorio);
  doc.moveDown(0.6);

  doc.fontSize(9).fillColor(GRIS);
  doc.text(`Periodo: ${periodo}`);
  doc.text(`Generado por: ${generadoPor}`);
  doc.text(`Fecha de emisión: ${new Date().toLocaleString('es-CO')}`);

  doc.moveDown(0.8);
  doc.moveTo(MARGEN, doc.y).lineTo(550, doc.y).strokeColor(ORO).lineWidth(1.5).stroke();
  doc.moveDown(1);

  // ── Resumen ─────────────────────────────────────────────────────
  doc.fontSize(12).fillColor('#000').text('Resumen');
  doc.moveDown(0.4);
  doc.fontSize(10).fillColor(GRIS);

  const totalExpedientes = estados.reduce((s, e) => s + e.cantidad, 0);
  doc.text(`Expedientes en el periodo: ${totalExpedientes}`);
  for (const e of estados) {
    doc.text(`   · ${e.estado}: ${e.cantidad}`);
  }

  if (porAbogado.length > 0) {
    doc.moveDown(0.6);
    doc.fontSize(12).fillColor('#000').text('Carga por abogado');
    doc.moveDown(0.4);
    doc.fontSize(10).fillColor(GRIS);
    for (const a of porAbogado) {
      doc.text(`   · ${a.nombre} (${NOMBRE_ROL[a.rol] || a.rol}): ${a.procesos} expediente(s)`);
    }
  }

  doc.moveDown(1);

  // ── Detalle ─────────────────────────────────────────────────────
  doc.fontSize(12).fillColor('#000').text('Detalle');
  doc.moveDown(0.5);

  if (filas.length === 0) {
    doc.fontSize(10).fillColor(GRIS)
      .text('No hay expedientes en el periodo seleccionado.');
  } else {
    // Anchos fijos: pdfkit no tiene tablas, así que se dibujan por columnas.
    const COLS = [
      { titulo: 'Cliente', ancho: 130 },
      { titulo: 'Radicado', ancho: 145 },
      { titulo: 'Responsable', ancho: 105 },
      { titulo: 'Estado', ancho: 75 },
      { titulo: 'Plazos', ancho: 45 },
    ];

    const dibujarCabecera = () => {
      let x = MARGEN;
      doc.fontSize(8).fillColor('#000');
      for (const c of COLS) {
        doc.text(c.titulo.toUpperCase(), x, doc.y, { width: c.ancho, continued: false });
        doc.moveUp();
        x += c.ancho;
      }
      doc.moveDown(0.8);
      doc.moveTo(MARGEN, doc.y).lineTo(545, doc.y).strokeColor('#cccccc').lineWidth(0.5).stroke();
      doc.moveDown(0.3);
    };

    dibujarCabecera();

    doc.fontSize(8).fillColor(GRIS);
    for (const fila of filas) {
      // Salto de página conservando la cabecera de la tabla.
      if (doc.y > 760) {
        doc.addPage();
        dibujarCabecera();
        doc.fontSize(8).fillColor(GRIS);
      }

      const y = doc.y;
      let x = MARGEN;
      const valores = [
        fila.cliente,
        fila.radicado || '(sin expediente)',
        fila.responsable || '—',
        fila.estado,
        String(fila.plazosPendientes ?? '—'),
      ];

      valores.forEach((valor, i) => {
        doc.text(valor, x, y, { width: COLS[i].ancho - 6, lineBreak: false, ellipsis: true });
        x += COLS[i].ancho;
      });

      doc.y = y;
      doc.moveDown(0.75);
    }
  }

  // ── Numeración ──────────────────────────────────────────────────
  // El rango se captura ANTES del bucle: `bufferedPageRange()` se recalcula, y
  // leerlo dentro daría un total que crece a medida que se escribe.
  const paginas = doc.bufferedPageRange();

  for (let i = paginas.start; i < paginas.start + paginas.count; i++) {
    doc.switchToPage(i);

    // Escribir el pie dentro del margen inferior hace que pdfkit lo interprete
    // como desbordamiento y añada una página en blanco. Se anula el margen
    // mientras se dibuja y se restaura después.
    const margenInferior = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    doc.fontSize(7).fillColor('#999999').text(
      `Página ${i + 1 - paginas.start} de ${paginas.count}`,
      MARGEN,
      doc.page.height - 30,
      { align: 'center', width: doc.page.width - MARGEN * 2, lineBreak: false }
    );

    doc.page.margins.bottom = margenInferior;
  }

  doc.end();
}

module.exports = { generarInforme, describirPeriodo };
