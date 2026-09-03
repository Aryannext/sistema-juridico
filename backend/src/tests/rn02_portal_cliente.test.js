/**
 * RN02.3 — «El Administrador no puede suplantar a un cliente en el portal».
 *
 * La regla figuraba como cumplida «de forma indirecta», y esa palabra escondía
 * una grieta concreta. Lo que había era esto:
 *
 *   · El portal comprueba `rol === 'CLIENTE'`. Eso impide entrar con una sesión
 *     de administrador, y es correcto.
 *   · Pero al habilitar el acceso, **quien lo habilitaba escribía la contraseña
 *     del cliente**. Así que no necesitaba suplantarlo con su propia sesión:
 *     abría el portal e iniciaba sesión como él, con la clave que acababa de
 *     teclear. La prohibición existía en el documento y no en el sistema.
 *
 * Ahora la cuenta nace sin contraseña utilizable y solo el titular del correo
 * puede fijar la suya. Estas pruebas fijan las dos mitades: que el portal siga
 * cerrado a quien no es cliente, y que el sistema nunca entregue a nadie del
 * despacho una credencial de cliente.
 */
const clientes = require('../modules/clientes/clientes.controller');
const portal = require('../modules/portal/portal.controller');
const prisma = require('../config/prisma');
const { enviarCorreoPrimerAcceso } = require('../modules/auth/recuperacion.controller');

jest.mock('../config/prisma', () => ({
  cliente: { findFirst: jest.fn() },
  usuario: { findUnique: jest.fn(), create: jest.fn() },
  tenant: { findUnique: jest.fn() },
  bitacoraAuditoria: { create: jest.fn() },
  proceso: { findMany: jest.fn() },
  audiencia: { findMany: jest.fn() },
}));

jest.mock('../config/webhook', () => ({ triggerWebhook: jest.fn() }));

jest.mock('../modules/auth/recuperacion.controller', () => ({
  enviarCorreoPrimerAcceso: jest.fn(),
}));

jest.mock('../utils/jwt', () => ({
  generateVerificationToken: jest.fn(() => 'token-primer-acceso'),
}));

const CLIENTE = {
  id_cliente: 'c1',
  nombre: 'Marta Ospina',
  email: 'marta@correo.com',
  tenant_id: 't1',
};

describe('RN02.3 · El despacho no fija la contraseña del cliente', () => {
  let req, res;

  beforeEach(() => {
    req = {
      params: { id: 'c1' },
      body: {},
      tenant_id: 't1',
      user: { id_usuario: 'u-adm' },
      ip: '127.0.0.1',
    };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    jest.clearAllMocks();

    prisma.cliente.findFirst.mockResolvedValue(CLIENTE);
    prisma.usuario.findUnique.mockResolvedValue(null);
    prisma.usuario.create.mockImplementation(({ data }) => ({ id_usuario: 'u-cli', ...data }));
    prisma.tenant.findUnique.mockResolvedValue({ nombre: 'Consultorio Demo' });
    prisma.bitacoraAuditoria.create.mockResolvedValue({});
    enviarCorreoPrimerAcceso.mockResolvedValue(true);
  });

  it('Rechaza que le envíen una contraseña, en vez de ignorarla en silencio', async () => {
    // Ignorarla sería peor: quien la envía cree que la está fijando y podría
    // dictársela al cliente como si funcionara.
    req.body = { password: 'LaQueYoElija1*' };

    await clientes.createPortalAccess(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ codigo: 'PASSWORD_NO_ADMITIDA' })
    );
    expect(prisma.usuario.create).not.toHaveBeenCalled();
  });

  it('Crea la cuenta con una contraseña que nadie conoce', async () => {
    await clientes.createPortalAccess(req, res);

    const datos = prisma.usuario.create.mock.calls[0][0].data;

    expect(datos.rol).toBe('CLIENTE');
    expect(datos.password_hash).toEqual(expect.any(String));
    // Es un hash, no algo utilizable ni comunicable.
    expect(datos.password_hash).toMatch(/^\$2[aby]\$/);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('La contraseña con la que nace la cuenta es distinta en cada llamada', async () => {
    // Si fuera fija o derivable —del correo, del nombre—, quien conociera la
    // regla podría entrar en cualquier portal recién habilitado.
    await clientes.createPortalAccess(req, res);
    const primera = prisma.usuario.create.mock.calls[0][0].data.password_hash;

    jest.clearAllMocks();
    prisma.cliente.findFirst.mockResolvedValue(CLIENTE);
    prisma.usuario.findUnique.mockResolvedValue(null);
    prisma.usuario.create.mockImplementation(({ data }) => ({ id_usuario: 'u-cli2', ...data }));
    prisma.tenant.findUnique.mockResolvedValue({ nombre: 'Consultorio Demo' });
    prisma.bitacoraAuditoria.create.mockResolvedValue({});

    await clientes.createPortalAccess(req, res);
    const segunda = prisma.usuario.create.mock.calls[0][0].data.password_hash;

    expect(primera).not.toBe(segunda);
  });

  it('El secreto de origen no se devuelve en la respuesta ni queda en la bitácora', async () => {
    await clientes.createPortalAccess(req, res);

    const respuesta = JSON.stringify(res.json.mock.calls[0][0]);
    const bitacora = JSON.stringify(prisma.bitacoraAuditoria.create.mock.calls[0][0]);
    const hash = prisma.usuario.create.mock.calls[0][0].data.password_hash;

    expect(respuesta).not.toContain(hash);
    expect(respuesta).not.toMatch(/password/i);
    expect(bitacora).not.toContain(hash);
  });

  it('La cuenta nace con un enlace de un solo uso para que el cliente elija la suya', async () => {
    await clientes.createPortalAccess(req, res);

    const datos = prisma.usuario.create.mock.calls[0][0].data;
    expect(datos.token_recuperacion).toBe('token-primer-acceso');
    expect(datos.token_recuperacion_expira).toBeInstanceOf(Date);
    expect(datos.token_recuperacion_expira.getTime()).toBeGreaterThan(Date.now());

    expect(enviarCorreoPrimerAcceso).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'marta@correo.com', token: 'token-primer-acceso' })
    );
  });

  it('Si el correo falla, la cuenta NO se deshace', async () => {
    // Lección de H-28: deshacerla dejaría el correo del cliente ocupado y la
    // habilitación no se podría reintentar.
    enviarCorreoPrimerAcceso.mockResolvedValue(false);

    await clientes.createPortalAccess(req, res);

    expect(prisma.usuario.create).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ correoEnviado: false })
    );
  });

  it('La bitácora deja constancia de quién habilitó el acceso (RF05)', async () => {
    await clientes.createPortalAccess(req, res);

    expect(prisma.bitacoraAuditoria.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accion: 'CREAR_ACCESO_PORTAL_CLIENTE',
          id_usuario: 'u-adm',
        }),
      })
    );
  });

  it('Un cliente de otro consultorio no se encuentra', async () => {
    prisma.cliente.findFirst.mockResolvedValue(null);

    await clientes.createPortalAccess(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(prisma.usuario.create).not.toHaveBeenCalled();
  });
});

