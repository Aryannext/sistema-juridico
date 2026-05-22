const documentosController = require('../modules/documentos/documentos.controller');
const prisma = require('../config/prisma');

jest.mock('../config/prisma', () => ({
  documento: {
    findFirst: jest.fn(),
    delete: jest.fn(),
    update: jest.fn()
  },
  parteProcesal: {
    findFirst: jest.fn()
  },
  $transaction: jest.fn((callback) => callback({
    versionDocumento: { deleteMany: jest.fn() },
    documento: { delete: jest.fn() }
  })),
  bitacoraAuditoria: {
    create: jest.fn()
  }
}));

jest.mock('../config/supabase', () => ({
  storage: {
    from: jest.fn().mockReturnThis(),
    remove: jest.fn()
  }
}));

describe('HU-16: Restricción de eliminación de documentos', () => {
  let req, res;

  beforeEach(() => {
    req = { 
      params: { id: 'doc-123' }, 
      body: { justificacion: 'Eliminar doc' },
      user: { id_usuario: 'admin1', rol: 'ADMINISTRADOR' },
      tenant_id: 'tenant1'
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    jest.clearAllMocks();
  });

  it('Debe bloquear la eliminación definitiva si el usuario no es ADMINISTRADOR', async () => {
    req.user.rol = 'ABOGADO';

    await documentosController.deleteDocumentoDefinitivo(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('Se requiere rol de Administrador') })
    );
  });

  it('Debe bloquear la eliminación si el documento está en uso (ej. Parte Procesal)', async () => {
    prisma.documento.findFirst.mockResolvedValue({
      id_documento: 'doc-123',
      nombre: 'doc.pdf'
    });
    
    // Simulate it is in use
    prisma.parteProcesal.findFirst.mockResolvedValue({ id_procesal: 'p1' });

    await documentosController.deleteDocumentoDefinitivo(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('utilizados en actuaciones') })
    );
  });

  it('Debe permitir marcar el documento como inactivo (Cualquier abogado) sin borrarlo', async () => {
    req.user.rol = 'ABOGADO';
    // This calls deleteDocumento which does soft delete
    prisma.documento.findFirst.mockResolvedValue({
      id_documento: 'doc-123',
      nombre: 'doc.pdf',
      estado: 'ACTIVO'
    });
    prisma.documento.update.mockResolvedValue({});

    await documentosController.deleteDocumento(req, res);

    expect(prisma.documento.update).toHaveBeenCalledWith({
      where: { id_documento: 'doc-123' },
      data: { estado: 'INACTIVO' }
    });
  });
});
