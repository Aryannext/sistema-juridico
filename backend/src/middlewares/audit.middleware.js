const prisma = require('../config/prisma');

/**
 * Bitácora de auditoría (RF05, RNF03).
 *
 * El detalle se escribe para que lo lea el administrador de un consultorio,
 * no un desarrollador. Antes decía literalmente
 *
 *     Acción CREAR realizada en /api/clientes
 *
 * que no significa nada para un abogado. Ahora dice
 *
 *     Registró el cliente María Fernanda Rojas
 *
 * Para conseguirlo hace falta saber QUÉ se creó, no solo dónde. El middleware
 * es genérico y no lo sabe, así que se envuelve `res.json` para quedarse con
 * la respuesta del controlador —que sí trae la entidad— y se combina con el
 * cuerpo de la petición.
 */

/**
 * Busca un campo identificativo en la respuesta y, si no está, en la petición.
 * La respuesta tiene prioridad porque trae el registro ya guardado.
 */
function identificar(ctx, campos) {
  const fuentes = [];
  const { respuesta, cuerpo } = ctx;

  if (respuesta && typeof respuesta === 'object') {
    fuentes.push(respuesta);
    // Los controladores responden { message, cliente }, { message, proceso }…
    for (const valor of Object.values(respuesta)) {
      if (valor && typeof valor === 'object' && !Array.isArray(valor)) fuentes.push(valor);
    }
  }
  if (cuerpo && typeof cuerpo === 'object') fuentes.push(cuerpo);

  for (const campo of campos) {
    for (const fuente of fuentes) {
      const valor = fuente[campo];
      if (typeof valor === 'string' && valor.trim()) return valor.trim();
      if (typeof valor === 'number') return String(valor);
    }
  }
  return null;
}

const nombre = (ctx) => identificar(ctx, ['nombre', 'razon_social', 'titulo']);
const radicado = (ctx) => identificar(ctx, ['numero_radicado']);
const anotacion = (ctx) => {
  const texto = identificar(ctx, ['anotacion']);
  if (!texto) return null;
  return texto.length > 70 ? `${texto.slice(0, 70)}…` : texto;
};

/** Añade un complemento solo si se pudo averiguar. */
const con = (base, valor, plantilla) => (valor ? plantilla(valor) : base);

/**
 * Frase por ruta. La clave es método + patrón de ruta, no la URL concreta:
 * `POST /api/procesos/:id/partes` es "registró una parte procesal", no
 * "creó un expediente", aunque ambas empiecen por /api/procesos.
 */
const FRASES = {
  // ── Clientes ──────────────────────────────────────────────────
  'POST /api/clientes': (c) =>
    con('Registró un cliente nuevo', nombre(c), (n) => `Registró el cliente ${n}`),
  'PUT /api/clientes/:id': (c) =>
    con('Actualizó los datos de un cliente', nombre(c), (n) => `Actualizó los datos del cliente ${n}`),
  'POST /api/clientes/:id/portal-access': (c) =>
    con('Habilitó el acceso al portal de un cliente', nombre(c),
      (n) => `Habilitó el acceso al portal para el cliente ${n}`),

  // ── Expedientes ───────────────────────────────────────────────
  'POST /api/procesos': (c) =>
    con('Creó un expediente', radicado(c), (r) => `Creó el expediente con radicado ${r}`),
  'PUT /api/procesos/:id': (c) =>
    con('Modificó los datos de un expediente', radicado(c),
      (r) => `Modificó los datos del expediente ${r}`),
  'PUT /api/procesos/:id/estado': (c) => {
    const estado = identificar(c, ['estado']);
    return estado
      ? `Cambió el estado del expediente a ${estado.toLowerCase()}`
      : 'Cambió el estado de un expediente';
  },
  'DELETE /api/procesos/:id': () => 'Eliminó definitivamente un expediente y toda su información',
  'POST /api/procesos/:id/abogados': (c) =>
    con('Asignó un integrante al equipo del expediente', nombre(c),
      (n) => `Asignó a ${n} al equipo del expediente`),
  'DELETE /api/procesos/:id/abogados/:id_usuario': () =>
    'Retiró a un integrante del equipo del expediente',
  'POST /api/procesos/:id/partes': (c) => {
    const n = nombre(c);
    const tipo = identificar(c, ['tipo']);
    if (n && tipo) return `Registró a ${n} como ${tipo.toLowerCase()} en el expediente`;
    return con('Registró una parte procesal en el expediente', n,
      (v) => `Registró a ${v} como parte procesal del expediente`);
  },
  'DELETE /api/procesos/:id/partes/:id_parte': () =>
    'Eliminó una parte procesal del expediente',

  // ── Actuaciones ───────────────────────────────────────────────
  'POST /api/actuaciones': (c) => {
    const tipo = identificar(c, ['tipo']);
    const texto = anotacion(c);
    if (tipo && texto) return `Registró la actuación «${tipo}: ${texto}»`;
    return 'Registró una actuación procesal en el expediente';
  },
  'PUT /api/actuaciones/:id': (c) =>
    con('Corrigió una actuación procesal', anotacion(c),
      (t) => `Corrigió la actuación «${t}»`),
  'DELETE /api/actuaciones/:id': () => 'Eliminó una actuación procesal del expediente',

  // ── Audiencias ────────────────────────────────────────────────
  'POST /api/audiencias': (c) =>
    con('Programó una audiencia', nombre(c), (n) => `Programó la audiencia «${n}»`),
  'PUT /api/audiencias/:id': (c) =>
    con('Modificó una audiencia', nombre(c), (n) => `Modificó la audiencia «${n}»`),

  // ── Términos judiciales ───────────────────────────────────────
  'POST /api/terminos': (c) =>
    con('Registró un término judicial', nombre(c), (n) => `Registró el término judicial «${n}»`),
  'PUT /api/terminos/:id/gestion': (c) => {
    const estado = identificar(c, ['estado']);
    return estado
      ? `Gestionó un término judicial y lo marcó como ${estado.toLowerCase()}`
      : 'Gestionó un término judicial';
  },

  // ── Documentos ────────────────────────────────────────────────
  'POST /api/documentos': (c) =>
    con('Cargó un documento en el expediente', nombre(c),
      (n) => `Cargó el documento «${n}» en el expediente`),
  'POST /api/documentos/:id/version': () =>
    'Cargó una versión nueva de un documento',
  'PATCH /api/documentos/:id/estado': (c) => {
    const estado = identificar(c, ['estado']);
    return estado
      ? `Cambió el estado de un documento a ${estado.toLowerCase()}`
      : 'Cambió el estado de un documento';
  },
  'DELETE /api/documentos/:id': () => 'Eliminó un documento del expediente',
  'DELETE /api/documentos/:id/definitivo': () =>
    'Eliminó definitivamente un documento y su archivo almacenado',
};

