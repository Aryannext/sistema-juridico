/**
 * RNF07.2 y RNF07.3 — comprobación de estado del servicio.
 *
 * RNF07 pide disponibilidad continua, algo que la mida y un aviso cuando se
 * caiga. Las tres estaban en rojo por la misma razón: **la única ruta de salud
 * que había devolvía un texto fijo**. Contestaba «SGPA API is running» aunque
 * la base estuviera caída, porque no comprobaba nada. Una vigilancia apoyada en
 * ella habría dicho que todo iba bien mientras el sistema no podía atender a
 * nadie, que es peor que no vigilar: da tranquilidad falsa.
 *
 * Lo que estas pruebas fijan es lo que distingue una comprobación útil de una
 * decorativa: que **el código de respuesta cambie** cuando una dependencia
 * falla. Un vigilante externo no lee el cuerpo del mensaje; mira el 200.
 */
const request = require('supertest');

jest.mock('../config/prisma', () => ({
  $queryRaw: jest.fn(),
}));

jest.mock('../config/webhook', () => ({ triggerWebhook: jest.fn() }));

const prisma = require('../config/prisma');
const app = require('../app');

describe('RNF07.2 · La comprobación mira sus dependencias', () => {
  beforeEach(() => jest.clearAllMocks());

  it('Responde 200 y «operativo» cuando la base contesta', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    const res = await request(app).get('/api/estado');

    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('operativo');
    expect(res.body.comprobaciones.base_de_datos.ok).toBe(true);
  });

  it('Responde 503 cuando la base NO contesta', async () => {
    // Este es el criterio entero. Si aquí devolviera 200, la comprobación
    // sería decorativa y RNF07.2 seguiría sin cumplirse aunque exista la ruta.
    prisma.$queryRaw.mockRejectedValue(new Error('connection refused'));

    const res = await request(app).get('/api/estado');

    expect(res.status).toBe(503);
    expect(res.body.estado).toBe('degradado');
    expect(res.body.comprobaciones.base_de_datos.ok).toBe(false);
  });

  it('Consulta de verdad a la base, no se lo supone', async () => {
    prisma.$queryRaw.mockResolvedValue([{}]);
    await request(app).get('/api/estado');
    expect(prisma.$queryRaw).toHaveBeenCalled();
  });

  it('Mide cuánto tarda cada dependencia', async () => {
    // Un servicio que responde en tres segundos no está caído, pero tampoco
    // está bien. Sin el tiempo no hay forma de ver venir la degradación.
    prisma.$queryRaw.mockResolvedValue([{}]);

    const res = await request(app).get('/api/estado');

    expect(typeof res.body.comprobaciones.base_de_datos.ms).toBe('number');
  });

  it('Informa del tiempo en marcha', async () => {
    // Si se reinicia sin que nadie haya desplegado, algo tumbó el proceso.
    prisma.$queryRaw.mockResolvedValue([{}]);

    const res = await request(app).get('/api/estado');

    expect(typeof res.body.en_marcha_segundos).toBe('number');
  });
});

describe('RNF07.3 · La comprobación es utilizable desde fuera', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => console.error.mockRestore());

  it('No exige sesión: un vigilante externo no la tiene', async () => {
    prisma.$queryRaw.mockResolvedValue([{}]);

    const res = await request(app).get('/api/estado');

    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it('No revela nada que no se pueda contar en público', async () => {
    // Es una ruta abierta a internet. No debe filtrar versiones, rutas
    // internas ni recuentos de datos que ayuden a preparar un ataque.
    prisma.$queryRaw.mockResolvedValue([{}]);

    const res = await request(app).get('/api/estado');
    const cuerpo = JSON.stringify(res.body);

    expect(cuerpo).not.toMatch(/postgres|prisma|DATABASE_URL|node_modules/i);
    expect(cuerpo).not.toMatch(/\d+\.\d+\.\d+/); // números de versión
    expect(Object.keys(res.body).sort()).toEqual(
      ['comprobaciones', 'en_marcha_segundos', 'estado']
    );
  });

  it('El mensaje de error de una dependencia caída no viaja crudo al público', async () => {
    // Se informa de que falla, no de por qué falla con detalle interno.
    prisma.$queryRaw.mockRejectedValue(new Error('connection to server at "10.0.0.5" failed'));

    const res = await request(app).get('/api/estado');

    expect(res.status).toBe(503);
    expect(JSON.stringify(res.body)).not.toContain('10.0.0.5');
  });
});

describe('RNF07 · La ruta antigua sigue existiendo pero no sirve para vigilar', () => {
  it('`GET /` responde siempre, aunque la base esté caída', async () => {
    // Se conserva porque está documentada y algo puede depender de ella. Lo
    // que no debe es usarse para medir disponibilidad: por eso existe la otra.
    prisma.$queryRaw.mockRejectedValue(new Error('caída'));

    const res = await request(app).get('/');

    expect(res.status).toBe(200);
  });
});
