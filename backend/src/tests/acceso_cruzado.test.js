/**
 * RNF11.4 — el intento de acceso a datos de otro consultorio queda registrado.
 *
 * El aislamiento ya funcionaba (RNF11.1 y RNF11.2): la consulta filtra por
 * consultorio y un identificador ajeno acaba en 404. Lo que faltaba era la
 * huella. Sin ella, probar identificadores hasta acertar es indistinguible del
 * ruido: no se obtienen datos, pero tampoco queda rastro de haberlo intentado.
 *
 * Lo delicado de esta pieza no es registrar: es **no registrar de más**. Un 404
 * casi siempre es un identificador equivocado. Anotarlos todos llenaría la
 * bitácora de ruido, que es la forma más eficaz de inutilizar una auditoría sin
 * desactivarla.
 */
const { registrarAccesoCruzado } = require('../middlewares/acceso-cruzado.middleware');
const prisma = require('../config/prisma');

jest.mock('../config/prisma', () => ({
  proceso: { findUnique: jest.fn() },
  cliente: { findUnique: jest.fn() },
  documento: { findUnique: jest.fn() },
  bitacoraAuditoria: { create: jest.fn() },
}));

const AJENO = '11111111-1111-1111-1111-111111111111';
const PROPIO = 't-propio';

/** Ejecuta el middleware y simula que el controlador responde. */
function responder({ estado, params, baseUrl = '/api/procesos', autenticado = true }) {
  const req = {
    params,
    baseUrl,
    method: 'GET',
    originalUrl: baseUrl + '/' + Object.values(params)[0],
    ip: '10.0.0.9',
    user: autenticado ? { id_usuario: 'u-espia' } : undefined,
    tenant_id: autenticado ? PROPIO : undefined,
  };
  // Se guarda el espía aparte: el middleware sustituye `res.json` por su
  // envoltorio, así que comprobarlo sobre `res.json` miraría al envoltorio.
  const espia = jest.fn();
  const res = { statusCode: estado, json: espia };

  registrarAccesoCruzado(req, res, () => {});
  res.json({ error: 'no encontrado' });
  return { req, res, espia };
}

/** El registro es asíncrono a propósito; se le da un turno para completarse. */
const dejarQueTermine = () => new Promise((r) => setImmediate(r));

describe('RNF11.4 · Cuándo se anota un intento', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.bitacoraAuditoria.create.mockResolvedValue({});
  });

  it('Anota cuando el identificador existe en OTRO consultorio', async () => {
    prisma.proceso.findUnique.mockResolvedValue({ tenant_id: 't-ajeno' });

    responder({ estado: 404, params: { id: AJENO } });
    await dejarQueTermine();

    expect(prisma.bitacoraAuditoria.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accion: 'ACCESO_CRUZADO_DENEGADO',
          modulo: 'SEGURIDAD',
          tenant_id: PROPIO,
          id_usuario: 'u-espia',
        }),
      })
    );
  });

  it('El registro va a la bitácora de QUIEN LO INTENTÓ, no a la del afectado', async () => {
    // Avisar al consultorio afectado le revelaría que existe otro consultorio
    // interesado en sus expedientes: sería filtrar por el otro lado lo mismo
    // que esta regla impide filtrar por el primero.
    prisma.proceso.findUnique.mockResolvedValue({ tenant_id: 't-ajeno' });

    responder({ estado: 404, params: { id: AJENO } });
    await dejarQueTermine();

    const datos = prisma.bitacoraAuditoria.create.mock.calls[0][0].data;
    expect(datos.tenant_id).toBe(PROPIO);
    expect(datos.tenant_id).not.toBe('t-ajeno');
  });

  it('NO anota cuando el identificador no existe en ninguna parte', async () => {
    // Es un error de tecleo, no un sondeo.
    prisma.proceso.findUnique.mockResolvedValue(null);

    responder({ estado: 404, params: { id: AJENO } });
    await dejarQueTermine();

    expect(prisma.bitacoraAuditoria.create).not.toHaveBeenCalled();
  });

  it('NO anota cuando el identificador es del propio consultorio', async () => {
    // Un 404 dentro de casa: el expediente se borró, o el enlace es viejo.
    prisma.proceso.findUnique.mockResolvedValue({ tenant_id: PROPIO });

    responder({ estado: 404, params: { id: AJENO } });
    await dejarQueTermine();

    expect(prisma.bitacoraAuditoria.create).not.toHaveBeenCalled();
  });

  it('NO consulta siquiera si la respuesta no es un 404', async () => {
    responder({ estado: 200, params: { id: AJENO } });
    await dejarQueTermine();

    expect(prisma.proceso.findUnique).not.toHaveBeenCalled();
  });

  it('NO consulta si el identificador no tiene forma de UUID', async () => {
    // Prisma reventaría contra una columna uuid, y además no puede señalar
    // a ninguna fila: no hay nada que sondear.
    responder({ estado: 404, params: { id: 'no-es-un-uuid' } });
    await dejarQueTermine();

    expect(prisma.proceso.findUnique).not.toHaveBeenCalled();
  });

  it('NO anota en las rutas sin sesión', async () => {
    responder({ estado: 404, params: { id: AJENO }, autenticado: false });
    await dejarQueTermine();

    expect(prisma.proceso.findUnique).not.toHaveBeenCalled();
  });
});