/** Cómo se llama cada módulo en castellano, para el texto de reserva. */
const NOMBRE_MODULO = {
  CLIENTES: 'Clientes',
  PROCESOS: 'Expedientes',
  ACTUACIONES: 'Actuaciones',
  AUDIENCIAS: 'Agenda de audiencias',
  TERMINO: 'Términos judiciales',
  DOCS: 'Documentos',
};

const VERBO = { CREAR: 'Creó un registro', EDITAR: 'Modificó un registro', ELIMINAR: 'Eliminó un registro' };

/**
 * Texto de reserva para una ruta que no esté en la tabla. Sigue siendo legible:
 * "Creó un registro en Expedientes" en lugar de una dirección de la API.
 */
function fraseGenerica(accion, modulo) {
  const base = VERBO[accion] || 'Realizó una acción';
  const nombreModulo = NOMBRE_MODULO[modulo] || modulo;
  return `${base} en ${nombreModulo}`;
}

function construirDetalle(req, accion, modulo, respuesta) {
  // Una ruta montada en la raíz del módulo deja `req.route.path === '/'`, de
  // modo que la concatenación da "/api/clientes/" con barra final. Se quita
  // para que la clave coincida con la tabla.
  const patron = req.route
    ? `${req.method} ${`${req.baseUrl}${req.route.path}`.replace(/\/+$/, '')}`
    : null;
  const ctx = { cuerpo: req.body, respuesta, params: req.params };

  const generar = patron && FRASES[patron];
  if (!generar) return fraseGenerica(accion, modulo);

  try {
    return generar(ctx) || fraseGenerica(accion, modulo);
  } catch (error) {
    // Un fallo redactando el texto no puede impedir que se registre la acción:
    // la bitácora es un requisito de auditoría, la redacción es cosmética.
    console.error('Error al redactar el detalle de auditoría:', error);
    return fraseGenerica(accion, modulo);
  }
}

const auditMiddleware = (modulo) => {
  return (req, res, next) => {
    // Se guarda lo que responde el controlador para poder nombrar la entidad
    // afectada. Sin esto solo se conocería la URL.
    let respuesta = null;
    const jsonOriginal = res.json.bind(res);
    res.json = (cuerpo) => {
      respuesta = cuerpo;
      return jsonOriginal(cuerpo);
    };

    res.on('finish', async () => {
      // Solo se registran las acciones que modifican algo y que salieron bien.
      const esMutacion = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method);
      const salioBien = res.statusCode >= 200 && res.statusCode < 300;
      if (!esMutacion || !salioBien) return;

      let accion = req.method;
      if (req.method === 'POST') accion = 'CREAR';
      if (req.method === 'PUT' || req.method === 'PATCH') accion = 'EDITAR';
      if (req.method === 'DELETE') accion = 'ELIMINAR';

      try {
        if (req.user && req.tenant_id) {
          await prisma.bitacoraAuditoria.create({
            data: {
              tenant_id: req.tenant_id,
              id_usuario: req.user.id_usuario,
              accion,
              modulo,
              detalle: construirDetalle(req, accion, modulo, respuesta),
              ip_adress: req.ip || '127.0.0.1'
            }
          });
        }
      } catch (error) {
        console.error('Error al registrar en bitácora de auditoría:', error);
      }
    });

    next();
  };
};

module.exports = auditMiddleware;
module.exports.construirDetalle = construirDetalle;
