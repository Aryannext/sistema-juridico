/**
 * RNF05.5 / HU-31.5 — la búsqueda de expedientes por debajo de 2 segundos
 * cuando la tabla crezca.
 *
 * El criterio llevaba abierto con una nota honesta: «hoy sí (5–17 ms), sin
 * índices que lo garanticen al crecer». No había un solo índice sobre `procesos`
 * aparte de la clave primaria y el único (consultorio, radicado); los
 * milisegundos venían de que recorrer una tabla casi vacía es barato.
 *
 * Que los índices funcionan lo comprueba `npm run verificar:indices` contra una
 * base de datos real, pidiendo el plan de cada consulta. Esto es otra cosa y
 * hace falta igual: **que nadie los borre sin enterarse**, y sobre todo que
 * nadie añada un campo nuevo a la búsqueda dejándolo sin indexar. Ese es el
 * fallo probable: no borrar un índice, sino ampliar la consulta y olvidarlo.
 *
 * Una prueba de rendimiento aquí no serviría de nada: mediría los mismos
 * milisegundos con índices y sin ellos, que es justo el espejismo que dejó este
 * criterio abierto.
 */
const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..', '..');

const esquema = fs.readFileSync(path.join(RAIZ, 'prisma', 'schema.prisma'), 'utf8');

const sqlDeMigraciones = (() => {
  const dir = path.join(RAIZ, 'prisma', 'migrations');
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => path.join(dir, e.name, 'migration.sql'))
    .filter((p) => fs.existsSync(p))
    .map((p) => fs.readFileSync(p, 'utf8'))
    .join('\n');
})();

const INDICES = [
  'procesos_tenant_id_create_at_idx',
  'procesos_tenant_id_estado_idx',
  'procesos_tenant_id_tipo_proceso_idx',
  'procesos_id_abogado_resp_idx',
  'proceso_abogados_id_usuario_idx',
  'clientes_tenant_id_idx',
  'procesos_numero_radicado_idx',
  'procesos_juzgado_idx',
  'clientes_nombre_idx',
  'clientes_razon_social_idx',
  'usuario_nombre_idx',
];

describe('RNF05.5 · Los índices de la búsqueda están aplicados', () => {
  it('Cada índice se crea en una migración', () => {
    // El esquema por sí solo no cambia nada en la base desplegada. Declarar el
    // índice sin migrarlo es exactamente el estado anterior a este trabajo.
    const faltan = INDICES.filter((i) => !sqlDeMigraciones.includes(`"${i}"`));
    expect(faltan).toEqual([]);
  });

  it('La extensión de trigramas se instala antes de usarse', () => {
    // Sin pg_trgm, las cinco búsquedas parciales no tienen índice posible y la
    // migración que los crea falla entera.
    expect(sqlDeMigraciones).toMatch(/CREATE EXTENSION IF NOT EXISTS pg_trgm/);

    const posicionExtension = sqlDeMigraciones.indexOf('CREATE EXTENSION IF NOT EXISTS pg_trgm');
    const posicionPrimerGin = sqlDeMigraciones.indexOf('USING GIN');
    expect(posicionExtension).toBeGreaterThan(-1);
    expect(posicionExtension).toBeLessThan(posicionPrimerGin);
  });

  it('Las búsquedas parciales usan índices de trigramas, no B-tree', () => {
    // Un B-tree ordena por prefijo y `ILIKE '%texto%'` no tiene prefijo: el
    // índice existiría y no se usaría nunca. Es el error silencioso a evitar.
    for (const indice of [
      'procesos_numero_radicado_idx',
      'procesos_juzgado_idx',
      'clientes_nombre_idx',
      'clientes_razon_social_idx',
      'usuario_nombre_idx',
    ]) {
      const linea = sqlDeMigraciones
        .split('\n')
        .find((l) => l.includes(`"${indice}"`));
      expect(linea).toBeDefined();
      expect(linea).toContain('USING GIN');
      expect(linea).toContain('gin_trgm_ops');
    }
  });

  it('El esquema declara los mismos índices que la migración creó', () => {
    // Si divergen, la próxima migración generada intentaría "arreglar" la
    // diferencia y borraría o duplicaría índices.
    expect(esquema).toMatch(/@@index\(\[tenant_id, create_at\(sort: Desc\)\]\)/);
    expect(esquema).toMatch(/@@index\(\[tenant_id, estado\]\)/);
    expect(esquema).toMatch(/@@index\(\[tenant_id, tipo_proceso\]\)/);
    expect(esquema).toMatch(/@@index\(\[id_abogado_resp\]\)/);
    expect(esquema).toMatch(/@@index\(\[id_usuario\]\)/);

    const ginsEnEsquema = (esquema.match(/type: Gin/g) || []).length;
    expect(ginsEnEsquema).toBe(5);
  });
});

describe('RNF05.5 · Ningún campo de la búsqueda se queda sin índice', () => {
  it('Los campos que recorre `getProcesos` son exactamente los indexados', () => {
    // Esta es la prueba que importa a futuro. Añadir un sexto campo a la
    // búsqueda —el número de documento del cliente, la clase de proceso— es
    // una línea, y sin índice devuelve la consulta a recorrer la tabla entera
    // sin que nadie lo note hasta que haya volumen. Entonces esto falla.
    const controlador = fs.readFileSync(
      path.join(RAIZ, 'src', 'modules', 'procesos', 'procesos.controller.js'),
      'utf8'
    );

    const buscados = new Set(
      [...controlador.matchAll(/(\w+):\s*\{\s*contains:\s*term/g)].map((m) => m[1])
    );

    // Los cinco campos de texto libre de RNF05, ya sin duplicar `nombre`, que
    // aparece dos veces: el del cliente y el del abogado responsable.
    expect([...buscados].sort()).toEqual(
      ['juzgado', 'nombre', 'numero_radicado', 'razon_social'].sort()
    );

    // Y cada uno tiene su índice de trigramas.
    for (const campo of buscados) {
      const tieneIndice = sqlDeMigraciones.includes(`USING GIN ("${campo}" gin_trgm_ops)`);
      expect(tieneIndice).toBe(true);
    }
  });

  it('La búsqueda parcial sigue exigiendo 3 caracteres (RNF05.3)', () => {
    // No es una coincidencia que sean tres: es el tamaño del trigrama. Con dos
    // caracteres el índice no puede acotar nada y la consulta vuelve a recorrer
    // la tabla completa. El umbral es parte de la garantía, no un detalle de
    // usabilidad.
    const controlador = fs.readFileSync(
      path.join(RAIZ, 'src', 'modules', 'procesos', 'procesos.controller.js'),
      'utf8'
    );

    expect(controlador).toMatch(/search\.trim\(\)\.length >= 3/);
  });
});
