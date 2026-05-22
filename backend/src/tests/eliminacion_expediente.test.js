const procesosController = require('../modules/procesos/procesos.controller');
const prisma = require('../config/prisma');

jest.mock('../config/prisma', () => ({
  proceso: {
    findFirst: jest.fn(),
    delete: jest.fn()
  },
  documento: {
    findMany: jest.fn()
  },
  terminoJudicial: {
    findMany: jest.fn()
  },
  bitacoraAuditoria: {
    create: jest.fn()
  },
  $transaction: jest.fn((callback) => callback({
    procesoAbogado: { deleteMany: jest.fn() },
    parteProcesal: { deleteMany: jest.fn() },
    audiencia: { findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn() },
    recordatorioAudiencia: { deleteMany: jest.fn() },
    terminoJudicial: { findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn() },
    recordatorioTermino: { deleteMany: jest.fn() },
    documento: { findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn() },
    versionDocumento: { deleteMany: jest.fn() },
    historialProceso: { deleteMany: jest.fn() },
    proceso: { delete: jest.fn() }
  }))
}));

describe('HU-34: Eliminación estricta de expediente (ADMINISTRADOR)', () => {
  let req, res;

  beforeEach(() => {
    req = { 
      params: { id: 'uuid-expediente-123' }, 
      body: { justificacion: 'Prueba de eliminación' },
      user: { id_usuario: 'admin1', rol: 'ADMINISTRADOR' },
      tenant_id: 'tenant1'
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    jest.clearAllMocks();
  });

  it('Debe bloquear la eliminación si el usuario no es ADMINISTRADOR', async () => {
    req.user.rol = 'ABOGADO';

    await procesosController.deleteProcesoDefinitivo(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('Solo los administradores') })
    );
  });

  it('Debe bloquear la eliminación si hay documentos activos', async () => {
    prisma.proceso.findFirst.mockResolvedValue({
      id_proceso: 'uuid-expediente-123',
      numero_radicado: '12345'
    });

    prisma.documento.findMany.mockResolvedValue([{ id: 'doc1' }]); // Active documents
    prisma.terminoJudicial.findMany.mockResolvedValue([]);

    await procesosController.deleteProcesoDefinitivo(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining('existen documentos soporte activos')
      })
    );
  });

  it('Debe permitir la eliminación si es Administrador y no hay pendientes, registrando en auditoría', async () => {
    prisma.proceso.findFirst.mockResolvedValue({
      id_proceso: 'uuid-expediente-123',
      numero_radicado: '12345'
    });

    prisma.documento.findMany.mockResolvedValue([]);
    prisma.terminoJudicial.findMany.mockResolvedValue([]);

    await procesosController.deleteProcesoDefinitivo(req, res);

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.bitacoraAuditoria.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        accion: 'ELIMINAR_EXPEDIENTE_DEFINTIVO',
        detalle: expect.stringContaining('12345')
      })
    });
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('eliminados definitivamente') })
    );
  });
});
