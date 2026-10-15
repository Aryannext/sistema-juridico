/**
 * CORS restringido a los orígenes configurados.
 *
 * Con `cors()` sin opciones la API respondía `Access-Control-Allow-Origin: *`
 * a cualquier página. Estas pruebas fijan que solo el frontend propio reciba
 * la cabecera, y que una petición sin `Origin` (curl, el vigilante externo)
 * se siga atendiendo.
 */
const request = require('supertest');

jest.mock('../config/prisma', () => ({
  $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
}));

jest.mock('../config/webhook', () => ({ triggerWebhook: jest.fn() }));

const { origenesPermitidos } = require('../config/cors');

describe('origenesPermitidos', () => {
  it('Usa CORS_ORIGENES cuando está definida, separada por comas', () => {
    const env = { CORS_ORIGENES: 'http://localhost:5173, https://proyectosena.online/' };
    expect(origenesPermitidos(env)).toEqual(['http://localhost:5173', 'https://proyectosena.online']);
  });

  it('Sin CORS_ORIGENES, toma el origen de FRONTEND_URL y descarta la subcarpeta', () => {
    const env = { FRONTEND_URL: 'http://localhost:5173/sistema-juridico' };
    expect(origenesPermitidos(env)).toEqual(['http://localhost:5173']);
  });

  it('Descarta los valores que no son URL en vez de aceptarlos tal cual', () => {
    expect(origenesPermitidos({ CORS_ORIGENES: '*,no-es-url' })).toEqual([]);
  });

  it('Sin ninguna de las dos variables no permite ningún origen ajeno', () => {
    expect(origenesPermitidos({})).toEqual([]);
  });
});

describe('La API solo abre CORS al frontend configurado', () => {
  let app;
  const anterior = { ...process.env };

  beforeAll(() => {
    process.env.CORS_ORIGENES = 'http://localhost:5173';
    jest.isolateModules(() => {
      app = require('../app');
    });
  });

  afterAll(() => {
    process.env = anterior;
  });

  it('Devuelve la cabecera al origen permitido', async () => {
    const res = await request(app).get('/api/estado').set('Origin', 'http://localhost:5173');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('No la devuelve a otro origen, ni como comodín', async () => {
    const res = await request(app).get('/api/estado').set('Origin', 'https://sitio-ajeno.example');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('Atiende igual las peticiones sin Origin', async () => {
    const res = await request(app).get('/api/estado');
    expect(res.status).toBe(200);
  });
});
