const procesosController = require('../modules/procesos/procesos.controller');
const prisma = require('../config/prisma');

jest.mock('../config/prisma', () => ({
  proceso: {
    findFirst: jest.fn(),
    update: jest.fn()
  },
  terminoJudicial: {
    findMany: jest.fn()
  },
  audiencia: {
    findMany: jest.fn()
  },
  historialProceso: {
    create: jest.fn()
  },
  bitacoraAuditoria: {
    create: jest.fn()
  }
}));

describe('HU-09 y RN05: Cambio de Estado del Proceso', () => {
  let req, res;

  beforeEach(() => {
    req = { 
      params: { id: 'uuid-expediente-123' }, 
      body: { estado: 'ARCHIVADO', justificacion: 'Prueba de archivo' },
      user: { id_usuario: 'abogado1', rol: 'ABOGADO' },
      tenant_id: 'tenant1'
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    jest.clearAllMocks();
  });

  it('Debe bloquear el cambio a "Archivado" si hay términos vencidos o pendientes', async () => {
    prisma.proceso.findFirst.mockResolvedValue({
      id_proceso: 'uuid-expediente-123',
      estado: 'ACTIVO'
    });

    // Mock terms pending
    prisma.terminoJudicial.findMany.mockResolvedValue([
      { id_termino: 't1', nombre: 'Término Crítico', estado: 'PENDIENTE' }
    ]);
    prisma.audiencia.findMany.mockResolvedValue([]);

    await procesosController.cambiarEstadoProceso(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining('existen términos pendientes')
      })
    );
  });

  it('Debe permitir archivar el proceso si no hay ningún pendiente ni audiencias próximas', async () => {
    prisma.proceso.findFirst.mockResolvedValue({
      id_proceso: 'uuid-expediente-123',
      estado: 'ACTIVO'
    });

    prisma.terminoJudicial.findMany.mockResolvedValue([]);
    prisma.audiencia.findMany.mockResolvedValue([]);
    prisma.proceso.update.mockResolvedValue({
      id_proceso: 'uuid-expediente-123',
      estado: 'ARCHIVADO'
    });

    await procesosController.cambiarEstadoProceso(req, res);

    expect(prisma.proceso.update).toHaveBeenCalledWith({
      where: { id_proceso: 'uuid-expediente-123' },
      data: { estado: 'ARCHIVADO' }
    });
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('actualizado a ARCHIVADO') })
    );
  });
});
