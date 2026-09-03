/**
 * RF01.2 / HU-01.1 — entrar con nombre de usuario, no solo con correo.
 *
 * Era el único criterio que mantenía HU-01 en amarillo. No se cumplía por una
 * razón simple: no existía dónde guardar el nombre de usuario.
 *
 * Lo que estas pruebas fijan no es que "el login funcione" —eso ya lo cubría
 * auth.controller.test.js—, sino la frontera entre los dos identificadores. Es
 * la parte frágil: el login tiene que decidir, mirando un texto, si busca por
 * correo o por nombre de usuario, y si esa decisión se toma de una forma aquí y
 * de otra al registrar, se pueden guardar nombres que el login nunca buscará.
 */
const authController = require('../modules/auth/auth.controller');
const prisma = require('../config/prisma');
const { comparePassword } = require('../utils/bcrypt');
const {
  validarNombreUsuario,
  normalizar,
  pareceCorreo,
} = require('../utils/nombre-usuario');

jest.mock('../config/prisma', () => ({
  usuario: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  bitacoraAuditoria: {
    create: jest.fn(),
  },
}));

jest.mock('../config/mailer', () => ({ sendEmail: jest.fn() }));

jest.mock('../utils/bcrypt', () => ({
  hashPassword: jest.fn(),
  comparePassword: jest.fn(),
}));

jest.mock('../utils/jwt', () => ({
  signToken: jest.fn(() => 'token_de_prueba'),
  generateOTP: jest.fn(() => '123456'),
  generateVerificationToken: jest.fn(() => 'token_verificacion'),
}));

jest.mock('../modules/auth/sesion.auditoria', () => ({
  registrarEntrada: jest.fn(),
  registrarSalida: jest.fn(),
  registrarIntentoFallido: jest.fn(),
  registrarBloqueo: jest.fn(),
}));

describe('Qué se admite como nombre de usuario', () => {
  it('Rechaza la arroba, que es lo que separa un identificador del otro', () => {
    // Si se pudiera registrar "socia@bufete.com" como nombre de usuario, quien
    // tecleara ese correo podría acabar en una cuenta ajena.
    const r = validarNombreUsuario('socia@bufete.com');
    expect(r.valido).toBe(false);
    expect(r.error).toMatch(/arroba/i);
  });

  it('Rechaza espacios, tildes y eñes', () => {
    for (const malo of ['ana maria', 'martínez', 'peña']) {
      expect(validarNombreUsuario(malo).valido).toBe(false);
    }
  });

  it('Rechaza lo demasiado corto y lo demasiado largo', () => {
    expect(validarNombreUsuario('ab').valido).toBe(false);
    expect(validarNombreUsuario('a'.repeat(31)).valido).toBe(false);
    expect(validarNombreUsuario('abc').valido).toBe(true);
    expect(validarNombreUsuario('a'.repeat(30)).valido).toBe(true);
  });

  it('Rechaza empezar o terminar en signo, que no se ve al leerlo', () => {
    expect(validarNombreUsuario('.ana').valido).toBe(false);
    expect(validarNombreUsuario('ana.').valido).toBe(false);
    expect(validarNombreUsuario('ana.maria').valido).toBe(true);
  });

  it('Rechaza el vacío: no es un nombre de usuario, es la ausencia de uno', () => {
    expect(validarNombreUsuario('').valido).toBe(false);
    expect(validarNombreUsuario('   ').valido).toBe(false);
    expect(validarNombreUsuario(null).valido).toBe(false);
    expect(validarNombreUsuario(undefined).valido).toBe(false);
  });

  it('Normaliza a minúsculas al guardar, para que la unicidad sea real', () => {
    // Sin esto, "MRojas" y "mrojas" serían dos cuentas para la base de datos y
    // la misma persona para cualquiera que las lea.
    expect(validarNombreUsuario('  MRojas  ').valor).toBe('mrojas');
    expect(normalizar('  MRojas  ')).toBe('mrojas');
  });

  it('La arroba, y solo la arroba, distingue un correo', () => {
    expect(pareceCorreo('ana@bufete.com')).toBe(true);
    expect(pareceCorreo('anarojas')).toBe(false);
    expect(pareceCorreo('ana.rojas')).toBe(false);
  });
});

