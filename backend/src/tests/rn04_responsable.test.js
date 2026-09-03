/**
 * RN04 — «Un proceso siempre tiene al menos un abogado responsable».
 *
 * La regla figuraba como parcial con esta nota: *«No se valida el cambio de
 * responsable ni el usuario inactivo»*. Al mirar el código el diagnóstico
 * resultó ser peor y mejor a la vez que lo declarado:
 *
 *   · **Peor**, porque `createProceso` no validaba NADA. Guardaba el
 *     identificador que viniera en la petición. Cabía un responsable de otro
 *     consultorio —la clave foránea apunta a `usuario`, no a "usuario de este
 *     tenant"—, uno inactivo, o un cliente con acceso al portal.
 *   · **Mejor**, porque el cambio de responsable no es que no se validara: es
 *     que no se podía hacer. Ningún punto de la API escribía `id_abogado_resp`
 *     después de crear el expediente.
 *
 * Lo segundo no cumplía la regla, la esquivaba: un abogado que deja el despacho
 * seguía figurando para siempre, con el campo lleno y nadie vigilando el caso.
 *
 * Estas pruebas fijan las dos mitades: que no se pueda nombrar a quien no puede
 * responder, y que el relevo exista, valide y deje rastro.
 */
const procesos = require('../modules/procesos/procesos.controller');
const { validarResponsable } = require('../modules/procesos/responsable');
const prisma = require('../config/prisma');

jest.mock('../config/prisma', () => ({
  proceso: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
  usuario: { findFirst: jest.fn(), findUnique: jest.fn() },
  procesoAbogado: { findFirst: jest.fn(), create: jest.fn(), delete: jest.fn() },
  historialProceso: { create: jest.fn() },
  bitacoraAuditoria: { create: jest.fn() },
  $transaction: jest.fn(),
}));

jest.mock('../config/webhook', () => ({ triggerWebhook: jest.fn() }));

const TENANT = 't1';

const abogado = { id_usuario: 'u-abg', nombre: 'Ana Rojas', rol: 'ABOGADO', activo: true };

describe('RN04 · Quién puede figurar como responsable', () => {
  beforeEach(() => jest.clearAllMocks());

  it('Acepta a un abogado activo del consultorio', async () => {
    prisma.usuario.findFirst.mockResolvedValue(abogado);
    const r = await validarResponsable(prisma, 'u-abg', TENANT);
    expect(r.valido).toBe(true);
    expect(r.usuario.nombre).toBe('Ana Rojas');
  });

  it('Acepta al Administrador, que en un despacho pequeño es el abogado titular', async () => {
    prisma.usuario.findFirst.mockResolvedValue({ ...abogado, rol: 'ADMINISTRADOR' });
    expect((await validarResponsable(prisma, 'u-adm', TENANT)).valido).toBe(true);
  });

  it('Busca acotando por consultorio en la MISMA consulta', async () => {
    // Si el filtro se aplicara después, un usuario de otra oficina daría un
    // error distinto que uno inexistente, y esa diferencia permitiría averiguar
    // qué identificadores existen en el sistema.
    prisma.usuario.findFirst.mockResolvedValue(null);
    await validarResponsable(prisma, 'u-ajeno', TENANT);

    expect(prisma.usuario.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id_usuario: 'u-ajeno', tenant_id: TENANT },
      })
    );
  });

  it('Rechaza a quien no está en el consultorio', async () => {
    prisma.usuario.findFirst.mockResolvedValue(null);
    const r = await validarResponsable(prisma, 'u-ajeno', TENANT);
    expect(r.valido).toBe(false);
    expect(r.error).toMatch(/no pertenece a su consultorio/i);
  });

  it('Rechaza al usuario inactivo, que era la mitad declarada de la brecha', async () => {
    prisma.usuario.findFirst.mockResolvedValue({ ...abogado, activo: false });
    const r = await validarResponsable(prisma, 'u-abg', TENANT);
    expect(r.valido).toBe(false);
    expect(r.error).toMatch(/inactiva/i);
  });

  it('Rechaza al colaborador: puede trabajar en el caso, no responder por él', async () => {
    prisma.usuario.findFirst.mockResolvedValue({ ...abogado, rol: 'ASISTENTE' });
    const r = await validarResponsable(prisma, 'u-asi', TENANT);
    expect(r.valido).toBe(false);
    expect(r.error).toMatch(/ASISTENTE/);
  });

  it('Rechaza al cliente', async () => {
    prisma.usuario.findFirst.mockResolvedValue({ ...abogado, rol: 'CLIENTE' });
    expect((await validarResponsable(prisma, 'u-cli', TENANT)).valido).toBe(false);
  });

  it('Rechaza la ausencia de responsable sin consultar la base de datos', async () => {
    for (const nada of [undefined, null, '', 123]) {
      const r = await validarResponsable(prisma, nada, TENANT);
      expect(r.valido).toBe(false);
    }
    expect(prisma.usuario.findFirst).not.toHaveBeenCalled();
  });
});

