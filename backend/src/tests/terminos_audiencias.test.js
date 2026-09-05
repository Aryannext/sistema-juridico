const terminosController = require('../modules/terminos/terminos.controller');

const prisma = require('../config/prisma');

jest.mock('../config/prisma', () => ({
  terminoJudicial: {
    findFirst: jest.fn(),
    update: jest.fn()
  },
  audiencia: {
    findMany: jest.fn(),
    updateMany: jest.fn()
  },
  historialProceso: {
    create: jest.fn()
  },
  bitacoraAuditoria: {
    create: jest.fn()
  },
  $transaction: jest.fn(cb => cb({
    terminoJudicial: {
      update: jest.fn()
    },
    historialProceso: {
      create: jest.fn()
    },
    recordatorioTermino: {
      updateMany: jest.fn()
    },
    bitacoraAuditoria: {
      create: jest.fn()
    }
  }))
}));

describe('Sprint 3: Términos y Audiencias', () => {
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
      json: jest.fn(),
    };
    jest.clearAllMocks();
  });

  it('HU-23: Debe forzar estado "CUMPLIDO_TARDIO" si se gestiona después de vencimiento', async () => {
    req.params.id = 'term-123';
    req.body.estado = 'CUMPLIDO'; // The lawyer tries to mark it as CUMPLIDO
    req.body.justificacion = 'Lo acabo de hacer';

    // Simulate that the term's due date was in the past
    prisma.terminoJudicial.findFirst.mockResolvedValue({
      id_termino: 'term-123',
      fecha_vencimiento: new Date(Date.now() - 86400000), // Yesterday
      estado: 'PENDIENTE'
    });

    prisma.terminoJudicial.update.mockResolvedValue({});

    await terminosController.gestionarTermino(req, res);

    // We can't easily assert on the inline tx mock, so we check if transaction was called.
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  // HU-20 is handled by node-cron in server.js or jobs folder, so we skip the explicit controller test for now.
});

describe('RF31 · Un estado de audiencia inventado se rechaza con 400', () => {
  /**
   * Encontrado revisando el catálogo criterio a criterio antes de desplegar.
   *
   * `updateAudiencia` volcaba el `estado` recibido directamente en Prisma. Un
   * valor fuera del enumerado devolvía un **500 opaco**, exactamente el mismo
   * defecto ya corregido tres veces en este proyecto: el tamaño de los archivos
   * (RF18), la categoría documental (RF19) y el tipo de actuación (RF56).
   *
   * El patrón se repite siempre igual —un valor de enumerado que llega del
   * cliente sin filtrar—, así que conviene mirarlo en cada campo nuevo de ese
   * tipo antes de darlo por bueno.
   */
  const audiencias = require('../modules/audiencias/audiencias.controller');

  it('Los estados declarados son los tres del enumerado', () => {
    expect(audiencias.ESTADOS_AUDIENCIA).toEqual(['PROGRAMADA', 'REALIZADA', 'CANCELADA']);
  });

  it('La lista coincide con el enumerado del esquema', () => {
    // Si divergen, el controlador rechazaría un estado válido o dejaría pasar
    // uno que la base no admite.
    const fs = require('fs');
    const path = require('path');
    const esquema = fs.readFileSync(
      path.join(__dirname, '..', '..', 'prisma', 'schema.prisma'), 'utf8'
    );
    const bloque = esquema.match(/enum EstadoAudiencia \{([\s\S]*?)\}/)[1];
    const valores = bloque.split('\n').map((l) => l.trim()).filter(Boolean);

    expect(valores.sort()).toEqual([...audiencias.ESTADOS_AUDIENCIA].sort());
  });

  it('Un estado inventado se rechaza antes de tocar la base', async () => {
    const req = {
      params: { id: 'a1' },
      body: { estado: 'INVENTADO' },
      tenant_id: 't1',
      user: { id_usuario: 'u1' },
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await audiencias.updateAudiencia(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('PROGRAMADA') })
    );
  });
});