describe('HU-01.1 · El login acepta los dos identificadores', () => {
  let req, res;

  const cuenta = {
    id_usuario: 'u1',
    tenant_id: 't1',
    nombre: 'Ana Rojas',
    email: 'ana@bufete.com',
    nombre_usuario: 'anarojas',
    password_hash: 'hash',
    rol: 'ABOGADO',
    activo: true,
    dos_factores: false,
    intentos_fallidos: 0,
    bloqueado_hasta: null,
    tenant: { activo: true },
  };

  beforeEach(() => {
    req = { body: {}, ip: '127.0.0.1', headers: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    jest.clearAllMocks();
    prisma.usuario.update.mockResolvedValue({});
  });

  it('Con un correo, busca por la columna email y sin tocar el texto', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ ...cuenta });
    comparePassword.mockResolvedValue(true);

    req.body = { identificador: 'ana@bufete.com', password: 'Correcta1' };
    await authController.login(req, res);

    expect(prisma.usuario.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'ana@bufete.com' } })
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'token_de_prueba' })
    );
  });

  it('Sin arroba, busca por la columna nombre_usuario', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ ...cuenta });
    comparePassword.mockResolvedValue(true);

    req.body = { identificador: 'anarojas', password: 'Correcta1' };
    await authController.login(req, res);

    expect(prisma.usuario.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { nombre_usuario: 'anarojas' } })
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'token_de_prueba' })
    );
  });

  it('El nombre de usuario se normaliza antes de buscarlo', async () => {
    // Se guarda siempre en minúsculas; si el login no normalizara, quien lo
    // tecleara con mayúsculas no encontraría su propia cuenta.
    prisma.usuario.findUnique.mockResolvedValue({ ...cuenta });
    comparePassword.mockResolvedValue(true);

    req.body = { identificador: '  AnaRojas  ', password: 'Correcta1' };
    await authController.login(req, res);

    expect(prisma.usuario.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { nombre_usuario: 'anarojas' } })
    );
  });

  it('Sigue aceptando el campo `email` de las llamadas antiguas', async () => {
    // El formulario pasó a llamar al campo `identificador`. Quien llame a la
    // API con el nombre anterior no debe quedarse fuera.
    prisma.usuario.findUnique.mockResolvedValue({ ...cuenta });
    comparePassword.mockResolvedValue(true);

    req.body = { email: 'ana@bufete.com', password: 'Correcta1' };
    await authController.login(req, res);

    expect(prisma.usuario.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'ana@bufete.com' } })
    );
  });

  it('Un nombre de usuario que no existe da el mismo error genérico (RF01.3)', async () => {
    // No debe poder averiguarse qué nombres de usuario están registrados
    // probándolos, igual que no puede averiguarse con los correos.
    prisma.usuario.findUnique.mockResolvedValue(null);

    req.body = { identificador: 'noexiste', password: 'Correcta1' };
    await authController.login(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Credenciales inválidas' });
  });

  it('Sin identificador no se consulta la base de datos', async () => {
    // `findUnique` con un valor indefinido no devuelve "no encontrado": revienta.
    req.body = { password: 'Correcta1' };
    await authController.login(req, res);

    expect(prisma.usuario.findUnique).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Credenciales inválidas' });
  });

  it('Sin contraseña tampoco', async () => {
    req.body = { identificador: 'anarojas' };
    await authController.login(req, res);

    expect(prisma.usuario.findUnique).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('RF01.2 · Reservar el nombre de usuario', () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {},
      ip: '127.0.0.1',
      user: { id_usuario: 'u1' },
      tenant_id: 't1',
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    jest.clearAllMocks();
  });

  it('Rechaza uno ya tomado por otra persona', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id_usuario: 'otro' });

    req.body = { nombre_usuario: 'anarojas' };
    await authController.actualizarNombreUsuario(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(prisma.usuario.update).not.toHaveBeenCalled();
  });

  it('Reasignarse el propio no es un choque', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id_usuario: 'u1' });
    prisma.usuario.update.mockResolvedValue({ nombre_usuario: 'anarojas' });
    prisma.bitacoraAuditoria.create.mockResolvedValue({});

    req.body = { nombre_usuario: 'anarojas' };
    await authController.actualizarNombreUsuario(req, res);

    expect(res.status).not.toHaveBeenCalledWith(409);
    expect(prisma.usuario.update).toHaveBeenCalled();
  });

  it('Guarda siempre en minúsculas', async () => {
    prisma.usuario.findUnique.mockResolvedValue(null);
    prisma.usuario.update.mockResolvedValue({ nombre_usuario: 'anarojas' });
    prisma.bitacoraAuditoria.create.mockResolvedValue({});

    req.body = { nombre_usuario: 'AnaRojas' };
    await authController.actualizarNombreUsuario(req, res);

    expect(prisma.usuario.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { nombre_usuario: 'anarojas' } })
    );
  });

  it('Cambiarlo queda en la bitácora (RF05)', async () => {
    // Cambiar un identificador de acceso es un hecho de seguridad: la bitácora
    // tiene que poder explicar por qué alguien empezó a entrar con otro nombre.
    prisma.usuario.findUnique.mockResolvedValue(null);
    prisma.usuario.update.mockResolvedValue({ nombre_usuario: 'anarojas' });
    prisma.bitacoraAuditoria.create.mockResolvedValue({});

    req.body = { nombre_usuario: 'anarojas' };
    await authController.actualizarNombreUsuario(req, res);

    expect(prisma.bitacoraAuditoria.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ accion: 'CAMBIAR_NOMBRE_USUARIO' }),
      })
    );
  });

  it('Vaciarlo lo retira y libera la reserva', async () => {
    prisma.usuario.update.mockResolvedValue({ nombre_usuario: null });

    req.body = { nombre_usuario: '' };
    await authController.actualizarNombreUsuario(req, res);

    expect(prisma.usuario.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { nombre_usuario: null } })
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ nombre_usuario: null })
    );
  });

  it('Una carrera contra el índice único devuelve 409, no un 500', async () => {
    // Dos peticiones simultáneas pidiendo el mismo nombre: la comprobación
    // previa pasa en las dos y quien decide de verdad es el índice único.
    prisma.usuario.findUnique.mockResolvedValue(null);
    const choque = new Error('Unique constraint failed');
    choque.code = 'P2002';
    prisma.usuario.update.mockRejectedValue(choque);

    req.body = { nombre_usuario: 'anarojas' };
    await authController.actualizarNombreUsuario(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('Un formato inválido se rechaza antes de tocar la base de datos', async () => {
    req.body = { nombre_usuario: 'ana@bufete.com' };
    await authController.actualizarNombreUsuario(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.usuario.findUnique).not.toHaveBeenCalled();
    expect(prisma.usuario.update).not.toHaveBeenCalled();
  });
});

describe('El login no se rompe con un cuerpo malformado', () => {
  // Endpoint público y sin autenticar: lo que llegue puede ser cualquier cosa.
  // Debe responder 401, que es la respuesta correcta a unas credenciales que no
  // sirven, y no un 500 que delate un fallo interno.
  let req, res;

  beforeEach(() => {
    req = { body: {}, ip: '127.0.0.1', headers: {} };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    jest.clearAllMocks();
  });

  it.each([
    ['un objeto como identificador', { identificador: {}, password: 'Correcta1*' }],
    ['un número como identificador', { identificador: 12345, password: 'Correcta1*' }],
    ['un objeto como contraseña', { identificador: 'anarojas', password: {} }],
    ['un cuerpo vacío', {}],
  ])('%s devuelve 401 sin consultar la base de datos', async (_, cuerpo) => {
    req.body = cuerpo;
    await authController.login(req, res);

    expect(prisma.usuario.findUnique).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Credenciales inválidas' });
  });
});
