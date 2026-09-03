/**
 * Recuperación de acceso: reenvío de verificación (RF54) y restablecimiento de
 * contraseña (HU-01).
 *
 * Lo que más se vigila aquí no es el camino feliz, sino dos cosas que se
 * rompen sin hacer ruido:
 *
 *   - Que NO se pueda averiguar qué correos están registrados. Si la respuesta
 *     cambiara según exista o no la cuenta, cualquiera podría enumerarlas
 *     probando direcciones.
 *   - Que el enlace de recuperación se queme al usarlo y caduque.
 */
const recuperacion = require('../modules/auth/recuperacion.controller');
const prisma = require('../config/prisma');
const { sendEmail } = require('../config/mailer');
const { hashPassword } = require('../utils/bcrypt');

jest.mock('../config/prisma', () => ({
  usuario: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
  bitacoraAuditoria: { create: jest.fn() },
}));
jest.mock('../config/mailer', () => ({ sendEmail: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../utils/bcrypt', () => ({ hashPassword: jest.fn().mockResolvedValue('hash-nuevo') }));
jest.mock('../utils/jwt', () => ({ generateVerificationToken: jest.fn(() => 'token-nuevo') }));

function hacerRes() {
  const res = { statusCode: 200, body: null };
  res.status = jest.fn((c) => { res.statusCode = c; return res; });
  res.json = jest.fn((b) => { res.body = b; return res; });
  return res;
}

const req = (body) => ({ body, ip: '203.0.113.9' });

const USUARIO = {
  id_usuario: 'u1',
  tenant_id: 't1',
  nombre: 'Ana Torres',
  email: 'ana@bufete.test',
  activo: true,
  tenant: { activo: true },
};

beforeEach(() => jest.clearAllMocks());

describe('Reenviar el correo de verificación', () => {
  it('Reenvía a una cuenta sin activar, con token NUEVO y caducidad', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ ...USUARIO, activo: false });
    prisma.usuario.update.mockResolvedValue({});

    const res = hacerRes();
    await recuperacion.reenviarVerificacion(req({ email: USUARIO.email }), res);

    const { data } = prisma.usuario.update.mock.calls[0][0];
    expect(data.token_verificacion).toBe('token-nuevo');
    expect(data.token_verificacion_expira).toBeInstanceOf(Date);
    expect(sendEmail).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });

  it('No reenvía a una cuenta que ya está activa', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ ...USUARIO, activo: true });

    await recuperacion.reenviarVerificacion(req({ email: USUARIO.email }), hacerRes());

    expect(sendEmail).not.toHaveBeenCalled();
    expect(prisma.usuario.update).not.toHaveBeenCalled();
  });

  it('Responde lo MISMO exista o no la cuenta', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ ...USUARIO, activo: false });
    const resExiste = hacerRes();
    await recuperacion.reenviarVerificacion(req({ email: USUARIO.email }), resExiste);

    jest.clearAllMocks();
    prisma.usuario.findUnique.mockResolvedValue(null);
    const resNoExiste = hacerRes();
    await recuperacion.reenviarVerificacion(req({ email: 'nadie@ninguna.test' }), resNoExiste);

    expect(resNoExiste.body).toEqual(resExiste.body);
    expect(resNoExiste.statusCode).toBe(resExiste.statusCode);
  });

  it('Un fallo al enviar tampoco cambia la respuesta', async () => {
    // Si un error diera 500, ese 500 revelaría que el correo SÍ existe.
    prisma.usuario.findUnique.mockResolvedValue({ ...USUARIO, activo: false });
    prisma.usuario.update.mockRejectedValue(new Error('base caída'));

    const res = hacerRes();
    await recuperacion.reenviarVerificacion(req({ email: USUARIO.email }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toMatch(/Si el correo corresponde/);
  });
});

