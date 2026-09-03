/**
 * RF19.1 / HU-13.2 — las siete categorías documentales.
 *
 * El enunciado siempre pidió siete: demandas, pruebas, contratos, ESCRITOS,
 * notificaciones, providencias y otros. El enumerado tenía seis. Un escrito
 * procesal —memorial, recurso, alegato: el género más frecuente en un
 * despacho— había que archivarlo como "OTRO", que es no clasificarlo.
 *
 * Añadir el valor era una línea. Lo que cuesta mantener es que la lista viva en
 * TRES sitios a la vez —el enumerado de Prisma, la constante del controlador y
 * el desplegable del formulario— y que los tres digan lo mismo. Esta prueba
 * existe para eso: para que añadir una octava categoría en uno solo de los tres
 * falle aquí en vez de fallar en producción con un 500 sin explicación.
 */
const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..', '..');
const PROYECTO = path.resolve(RAIZ, '..');

jest.mock('../config/prisma', () => ({
  versionDocumento: { aggregate: jest.fn(), count: jest.fn() },
  bitacoraAuditoria: { count: jest.fn(), create: jest.fn() },
  documento: { create: jest.fn(), findMany: jest.fn() },
  proceso: { findFirst: jest.fn() },
  procesoAbogado: { findFirst: jest.fn() },
  $transaction: jest.fn(),
}));

jest.mock('../config/cloudflare', () => ({ send: jest.fn() }));

const prisma = require('../config/prisma');
const documentos = require('../modules/documentos/documentos.controller');

// Las siete del enunciado, en su orden. Escritas a mano a propósito: si se
// leyeran de alguna de las tres fuentes, la prueba se limitaría a comprobar que
// una fuente coincide consigo misma.
const LAS_SIETE = [
  'DEMANDA',
  'PRUEBA',
  'CONTRATO',
  'ESCRITO',
  'NOTIFICACION',
  'PROVIDENCIA',
  'OTRO',
];

describe('RF19.1 · Las siete categorías existen y coinciden en los tres sitios', () => {
  it('El controlador declara las siete, en el orden del enunciado', () => {
    expect(documentos.CATEGORIAS).toEqual(LAS_SIETE);
  });

  it('El enumerado de Prisma declara exactamente las mismas', () => {
    const esquema = fs.readFileSync(
      path.join(RAIZ, 'prisma', 'schema.prisma'),
      'utf8'
    );
    const bloque = esquema.match(/enum CategoriaDocumento \{([\s\S]*?)\}/);
    expect(bloque).not.toBeNull();

    const valores = bloque[1]
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('//') && !l.startsWith('///'));

    expect(valores.sort()).toEqual([...LAS_SIETE].sort());
  });

  it('La migración que añadió ESCRITO está en el repositorio', () => {
    // El enumerado del esquema no cambia nada por sí solo: sin la migración,
    // la base de datos desplegada sigue teniendo seis y la séptima estalla al
    // usarla. Es exactamente la razón por la que HU-13 seguía abierta.
    const migraciones = path.join(RAIZ, 'prisma', 'migrations');
    const contiene = fs
      .readdirSync(migraciones, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .some((e) => {
        const sql = path.join(migraciones, e.name, 'migration.sql');
        return (
          fs.existsSync(sql) &&
          /ALTER TYPE "CategoriaDocumento" ADD VALUE 'ESCRITO'/.test(
            fs.readFileSync(sql, 'utf8')
          )
        );
      });

    expect(contiene).toBe(true);
  });

  it('El desplegable del formulario ofrece las siete', () => {
    const pantalla = fs.readFileSync(
      path.join(PROYECTO, 'frontend', 'src', 'pages', 'procesos', 'ProcesoDetalle.jsx'),
      'utf8'
    );

    for (const categoria of LAS_SIETE) {
      expect(pantalla).toContain(`<option value="${categoria}">`);
    }
  });
});

