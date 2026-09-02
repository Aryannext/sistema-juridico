/**
 * Suspensión de un consultorio completo (`Tenant.activo = false`).
 *
 * Es la palanca para cortar el acceso de una oficina entera de una vez, por
 * ejemplo por impago de la suscripción. Antes existía el campo pero no se
 * comprobaba en ningún sitio: marcarlo no tenía ningún efecto y sus usuarios
 * seguían entrando con normalidad.
 *
 * Estas pruebas existen porque ese fallo es silencioso: nada avisa de que la
 * suspensión no funciona hasta que alguien confía en ella.
 */
const { authMiddleware } = require('../middlewares/auth.middleware');
const authController = require('../modules/auth/auth.controller');
const prisma = require('../config/prisma');
const { verifyToken } = require('../utils/jwt');
const { comparePassword } = require('../utils/bcrypt');

jest.mock('../config/prisma', () => ({
  usuario: { findUnique: jest.fn(), update: jest.fn() },
}));
jest.mock('../utils/jwt', () => ({
  verifyToken: jest.fn(),
  signToken: jest.fn(() => 'token-firmado'),
  generateOTP: jest.fn(() => '123456'),
  generateVerificationToken: jest.fn(() => 'tok'),
}));
jest.mock('../utils/bcrypt', () => ({
  comparePassword: jest.fn(),
  hashPassword: jest.fn(),
}));
jest.mock('../config/mailer', () => ({ sendEmail: jest.fn() }));

function hacerRes() {
  const res = { statusCode: 200, body: null };
  res.status = jest.fn((c) => { res.statusCode = c; return res; });
  res.json = jest.fn((b) => { res.body = b; return res; });
  return res;
}

const USUARIO_BASE = {
  id_usuario: 'u1',
  tenant_id: 't1',
  nombre: 'Ana',
  email: 'ana@bufete.test',
  rol: 'ABOGADO',
  activo: true,
  password_hash: 'hash',
  bloqueado_hasta: null,
  intentos_fallidos: 0,
  dos_factores: false,
};

beforeEach(() => jest.clearAllMocks());

describe('Middleware de autenticación', () => {
  const req = () => ({ headers: { authorization: 'Bearer x' } });

  it('Bloquea con 403 si el consultorio está suspendido', async () => {
    verifyToken.mockReturnValue({ id_usuario: 'u1' });
    prisma.usuario.findUnique.mockResolvedValue({
      ...USUARIO_BASE,
      tenant: { activo: false },
    });

    const res = hacerRes();
    const next = jest.fn();
    await authMiddleware(req(), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body.consultorioSuspendido).toBe(true);
  });

  it('Deja pasar si el consultorio está activo', async () => {
    verifyToken.mockReturnValue({ id_usuario: 'u1' });
    prisma.usuario.findUnique.mockResolvedValue({
      ...USUARIO_BASE,
      tenant: { activo: true },
    });

    const peticion = req();
    const next = jest.fn();
    await authMiddleware(peticion, hacerRes(), next);

    expect(next).toHaveBeenCalled();
    expect(peticion.tenant_id).toBe('t1');
    // El consultorio se consultó solo para comprobar la suspensión: no debe
    // quedar colgando del usuario que ve el resto de la aplicación.
    expect(peticion.user.tenant).toBeUndefined();
  });

  it('Consulta el estado del consultorio, no solo el del usuario', async () => {
    verifyToken.mockReturnValue({ id_usuario: 'u1' });
    prisma.usuario.findUnique.mockResolvedValue({
      ...USUARIO_BASE,
      tenant: { activo: true },
    });

    await authMiddleware(req(), hacerRes(), jest.fn());

    const consulta = prisma.usuario.findUnique.mock.calls[0][0];
    expect(consulta.include).toEqual({ tenant: { select: { activo: true } } });
  });
});

describe('Inicio de sesión', () => {
  const peticion = () => ({
    body: { email: USUARIO_BASE.email, password: 'Clave1234*' },
    ip: '203.0.113.9',
  });

  it('Rechaza con 403 si el consultorio está suspendido', async () => {
    prisma.usuario.findUnique.mockResolvedValue({
      ...USUARIO_BASE,
      tenant: { activo: false },
    });
    comparePassword.mockResolvedValue(true);

    const res = hacerRes();
    await authController.login(peticion(), res);

    expect(res.statusCode).toBe(403);
    expect(res.body.consultorioSuspendido).toBe(true);
    expect(res.body.token).toBeUndefined();
  });

  it('La suspensión se comprueba después de validar la contraseña', async () => {
    // Con contraseña incorrecta debe salir un 401 genérico, sin revelar que el
    // consultorio está suspendido: si no, cualquiera podría averiguar qué
    // oficinas lo están probando correos ajenos.
    prisma.usuario.findUnique.mockResolvedValue({
      ...USUARIO_BASE,
      tenant: { activo: false },
    });
    comparePassword.mockResolvedValue(false);
    prisma.usuario.update.mockResolvedValue({});

    const res = hacerRes();
    await authController.login(peticion(), res);

    expect(res.statusCode).toBe(401);
    expect(res.body.consultorioSuspendido).toBeUndefined();
  });

  it('Entrega el token si el consultorio está activo', async () => {
    prisma.usuario.findUnique.mockResolvedValue({
      ...USUARIO_BASE,
      tenant: { activo: true },
    });
    comparePassword.mockResolvedValue(true);
    prisma.usuario.update.mockResolvedValue({});

    const res = hacerRes();
    await authController.login(peticion(), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.token).toBe('token-firmado');
  });
});
