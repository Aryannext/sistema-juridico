/**
 * Registro de los intentos de acceso a datos de otro consultorio — RNF11.4.
 *
 * El aislamiento ya funcionaba: toda consulta filtra por `tenant_id` y un
 * identificador ajeno acaba en un 404 (RNF11.1 y RNF11.2). Lo que faltaba era
 * **dejar constancia de que alguien lo intentó**. Sin eso, un sondeo sistemático
 * —probar identificadores hasta dar con uno— es indistinguible del ruido: el
 * atacante no obtiene datos, pero tampoco deja huella, y nadie puede detectarlo.
 *
 * **Por qué es un middleware y no una línea en cada controlador.** El sistema
 * tiene una treintena de puntos que devuelven 404 tras filtrar por consultorio.
 * Instrumentarlos uno a uno sería treinta ocasiones de olvidarse, y el próximo
 * endpoint nacería sin registro. Aquí se envuelve `res.json` una sola vez y
 * queda cubierto todo lo que existe y todo lo que se añada.
 *
 * **Qué distingue un sondeo de un error.** Un 404 casi siempre es un
 * identificador equivocado, no un ataque: registrarlos todos llenaría la
 * bitácora de ruido y la haría inútil, que es la forma más eficaz de desactivar
 * una auditoría. Por eso solo se anota cuando el identificador **existe de
 * verdad en otro consultorio**. Eso ya no es un error de tecleo.
 */
const prisma = require('../config/prisma');

/** Un identificador que no es UUID no puede señalar a ninguna fila. */
const ES_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Qué recurso designa cada parámetro con nombre propio.
 * Sirve para rutas como `/api/documentos/proceso/:id_proceso`, donde lo que se
 * consulta no es lo que da nombre al módulo.
 */
const POR_PARAMETRO = {
  id_proceso: { modelo: 'proceso', clave: 'id_proceso', recurso: 'expediente' },
  id_cliente: { modelo: 'cliente', clave: 'id_cliente', recurso: 'cliente' },
  id_documento: { modelo: 'documento', clave: 'id_documento', recurso: 'documento' },
  id_audiencia: { modelo: 'audiencia', clave: 'id_audiencia', recurso: 'audiencia' },
  id_termino: { modelo: 'terminoJudicial', clave: 'id_termino', recurso: 'término judicial' },
  id_actuacion: { modelo: 'actuacion', clave: 'id_actuacion', recurso: 'actuación' },
  id_parte: { modelo: 'parteProcesal', clave: 'id_parte', recurso: 'parte procesal' },
};

/** Qué designa el `:id` genérico, según el módulo en el que aparezca. */
const POR_MODULO = {
  '/api/procesos': POR_PARAMETRO.id_proceso,
  '/api/clientes': POR_PARAMETRO.id_cliente,
  '/api/documentos': POR_PARAMETRO.id_documento,
  '/api/audiencias': POR_PARAMETRO.id_audiencia,
  '/api/terminos': POR_PARAMETRO.id_termino,
  '/api/actuaciones': POR_PARAMETRO.id_actuacion,
};

/** Identificadores de la petición que se pueden comprobar, con su recurso. */
function candidatos(req) {
  const lista = [];
  for (const [nombre, valor] of Object.entries(req.params || {})) {
    if (typeof valor !== 'string' || !ES_UUID.test(valor)) continue;

    const descriptor = nombre === 'id' ? POR_MODULO[req.baseUrl] : POR_PARAMETRO[nombre];
    if (descriptor) lista.push({ ...descriptor, valor });
  }
  return lista;
}

/**
 * Copia de todo lo que hace falta, tomada **antes** de ceder el control.
 *
 * No es una precaución de más. Express reutiliza el objeto `req` y restaura
 * `req.params` y `req.baseUrl` al salir de cada capa; como la comprobación es
 * asíncrona y se reanuda después de que la respuesta haya salido, para entonces
 * esos campos ya no valen lo que valían. Leerlos tarde daría el recurso
 * equivocado, o ninguno.
 */
function fotografiar(req) {
  return {
    objetivos: candidatos(req),
    tenantId: req.tenant_id,
    idUsuario: req.user.id_usuario,
    ip: req.ip || '127.0.0.1',
    metodo: req.method,
    url: req.originalUrl,
  };
}

async function anotarSiEsAjeno(foto) {
  for (const { modelo, clave, recurso, valor } of foto.objetivos) {
    const fila = await prisma[modelo].findUnique({
      where: { [clave]: valor },
      select: { tenant_id: true },
    });

    // No existe en ninguna parte: es un identificador equivocado, no un sondeo.
    if (!fila || fila.tenant_id === foto.tenantId) continue;

    await prisma.bitacoraAuditoria.create({
      data: {
        // Se registra en la bitácora de QUIEN LO INTENTÓ, no en la del
        // consultorio afectado. El segundo no debe enterarse de que existe
        // el primero: decírselo sería filtrar por el otro lado lo mismo que
        // esta regla impide filtrar por el primero.
        tenant_id: foto.tenantId,
        id_usuario: foto.idUsuario,
        accion: 'ACCESO_CRUZADO_DENEGADO',
        modulo: 'SEGURIDAD',
        detalle:
          `Intento de acceso a un ${recurso} que pertenece a otro consultorio. ` +
          `Ruta: ${foto.metodo} ${foto.url}. La petición fue rechazada.`,
        ip_adress: foto.ip,
      },
    });
  }
}

/**
 * Envuelve `res.json` para mirar los 404 al vuelo.
 *
 * La comprobación se lanza **sin esperarla**: la respuesta ya está decidida y
 * hacerla esperar a una consulta de auditoría penalizaría a todo el mundo por
 * un caso excepcional. Si falla, se traza y nada más — el mismo principio que
 * rige el resto de la auditoría: un problema de registro no puede alterar lo
 * que el usuario recibe.
 */
function registrarAccesoCruzado(req, res, next) {
  const jsonOriginal = res.json.bind(res);

  res.json = (cuerpo) => {
    // `req.user` y `req.tenant_id` los pone authMiddleware. Sin ellos no hay
    // a quién atribuir el intento: son las rutas públicas, donde además no se
    // puede pedir un recurso por identificador.
    if (res.statusCode === 404 && req.user && req.tenant_id) {
      const foto = fotografiar(req);
      if (foto.objetivos.length > 0) {
        anotarSiEsAjeno(foto).catch((error) =>
          console.error('No se pudo registrar un intento de acceso cruzado:', error.message)
        );
      }
    }
    return jsonOriginal(cuerpo);
  };

  next();
}

module.exports = { registrarAccesoCruzado };