describe('HU-13.1 · Una categoría inventada se rechaza con un mensaje claro', () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {},
      file: { originalname: 'demanda.pdf', size: 1024, buffer: Buffer.from('x'), mimetype: 'application/pdf' },
      tenant_id: 't1',
      user: { id_usuario: 'u1' },
    };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    jest.clearAllMocks();

    // La última prueba deja pasar la categoría a propósito y el controlador
    // sigue hasta tropezar con el almacenamiento simulado, que registra el
    // error por consola. Es el comportamiento correcto, pero ensucia la salida
    // de las pruebas y hace parecer que algo se rompió.
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  it('Devuelve 400, y no un 500 desde las tripas de Prisma', async () => {
    // Antes, un valor fuera del enumerado viajaba intacto hasta la base de
    // datos y volvía como "Algo salió mal": el mismo defecto que RF18 ya había
    // corregido para el tamaño de los archivos.
    req.body = { categoria: 'ESCRITOS', visibilidad: 'PRIVADO' };

    await documentos.uploadDocumento(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('ESCRITO') })
    );
  });

  it('El mensaje enumera las categorías admitidas', () => {
    // Decir "no vale" sin decir qué vale obliga a adivinar.
    req.body = { categoria: 'INVENTADA', visibilidad: 'PRIVADO' };

    return documentos.uploadDocumento(req, res).then(() => {
      const mensaje = res.json.mock.calls[0][0].error;
      for (const categoria of LAS_SIETE) {
        expect(mensaje).toContain(categoria);
      }
    });
  });

  it('ESCRITO ya no se rechaza: es el criterio que cerraba HU-13', async () => {
    req.body = { categoria: 'ESCRITO', visibilidad: 'PRIVADO' };

    await documentos.uploadDocumento(req, res);

    // Pasa la validación de categoría y sigue adelante. Falla más tarde por el
    // almacenamiento simulado, que es otra cosa: lo que importa es que NO se
    // rechazó con el 400 de categoría inválida.
    const rechazoDeCategoria = res.json.mock.calls.some(
      (c) => c[0] && typeof c[0].error === 'string' && c[0].error.includes('Categoría no válida')
    );
    expect(rechazoDeCategoria).toBe(false);
  });
});

describe('RF19.2 / HU-13.3 · El filtro por categoría', () => {
  /**
   * Este bloque nació de un error de lectura. RF19.2 y el criterio 3 de HU-13
   * figuraban como cumplidos, y la documentación llegó a explicar que «el
   * filtro por categoría es en cliente». No era cierto: no existía en ninguna
   * parte, ni parámetro en la API ni control en la pantalla. Se descubrió al
   * comprobar una por una las afirmaciones del catálogo, y no antes, porque
   * hasta entonces nadie había ido a mirar.
   */
  let req, res;

  beforeEach(() => {
    req = {
      params: { id_proceso: 'p1' },
      query: {},
      tenant_id: 't1',
      user: { id_usuario: 'u1', rol: 'ADMINISTRADOR' },
    };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    jest.clearAllMocks();

    prisma.proceso.findFirst.mockResolvedValue({
      id_proceso: 'p1', tenant_id: 't1', id_abogado_resp: 'u1', id_cliente: 'c1',
    });
    prisma.procesoAbogado.findFirst.mockResolvedValue(null);
    prisma.documento.findMany.mockResolvedValue([]);
  });

  it('Sin filtro, no acota por categoría', async () => {
    await documentos.getProcesoDocumentos(req, res);

    const where = prisma.documento.findMany.mock.calls[0][0].where;
    expect(where.categoria).toBeUndefined();
  });

  it('Con filtro, acota por esa categoría', async () => {
    req.query.categoria = 'ESCRITO';

    await documentos.getProcesoDocumentos(req, res);

    const where = prisma.documento.findMany.mock.calls[0][0].where;
    expect(where.categoria).toBe('ESCRITO');
  });

  it('Una categoría inventada se rechaza antes de consultar', async () => {
    req.query.categoria = 'INVENTADA';

    await documentos.getProcesoDocumentos(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.documento.findMany).not.toHaveBeenCalled();
  });

  it('El filtro NO amplía lo que alguien tiene derecho a ver (RF22)', async () => {
    // Un colaborador solo ve lo compartido. Filtrar por categoría no puede
    // servir para asomarse a los documentos privados del expediente.
    req.user = { id_usuario: 'u2', rol: 'ASISTENTE' };
    req.query.categoria = 'ESCRITO';
    prisma.procesoAbogado.findFirst.mockResolvedValue({ id_proceso: 'p1', id_usuario: 'u2' });

    await documentos.getProcesoDocumentos(req, res);

    const where = prisma.documento.findMany.mock.calls[0][0].where;
    expect(where.categoria).toBe('ESCRITO');
    expect(where.visibilidad).toEqual({ in: ['VISIBLE_COLAB', 'COMPARTIDO_CLIENTE'] });
  });

  it('La pantalla ofrece el filtro con las siete categorías y la opción de todas', () => {
    const pantalla = fs.readFileSync(
      path.join(PROYECTO, 'frontend', 'src', 'pages', 'procesos', 'ProcesoDetalle.jsx'),
      'utf8'
    );

    expect(pantalla).toContain('aplicarFiltroCategoria');
    expect(pantalla).toContain('<option value="">Todas las categorías</option>');
  });
});
