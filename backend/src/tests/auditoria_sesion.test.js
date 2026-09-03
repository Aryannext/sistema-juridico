/**
 * Registro de sesión en la bitácora — RF05.
 *
 * Cierra el hallazgo H-20: el código llevaba un `// Todo: Record audit login`
 * sin implementar, de modo que la bitácora sabía todo lo que ocurría DENTRO del
 * sistema pero no quién había entrado.
 *
 * Lo que más se vigila aquí es que un fallo al auditar NO impida entrar ni
 * salir: dejaría la plataforma inaccesible por un problema de registro.
 */
const sesion = require('../modules/auth/sesion.auditoria');
const prisma = require('../config/prisma');

jest.mock('../config/prisma', () => ({
  bitacoraAuditoria: { create: jest.fn() },
}));

const USUARIO = {
  id_usuario: 'u1',
  tenant_id: 't1',
  nombre: 'Ana Torres',
  email: 'ana@bufete.test',
};

const req = (ip = '190.85.12.34') => ({ ip });

beforeEach(() => {
  jest.clearAllMocks();
  prisma.bitacoraAuditoria.create.mockResolvedValue({});
});

const datosDelRegistro = () => prisma.bitacoraAuditoria.create.mock.calls[0][0].data;

describe('Entrada al sistema', () => {
  it('Registra el inicio de sesión con el consultorio, el usuario y la IP', async () => {
    await sesion.registrarEntrada(USUARIO, req(), false);

    const data = datosDelRegistro();
    expect(data.accion).toBe('INICIO_SESION');
    expect(data.modulo).toBe('AUTENTICACION');
    expect(data.tenant_id).toBe('t1');
    expect(data.id_usuario).toBe('u1');
    expect(data.ip_adress).toBe('190.85.12.34');
    expect(data.detalle).toContain('Ana Torres');
  });

  it('Distingue la entrada con doble factor', async () => {
    await sesion.registrarEntrada(USUARIO, req(), true);
    expect(datosDelRegistro().detalle).toMatch(/dos pasos/i);
  });

  it('Sin IP, no deja el campo vacío', async () => {
    // La columna es obligatoria: un registro sin IP haría fallar la escritura
    // y perderíamos la entrada entera.
    await sesion.registrarEntrada(USUARIO, { }, false);
    expect(datosDelRegistro().ip_adress).toBe('127.0.0.1');
  });
});

describe('Intentos fallidos y bloqueo', () => {
  it('Registra el intento fallido con el número de intento', async () => {
    await sesion.registrarIntentoFallido(USUARIO, req(), 3);

    const data = datosDelRegistro();
    expect(data.accion).toBe('INTENTO_FALLIDO_SESION');
    expect(data.detalle).toContain('ana@bufete.test');
    expect(data.detalle).toContain('3');
  });

  it('Registra el bloqueo indicando cuántos minutos', async () => {
    await sesion.registrarBloqueo(USUARIO, req(), 15);

    const data = datosDelRegistro();
    expect(data.accion).toBe('BLOQUEO_POR_INTENTOS');
    expect(data.detalle).toContain('15');
  });
});

describe('Cierre de sesión', () => {
  it('Registra la salida', async () => {
    await sesion.registrarSalida(USUARIO, req());

    const data = datosDelRegistro();
    expect(data.accion).toBe('CIERRE_SESION');
    expect(data.detalle).toContain('Ana Torres');
  });
});

describe('Un fallo al auditar no puede bloquear el acceso', () => {
  it('Si la bitácora falla, la entrada NO lanza', async () => {
    prisma.bitacoraAuditoria.create.mockRejectedValue(new Error('base caída'));

    // Si esto lanzara, el usuario no podría iniciar sesión por un problema de
    // registro, que sería peor que no auditar.
    await expect(sesion.registrarEntrada(USUARIO, req(), false)).resolves.toBeUndefined();
  });

  it('Si la bitácora falla, la salida tampoco lanza', async () => {
    prisma.bitacoraAuditoria.create.mockRejectedValue(new Error('base caída'));
    await expect(sesion.registrarSalida(USUARIO, req())).resolves.toBeUndefined();
  });
});
