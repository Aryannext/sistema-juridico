/**
 * Aislamiento entre consultorios.
 *
 * Hasta ahora esto solo se comprobaba de extremo a extremo, con la base de
 * datos levantada. Estas pruebas lo fijan como unidad, porque es la clase de
 * error que NO falla de forma ruidosa: filtra datos en silencio.
 */
const procesosController = require('../modules/procesos/procesos.controller');
const clientesController = require('../modules/clientes/clientes.controller');
const prisma = require('../config/prisma');

jest.mock('../config/prisma', () => ({
  proceso: { findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  cliente: { findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  historialProceso: { create: jest.fn() },
  bitacoraAuditoria: { create: jest.fn() },
}));

jest.mock('../config/webhook', () => ({ triggerWebhook: jest.fn() }));

const TENANT = 'tenant-propio';
const OTRO_TENANT = 'tenant-ajeno';

function hacerRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

function hacerReq({ params = {}, body = {} } = {}) {
  return {
    params,
    body,
    tenant_id: TENANT,
    user: { id_usuario: 'usuario-1', rol: 'ADMINISTRADOR', nombre: 'Ana' },
    ip: '203.0.113.9',
  };
}

beforeEach(() => jest.clearAllMocks());

describe('Unicidad acotada al consultorio', () => {
  it('El radicado se busca dentro del consultorio, no en todo el sistema', async () => {
    prisma.proceso.findFirst.mockResolvedValue(null);
    prisma.proceso.create.mockResolvedValue({ id_proceso: 'p1', numero_radicado: 'R-1' });

    await procesosController.createProceso(
      hacerReq({ body: { numero_radicado: 'R-1', tipo_proceso: 'ORDINARIO', id_cliente: 'c1', id_abogado_resp: 'u1' } }),
      hacerRes()
    );

    expect(prisma.proceso.findFirst).toHaveBeenCalledWith({
      where: { numero_radicado: 'R-1', tenant_id: TENANT },
    });
    // findUnique buscaría en todo el sistema: impediría que la contraparte
    // registrara el mismo proceso y revelaría expedientes de otros.
    expect(prisma.proceso.findUnique).not.toHaveBeenCalled();
  });

  it('El documento del cliente se busca dentro del consultorio', async () => {
    prisma.cliente.findFirst.mockResolvedValue(null);
    prisma.cliente.create.mockResolvedValue({ id_cliente: 'c1' });

    await clientesController.createCliente(
      hacerReq({ body: { tipo: 'NATURAL', nombre: 'Ana', tipo_documento: 'CC', numero_documento: '123', telefono: '3', email: 'a@b.c' } }),
      hacerRes()
    );

    expect(prisma.cliente.findFirst).toHaveBeenCalledWith({
      where: { numero_documento: '123', tenant_id: TENANT },
    });
    expect(prisma.cliente.findUnique).not.toHaveBeenCalled();
  });
});

describe('updateCliente descarta los campos no editables', () => {
  it('No deja que el cuerpo reescriba tenant_id ni id_usuario', async () => {
    prisma.cliente.update.mockResolvedValue({ id_cliente: 'c1' });

    await clientesController.updateCliente(
      hacerReq({
        params: { id: 'c1' },
        body: {
          nombre: 'Nombre nuevo',
          tenant_id: OTRO_TENANT,
          id_usuario: 'usuario-ajeno',
          id_cliente: 'otro-id',
          create_at: '2000-01-01',
        },
      }),
      hacerRes()
    );

    const { data, where } = prisma.cliente.update.mock.calls[0][0];

    expect(data).toEqual({ nombre: 'Nombre nuevo' });
    expect(data.tenant_id).toBeUndefined();
    expect(data.id_usuario).toBeUndefined();
    expect(data.create_at).toBeUndefined();
    // El filtro sigue acotado al consultorio de la sesión.
    expect(where).toEqual({ id_cliente: 'c1', tenant_id: TENANT });
  });

  it('Rechaza la petición si no viene ningún campo modificable', async () => {
    const res = hacerRes();

    await clientesController.updateCliente(
      hacerReq({ params: { id: 'c1' }, body: { tenant_id: OTRO_TENANT } }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.cliente.update).not.toHaveBeenCalled();
  });

  it('Traduce el P2025 de Prisma a un 404 en vez de un 500', async () => {
    const noEncontrado = new Error('Record to update not found.');
    noEncontrado.code = 'P2025';
    prisma.cliente.update.mockRejectedValue(noEncontrado);
    const res = hacerRes();

    await clientesController.updateCliente(
      hacerReq({ params: { id: 'ajeno' }, body: { nombre: 'X' } }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('Lectura previa a modificar un expediente', () => {
  it('updateProceso acota la búsqueda al consultorio', async () => {
    prisma.proceso.findFirst.mockResolvedValue(null);
    const res = hacerRes();

    await procesosController.updateProceso(
      hacerReq({ params: { id: 'p-ajeno' }, body: { juzgado: 'Juzgado X' } }),
      res
    );

    expect(prisma.proceso.findFirst).toHaveBeenCalledWith({
      where: { id_proceso: 'p-ajeno', tenant_id: TENANT },
    });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(prisma.proceso.update).not.toHaveBeenCalled();
  });
});
