/**
 * El servidor no arranca con un JWT_SECRET ausente, corto o de ejemplo.
 *
 * Con la clave de ejemplo del repositorio cualquiera puede firmar un token
 * válido. Estas pruebas fijan que esa configuración se detenga al arrancar en
 * vez de funcionar en silencio.
 */
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { problemasDelEntorno, validarEntorno, LONGITUD_MINIMA_JWT } = require('../config/entorno');

const SECRETO_VALIDO = 'a'.repeat(64);

describe('problemasDelEntorno', () => {
  it('Acepta un secreto largo que no es de ejemplo', () => {
    expect(problemasDelEntorno({ JWT_SECRET: SECRETO_VALIDO })).toEqual([]);
  });

  it('Rechaza la ausencia de JWT_SECRET', () => {
    expect(problemasDelEntorno({})).toHaveLength(1);
  });

  it('Rechaza un secreto más corto que el mínimo', () => {
    const corto = 'x'.repeat(LONGITUD_MINIMA_JWT - 1);
    expect(problemasDelEntorno({ JWT_SECRET: corto })[0]).toMatch(/mínimo/);
  });

  it('Rechaza la clave de ejemplo del .env.example aunque sea larga', () => {
    const ejemplo = 'clave-larga-y-aleatoria-de-al-menos-32-caracteres';
    expect(ejemplo.length).toBeGreaterThanOrEqual(LONGITUD_MINIMA_JWT);
    expect(problemasDelEntorno({ JWT_SECRET: ejemplo })[0]).toMatch(/ejemplo/);
  });

  it('validarEntorno lanza con el detalle del problema', () => {
    expect(() => validarEntorno({})).toThrow(/JWT_SECRET no está definida/);
  });
});

describe('server.js se detiene antes de escuchar', () => {
  it('Termina con código 1 y explica el motivo cuando falta JWT_SECRET', () => {
    const servidor = path.join(__dirname, '..', '..', 'server.js');
    // Vacía y no ausente: dotenv no pisa una variable ya definida, así que un
    // backend/.env local con JWT_SECRET no tapa el caso.
    const env = { ...process.env, JWT_SECRET: '' };
    const resultado = spawnSync(process.execPath, [servidor], { env, encoding: 'utf8', timeout: 15000 });

    expect(resultado.status).toBe(1);
    expect(resultado.stderr).toMatch(/JWT_SECRET/);
  });
});