describe('Solicitar recuperación de contraseña', () => {
  it('Envía el enlace a una cuenta activa de un consultorio activo', async () => {
    prisma.usuario.findUnique.mockResolvedValue(USUARIO);
    prisma.usuario.update.mockResolvedValue({});

    await recuperacion.solicitarRecuperacion(req({ email: USUARIO.email }), hacerRes());

    const { data } = prisma.usuario.update.mock.calls[0][0];
    expect(data.token_recuperacion).toBe('token-nuevo');
    expect(data.token_recuperacion_expira).toBeInstanceOf(Date);
    expect(sendEmail).toHaveBeenCalled();
  });

  it('No envía a una cuenta sin verificar', async () => {
    // Primero hay que activar la cuenta; si no, este enlace serviría para
    // saltarse la verificación del correo.
    prisma.usuario.findUnique.mockResolvedValue({ ...USUARIO, activo: false });

    await recuperacion.solicitarRecuperacion(req({ email: USUARIO.email }), hacerRes());

    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('No envía si el consultorio está suspendido', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ ...USUARIO, tenant: { activo: false } });

    await recuperacion.solicitarRecuperacion(req({ email: USUARIO.email }), hacerRes());

    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('Responde lo mismo con un correo que no existe', async () => {
    prisma.usuario.findUnique.mockResolvedValue(USUARIO);
    const resExiste = hacerRes();
    await recuperacion.solicitarRecuperacion(req({ email: USUARIO.email }), resExiste);

    jest.clearAllMocks();
    prisma.usuario.findUnique.mockResolvedValue(null);
    const resNoExiste = hacerRes();
    await recuperacion.solicitarRecuperacion(req({ email: 'nadie@x.test' }), resNoExiste);

    expect(resNoExiste.body).toEqual(resExiste.body);
  });
});

describe('Restablecer la contraseña', () => {
  const dentroDePlazo = new Date(Date.now() + 30 * 60 * 1000);
  const conToken = { ...USUARIO, token_recuperacion_expira: dentroDePlazo };

  it('Cambia la contraseña y QUEMA el token', async () => {
    prisma.usuario.findFirst.mockResolvedValue(conToken);
    prisma.usuario.update.mockResolvedValue({});

    const res = hacerRes();
    await recuperacion.restablecerPassword(req({ token: 'tok', password: 'Segura2026' }), res);

    const { data } = prisma.usuario.update.mock.calls[0][0];
    expect(data.password_hash).toBe('hash-nuevo');
    expect(data.token_recuperacion).toBeNull();
    expect(data.token_recuperacion_expira).toBeNull();
    expect(res.statusCode).toBe(200);
  });

  it('Desbloquea al usuario que se bloqueó probando la contraseña olvidada', async () => {
    prisma.usuario.findFirst.mockResolvedValue(conToken);
    prisma.usuario.update.mockResolvedValue({});

    await recuperacion.restablecerPassword(req({ token: 'tok', password: 'Segura2026' }), hacerRes());

    const { data } = prisma.usuario.update.mock.calls[0][0];
    expect(data.intentos_fallidos).toBe(0);
    expect(data.bloqueado_hasta).toBeNull();
  });

  it('Deja constancia en la bitácora', async () => {
    prisma.usuario.findFirst.mockResolvedValue(conToken);
    prisma.usuario.update.mockResolvedValue({});

    await recuperacion.restablecerPassword(req({ token: 'tok', password: 'Segura2026' }), hacerRes());

    expect(prisma.bitacoraAuditoria.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ accion: 'RESTABLECER_CONTRASENA', tenant_id: 't1' }),
    });
  });

  it('Rechaza un token caducado', async () => {
    prisma.usuario.findFirst.mockResolvedValue({
      ...USUARIO,
      token_recuperacion_expira: new Date(Date.now() - 1000),
    });

    const res = hacerRes();
    await recuperacion.restablecerPassword(req({ token: 'viejo', password: 'Segura2026' }), res);

    expect(res.statusCode).toBe(400);
    expect(prisma.usuario.update).not.toHaveBeenCalled();
  });

  it('Un token inexistente y uno caducado dan el mismo mensaje', async () => {
    prisma.usuario.findFirst.mockResolvedValue(null);
    const resNoExiste = hacerRes();
    await recuperacion.restablecerPassword(req({ token: 'x', password: 'Segura2026' }), resNoExiste);

    jest.clearAllMocks();
    prisma.usuario.findFirst.mockResolvedValue({
      ...USUARIO, token_recuperacion_expira: new Date(Date.now() - 1000),
    });
    const resCaducado = hacerRes();
    await recuperacion.restablecerPassword(req({ token: 'y', password: 'Segura2026' }), resCaducado);

    expect(resNoExiste.body).toEqual(resCaducado.body);
  });

  it('Aplica la política de contraseñas antes de tocar nada', async () => {
    const res = hacerRes();
    await recuperacion.restablecerPassword(req({ token: 'tok', password: '1' }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/contraseña debe tener/i);
    // Ni siquiera se busca el token: la contraseña se valida primero.
    expect(prisma.usuario.findFirst).not.toHaveBeenCalled();
    expect(hashPassword).not.toHaveBeenCalled();
  });

  it('Sin token, no hace nada', async () => {
    const res = hacerRes();
    await recuperacion.restablecerPassword(req({ password: 'Segura2026' }), res);
    expect(res.statusCode).toBe(400);
  });
});