describe('RN02.3 · La contraseña de origen no sirve para entrar', () => {
  it('Ningún valor previsible abre la cuenta recién creada', async () => {
    // Se comprueba de verdad contra bcrypt, no sobre un simulacro: el hash que
    // se guarda no debe corresponder a nada que alguien pudiera adivinar a
    // partir de los datos del cliente.
    const real = jest.requireActual('../utils/bcrypt');
    const req = {
      params: { id: 'c1' }, body: {}, tenant_id: 't1',
      user: { id_usuario: 'u-adm' }, ip: '127.0.0.1',
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    prisma.cliente.findFirst.mockResolvedValue(CLIENTE);
    prisma.usuario.findUnique.mockResolvedValue(null);
    prisma.usuario.create.mockImplementation(({ data }) => ({ id_usuario: 'u-cli', ...data }));
    prisma.tenant.findUnique.mockResolvedValue({ nombre: 'Consultorio Demo' });
    prisma.bitacoraAuditoria.create.mockResolvedValue({});
    enviarCorreoPrimerAcceso.mockResolvedValue(true);

    await clientes.createPortalAccess(req, res);
    const hash = prisma.usuario.create.mock.calls[0][0].data.password_hash;

    for (const intento of [
      '', 'marta@correo.com', 'Marta Ospina', 'c1', 'u-cli',
      'Consultorio Demo', 'token-primer-acceso', '12345678', 'Cliente123*',
    ]) {
      expect(await real.comparePassword(intento, hash)).toBe(false);
    }
  }, 30000);
});

describe('RN02 · El portal sigue cerrado a quien no es cliente', () => {
  let res;

  beforeEach(() => {
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    jest.clearAllMocks();
  });

  it.each(['ADMINISTRADOR', 'ABOGADO', 'ASISTENTE'])(
    'Un %s no entra al panel del portal',
    async (rol) => {
      const req = { user: { rol, email: 'quien@sea.com' }, tenant_id: 't1' };

      await portal.getPortalDashboard(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(prisma.cliente.findFirst).not.toHaveBeenCalled();
    }
  );

  it('Un cliente solo ve el expediente asociado a SU ficha', async () => {
    const req = { user: { rol: 'CLIENTE', email: 'marta@correo.com' }, tenant_id: 't1' };
    prisma.cliente.findFirst.mockResolvedValue(CLIENTE);
    prisma.proceso.findMany.mockResolvedValue([]);
    prisma.audiencia.findMany.mockResolvedValue([]);

    await portal.getPortalDashboard(req, res);

    // La ficha se busca por SU correo y SU consultorio, no por un parámetro
    // que pudiera manipular.
    expect(prisma.cliente.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: 'marta@correo.com', tenant_id: 't1' },
      })
    );
  });
});