describe('RN04 · Crear un expediente exige un responsable válido', () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: { numero_radicado: '11001', tipo_proceso: 'CIVIL', id_cliente: 'c1', id_abogado_resp: 'u-abg' },
      tenant_id: TENANT,
      user: { id_usuario: 'u-adm' },
      ip: '127.0.0.1',
    };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    jest.clearAllMocks();
    prisma.proceso.findFirst.mockResolvedValue(null);
  });

  it('No crea el expediente si el responsable no vale', async () => {
    prisma.usuario.findFirst.mockResolvedValue({ ...abogado, activo: false });

    await procesos.createProceso(req, res);

    expect(prisma.proceso.create).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('Un responsable de otro consultorio se rechaza con 400, no con un 500 de clave foránea', async () => {
    // Antes llegaba intacto hasta Prisma. Si el UUID existía en otra oficina,
    // la clave foránea lo aceptaba y el expediente nacía roto; si no existía,
    // reventaba con un error interno sin explicación.
    prisma.usuario.findFirst.mockResolvedValue(null);

    await procesos.createProceso(req, res);

    expect(prisma.proceso.create).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('Con un abogado activo del consultorio, lo crea', async () => {
    prisma.usuario.findFirst.mockResolvedValue(abogado);
    prisma.proceso.create.mockResolvedValue({ id_proceso: 'p1', numero_radicado: '11001' });
    prisma.bitacoraAuditoria.create.mockResolvedValue({});

    await procesos.createProceso(req, res);

    expect(prisma.proceso.create).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe('RN04 · El relevo del responsable existe y está validado', () => {
  let req, res, tx;

  const expediente = {
    id_proceso: 'p1',
    numero_radicado: '11001',
    id_abogado_resp: 'u-viejo',
    abogado_resp: { id_usuario: 'u-viejo', nombre: 'Carlos Prieto' },
  };

  beforeEach(() => {
    req = {
      params: { id: 'p1' },
      body: { id_abogado_resp: 'u-abg', justificacion: 'Sale del despacho' },
      tenant_id: TENANT,
      user: { id_usuario: 'u-adm' },
      ip: '127.0.0.1',
    };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    jest.clearAllMocks();

    tx = {
      proceso: { update: jest.fn() },
      historialProceso: { create: jest.fn() },
      bitacoraAuditoria: { create: jest.fn() },
    };
    prisma.$transaction.mockImplementation((fn) => fn(tx));
  });

  it('Exige justificación escrita, como los demás cambios que hay que explicar', async () => {
    req.body.justificacion = '   ';
    await procesos.cambiarResponsable(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('No deja nombrar a un colaborador', async () => {
    prisma.proceso.findFirst.mockResolvedValue(expediente);
    prisma.usuario.findFirst.mockResolvedValue({ ...abogado, rol: 'ASISTENTE' });

    await procesos.cambiarResponsable(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('No deja nombrar a alguien con la cuenta inactiva', async () => {
    prisma.proceso.findFirst.mockResolvedValue(expediente);
    prisma.usuario.findFirst.mockResolvedValue({ ...abogado, activo: false });

    await procesos.cambiarResponsable(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('No deja nombrar a alguien de otro consultorio', async () => {
    prisma.proceso.findFirst.mockResolvedValue(expediente);
    prisma.usuario.findFirst.mockResolvedValue(null);

    await procesos.cambiarResponsable(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('Rechaza el expediente de otro consultorio con 404', async () => {
    prisma.proceso.findFirst.mockResolvedValue(null);

    await procesos.cambiarResponsable(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('Nombrar al que ya es responsable no es un relevo', async () => {
    prisma.proceso.findFirst.mockResolvedValue(expediente);
    req.body.id_abogado_resp = 'u-viejo';

    await procesos.cambiarResponsable(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('El relevo válido cambia el responsable y deja doble rastro', async () => {
    prisma.proceso.findFirst.mockResolvedValue(expediente);
    prisma.usuario.findFirst.mockResolvedValue(abogado);

    await procesos.cambiarResponsable(req, res);

    expect(tx.proceso.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { id_abogado_resp: 'u-abg' } })
    );

    // Historial del expediente (HU-10): de quién a quién.
    expect(tx.historialProceso.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          campo_modificado: 'abogado_responsable',
          valor_anterior: 'Carlos Prieto',
          valor_nuevo: 'Ana Rojas',
        }),
      })
    );

    // Bitácora del consultorio (RF05): quién lo decidió y por qué.
    expect(tx.bitacoraAuditoria.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accion: 'CAMBIAR_RESPONSABLE_EXPEDIENTE',
          detalle: expect.stringContaining('Sale del despacho'),
        }),
      })
    );
  });

  it('El cambio y sus registros van en una sola transacción', async () => {
    // Un expediente que cambia de responsable sin que conste quién lo decidió
    // es justo lo que esta regla trata de impedir.
    prisma.proceso.findFirst.mockResolvedValue(expediente);
    prisma.usuario.findFirst.mockResolvedValue(abogado);

    await procesos.cambiarResponsable(req, res);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.proceso.update).not.toHaveBeenCalled(); // fuera de la transacción, no
  });
});

describe('RN04 · El equipo de trabajo no deja huecos', () => {
  let req, res;

  beforeEach(() => {
    req = {
      params: { id: 'p1' },
      body: {},
      tenant_id: TENANT,
      user: { id_usuario: 'u-adm' },
      ip: '127.0.0.1',
    };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    jest.clearAllMocks();
  });

  it('No se asigna al equipo a alguien con la cuenta inactiva', async () => {
    prisma.proceso.findFirst.mockResolvedValue({ id_proceso: 'p1', id_abogado_resp: 'u-viejo' });
    prisma.usuario.findFirst.mockResolvedValue({ ...abogado, activo: false });
    req.body = { id_usuario: 'u-abg', rol_en_proceso: 'ABOGADO' };

    await procesos.addAbogadoProceso(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.procesoAbogado.create).not.toHaveBeenCalled();
  });

  it('Un cliente no entra al equipo de trabajo (RN02.3)', async () => {
    // El portal es una vista restringida sobre SUS expedientes; el equipo de
    // trabajo es la puerta del despacho.
    prisma.proceso.findFirst.mockResolvedValue({ id_proceso: 'p1', id_abogado_resp: 'u-viejo' });
    prisma.usuario.findFirst.mockResolvedValue({ ...abogado, rol: 'CLIENTE' });
    req.body = { id_usuario: 'u-cli', rol_en_proceso: 'ABOGADO' };

    await procesos.addAbogadoProceso(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.procesoAbogado.create).not.toHaveBeenCalled();
  });

  it('No se puede desasignar al responsable: primero hay que relevarlo', async () => {
    prisma.proceso.findFirst.mockResolvedValue({ id_proceso: 'p1', id_abogado_resp: 'u-abg' });
    prisma.procesoAbogado.findFirst.mockResolvedValue({ id_proceso: 'p1', id_usuario: 'u-abg' });
    req.params.id_usuario = 'u-abg';

    await procesos.removeAbogadoProceso(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.procesoAbogado.delete).not.toHaveBeenCalled();
  });

  it('Sí se puede desasignar a un colaborador que no es el responsable', async () => {
    prisma.proceso.findFirst.mockResolvedValue({
      id_proceso: 'p1', id_abogado_resp: 'u-otro', numero_radicado: '11001'
    });
    prisma.procesoAbogado.findFirst.mockResolvedValue({ id_proceso: 'p1', id_usuario: 'u-abg' });
    prisma.procesoAbogado.delete.mockResolvedValue({});
    prisma.usuario.findUnique.mockResolvedValue(abogado);
    prisma.historialProceso.create.mockResolvedValue({});
    prisma.bitacoraAuditoria.create.mockResolvedValue({});
    req.params.id_usuario = 'u-abg';

    await procesos.removeAbogadoProceso(req, res);

    expect(prisma.procesoAbogado.delete).toHaveBeenCalled();
  });
});
