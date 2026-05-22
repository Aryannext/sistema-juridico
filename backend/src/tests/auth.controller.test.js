const authController = require('../modules/auth/auth.controller');
const prisma = require('../config/prisma');
const { sendEmail } = require('../config/mailer');
const { hashPassword, comparePassword } = require('../utils/bcrypt');

jest.mock('../config/prisma', () => ({
  usuario: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  tenant: {
    create: jest.fn()
  },
  bitacoraAuditoria: {
    create: jest.fn()
  },
  $transaction: jest.fn()
}));

jest.mock('../config/mailer', () => ({
  sendEmail: jest.fn()
}));

jest.mock('../utils/bcrypt', () => ({
  hashPassword: jest.fn(),
  comparePassword: jest.fn()
}));

jest.mock('../utils/jwt', () => ({
  signToken: jest.fn(() => 'mocked_token'),
  generateOTP: jest.fn(() => '123456'),
  generateVerificationToken: jest.fn(() => 'verif_token')
}));

describe('HU-01 y HU-32: Autenticación y 2FA', () => {
  let req, res;

  beforeEach(() => {
    req = { body: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    jest.clearAllMocks();
  });

  it('Debe bloquear el inicio de sesión con credenciales inválidas (HU-01)', async () => {
    req.body = { email: 'test@test.com', password: 'wrong' };

    prisma.usuario.findUnique.mockResolvedValue({
      id_usuario: 'user1',
      email: 'test@test.com',
      password_hash: 'hashed',
      intentos_fallidos: 1,
      bloqueado_hasta: null
    });

    comparePassword.mockResolvedValue(false);

    await authController.login(req, res);

    expect(prisma.usuario.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id_usuario: 'user1' },
        data: expect.objectContaining({ intentos_fallidos: 2 })
      })
    );
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Credenciales inválidas' });
  });

  it('Debe iniciar flujo 2FA si el usuario lo tiene activo, mockeando Email (HU-32)', async () => {
    req.body = { email: 'test2fa@test.com', password: 'valid' };

    prisma.usuario.findUnique.mockResolvedValue({
      id_usuario: 'user2',
      email: 'test2fa@test.com',
      password_hash: 'hashed',
      intentos_fallidos: 0,
      bloqueado_hasta: null,
      activo: true,
      dos_factores: true
    });

    comparePassword.mockResolvedValue(true);
    sendEmail.mockResolvedValue(true);

    await authController.login(req, res);

    expect(prisma.usuario.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          codigo_2fa: '123456'
        })
      })
    );
    expect(sendEmail).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ require2FA: true, message: 'Se ha enviado un código a tu correo electrónico' })
    );
  });
});