describe('RNF11.4 · Qué recurso se reconoce', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.bitacoraAuditoria.create.mockResolvedValue({});
  });

  it('Resuelve el `:id` genérico según el módulo', async () => {
    prisma.cliente.findUnique.mockResolvedValue({ tenant_id: 't-ajeno' });

    responder({ estado: 404, params: { id: AJENO }, baseUrl: '/api/clientes' });
    await dejarQueTermine();

    expect(prisma.cliente.findUnique).toHaveBeenCalled();
    expect(prisma.proceso.findUnique).not.toHaveBeenCalled();
    expect(prisma.bitacoraAuditoria.create.mock.calls[0][0].data.detalle).toContain('cliente');
  });

  it('Resuelve los parámetros con nombre propio, aunque el módulo sea otro', async () => {
    // `/api/documentos/proceso/:id_proceso` consulta un expediente, no un
    // documento. Mirar solo el módulo daría el recurso equivocado.
    prisma.proceso.findUnique.mockResolvedValue({ tenant_id: 't-ajeno' });

    responder({ estado: 404, params: { id_proceso: AJENO }, baseUrl: '/api/documentos' });
    await dejarQueTermine();

    expect(prisma.proceso.findUnique).toHaveBeenCalled();
    expect(prisma.bitacoraAuditoria.create.mock.calls[0][0].data.detalle).toContain('expediente');
  });

  it('Ignora los parámetros que no designan un recurso del consultorio', async () => {
    // `/api/auth/verificar/:token` lleva un token, no un identificador.
    responder({ estado: 404, params: { token: AJENO }, baseUrl: '/api/auth' });
    await dejarQueTermine();

    expect(prisma.bitacoraAuditoria.create).not.toHaveBeenCalled();
  });
});

describe('RNF11.4 · El registro nunca altera la respuesta', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => console.error.mockRestore());

  it('La respuesta sale aunque la bitácora falle', async () => {
    // Mismo principio que el resto de la auditoría: un problema de registro no
    // puede cambiar lo que el usuario recibe.
    prisma.proceso.findUnique.mockResolvedValue({ tenant_id: 't-ajeno' });
    prisma.bitacoraAuditoria.create.mockRejectedValue(new Error('base caída'));

    const { espia } = responder({ estado: 404, params: { id: AJENO } });
    await dejarQueTermine();

    expect(espia).toHaveBeenCalledWith({ error: 'no encontrado' });
  });

  it('La respuesta sale sin esperar a la consulta de auditoría', () => {
    // Se devuelve de inmediato: la comprobación queda en marcha por detrás.
    let resuelta = false;
    prisma.proceso.findUnique.mockImplementation(
      () => new Promise((r) => setTimeout(() => { resuelta = true; r(null); }, 50))
    );

    const { espia } = responder({ estado: 404, params: { id: AJENO } });

    expect(espia).toHaveBeenCalled();
    expect(resuelta).toBe(false);
  });
});

describe('RNF02.8 · El login tiene limitador dedicado', () => {
  it('La ruta de acceso lleva su propio limitador, no solo el general de la API', () => {
    // El bloqueo por usuario frena el ataque a UNA cuenta. Probar una
    // contraseña común contra cientos de correos no llega a 5 fallos en
    // ninguna, así que ese bloqueo no se dispara nunca: hace falta cortar por
    // origen. Esta prueba fija que el limitador no desaparezca de la ruta.
    const fs = require('fs');
    const path = require('path');
    const rutas = fs.readFileSync(
      path.join(__dirname, '..', 'modules', 'auth', 'auth.routes.js'), 'utf8'
    );

    expect(rutas).toMatch(/router\.post\(\s*'\/login',\s*limitadorLogin/);
    expect(rutas).toMatch(/const limitadorLogin = rateLimit\(/);
    // Solo deben contar los fallos: en un despacho todos comparten la IP.
    expect(rutas).toMatch(/skipSuccessfulRequests:\s*true/);
  });
});
