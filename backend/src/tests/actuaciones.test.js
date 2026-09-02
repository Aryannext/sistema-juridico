const actuacionesController = require('../modules/actuaciones/actuaciones.controller');
const prisma = require('../config/prisma');

jest.mock('../config/prisma', () => ({
  proceso: {
    findFirst: jest.fn()
  },
  actuacion: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  },
  historialProceso: {
    create: jest.fn()
  },
  $transaction: jest.fn(cb => cb({
    actuacion: {
      create: jest.fn().mockResolvedValue({ id_actuacion: 'act-1' }),
      update: jest.fn().mockResolvedValue({ id_actuacion: 'act-1', tipo: 'AUTO', anotacion: 'Corregida' }),
      delete: jest.fn()
    },
    historialProceso: {
      create: jest.fn()
    }
  }))
}));

describe('HU-37: Registro de actuaciones procesales', () => {
  let req, res;

  beforeEach(() => {
    req = {
      params: {},
      body: {},
      user: { id_usuario: 'abogado1', rol: 'ABOGADO' },
      tenant_id: 'tenant1'
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    jest.clearAllMocks();
  });

  it('Debe rechazar una actuación con tipo fuera del catálogo cerrado', async () => {
    req.body = {
      id_proceso: 'proc-1',
      fecha_actuacion: '2026-06-20',
      tipo: 'CUALQUIER_COSA',
      anotacion: 'Prueba'
    };

    await actuacionesController.createActuacion(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error).toContain('Tipo de actuación inválido');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('Debe impedir registrar una actuación en un expediente de otro consultorio', async () => {
    req.body = {
      id_proceso: 'proc-de-otro-tenant',
      fecha_actuacion: '2026-06-20',
      tipo: 'AUTO',
      anotacion: 'Auto admisorio de demanda'
    };
    // El filtro por tenant_id no encuentra el expediente
    prisma.proceso.findFirst.mockResolvedValue(null);

    await actuacionesController.createActuacion(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('Debe registrar la actuación y dejarla en el historial del expediente', async () => {
    req.body = {
      id_proceso: 'proc-1',
      fecha_actuacion: '2026-06-20',
      tipo: 'AUTO',
      anotacion: 'Auto admisorio de demanda'
    };
    prisma.proceso.findFirst.mockResolvedValue({ id_proceso: 'proc-1', tenant_id: 'tenant1' });

    await actuacionesController.createActuacion(req, res);

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json.mock.calls[0][0].message).toContain('registrada');
  });

  it('Debe impedir a un ABOGADO eliminar una actuación (solo ADMINISTRADOR)', async () => {
    req.params.id = 'act-1';

    await actuacionesController.deleteActuacion(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('Debe impedir eliminar una actuación que tiene términos judiciales asociados', async () => {
    req.params.id = 'act-1';
    req.user.rol = 'ADMINISTRADOR';
    prisma.actuacion.findFirst.mockResolvedValue({
      id_actuacion: 'act-1',
      id_proceso: 'proc-1',
      tipo: 'AUTO',
      anotacion: 'Auto admisorio',
      terminos: [{ id_termino: 'term-1' }]
    });

    await actuacionesController.deleteActuacion(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].terminosAsociados).toBe(1);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('Debe permitir al ADMINISTRADOR eliminar una actuación sin términos asociados', async () => {
    req.params.id = 'act-1';
    req.user.rol = 'ADMINISTRADOR';
    prisma.actuacion.findFirst.mockResolvedValue({
      id_actuacion: 'act-1',
      id_proceso: 'proc-1',
      tipo: 'AUTO',
      anotacion: 'Auto admisorio',
      terminos: []
    });

    await actuacionesController.deleteActuacion(req, res);

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(res.json.mock.calls[0][0].message).toContain('eliminada');
  });
});
