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
  // Se expone para poder afirmar sobre las tablas que se borran en cascada.
  // Si el controlador toca una tabla que no esté aquí, la llamada revienta y la
  // prueba falla: es justo lo que pasó al añadir las actuaciones.
  __tx: {
    procesoAbogado: { deleteMany: jest.fn() },
    parteProcesal: { deleteMany: jest.fn() },
    audiencia: { findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn() },
    recordatorioAudiencia: { deleteMany: jest.fn() },
    terminoJudicial: { findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn() },
    recordatorioTermino: { deleteMany: jest.fn() },
    documento: { findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn() },
    versionDocumento: { deleteMany: jest.fn() },
    historialProceso: { deleteMany: jest.fn() },
    actuacion: { deleteMany: jest.fn() },
    proceso: { delete: jest.fn() }
  },
  $transaction: jest.fn(function (callback) { return callback(this.__tx); })
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

    // Las actuaciones deben borrarse en la cascada. Su clave foránea hacia el
    // proceso es ON DELETE RESTRICT, así que omitirlas hacía que el borrado
    // fallara con un 500 en cuanto el expediente tuviera una sola actuación.
    expect(prisma.__tx.actuacion.deleteMany).toHaveBeenCalledWith({
      where: { id_proceso: 'uuid-expediente-123' }
    });
    expect(prisma.__tx.proceso.delete).toHaveBeenCalled();

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
