/**
 * Verifica que la búsqueda de expedientes esté REALMENTE indexada — RNF05.5 /
 * HU-31.5.
 *
 * Crear un índice y comprobar que la consulta sigue respondiendo rápido no
 * demuestra nada mientras la tabla sea pequeña: con pocas filas, PostgreSQL
 * recorre la tabla entera porque le sale más barato que abrir un índice, y el
 * cronómetro dice 6 ms tanto si el índice existe como si no. Ese era justamente
 * el estado que HU-31 declaraba: «hoy sí, sin índices que lo garanticen al
 * crecer».
 *
 * Así que este guion no mide tiempo. Pregunta otra cosa, que es la que importa:
 * **¿existe un camino indexado para cada consulta que hace el controlador?** Se
 * apaga el recorrido secuencial (`enable_seqscan = off`) y se pide el plan. Con
 * el recorrido de tabla penalizado, PostgreSQL usará cualquier índice que le
 * sirva; si aun así elige recorrer la tabla entera, es que NO tiene ninguno que
 * sirva, y eso es exactamente lo que hay que detectar.
 *
 * Ese es el caso que se comprueba, y no «¿usó el índice que yo esperaba?». La
 * diferencia importa: mientras la tabla esté vacía, dos índices que empiezan por
 * la misma columna cuestan lo mismo y el planificador elige entre ellos casi al
 * azar. Exigir uno concreto daría un fallo falso hoy y ninguna garantía mañana.
 * Lo que sí se exige, por separado, es que el índice pensado para cada consulta
 * exista de verdad en la base de datos.
 *
 * Lo que este guion detectaría, y era el riesgo real: un índice B-tree puesto
 * donde hace falta uno de trigramas. Un B-tree no puede resolver `ILIKE
 * '%texto%'`, así que su consulta seguiría apareciendo como recorrido completo
 * incluso con el recorrido penalizado.
 *
 * `enable_seqscan = off` no prohíbe el recorrido secuencial, solo lo encarece.
 * Es una sugerencia de sesión: no toca la configuración del servidor y se
 * deshace al cerrar la conexión.
 *
 * Uso:  node -r dotenv/config scripts/verificar-indices-busqueda.js
 */
const prisma = require('../src/config/prisma');

// Las consultas son las que emite `getProcesos` en procesos.controller.js,
// escritas a mano en SQL porque lo que se inspecciona es el plan, no el ORM.
// Un UUID cualquiera basta: el plan no depende del valor, solo de la forma.
const TENANT = '00000000-0000-0000-0000-000000000000';

const CASOS = [
  {
    nombre: 'Listado por consultorio, ordenado por fecha (paginación de 20)',
    indice: 'procesos_tenant_id_create_at_idx',
    sql: `SELECT * FROM procesos WHERE tenant_id = $1::uuid
          ORDER BY create_at DESC LIMIT 20`,
  },
  {
    nombre: 'Filtro por estado combinado con el consultorio',
    indice: 'procesos_tenant_id_estado_idx',
    sql: `SELECT * FROM procesos WHERE tenant_id = $1::uuid AND estado = 'ACTIVO'`,
  },
  {
    nombre: 'Filtro por tipo de proceso combinado con el consultorio',
    indice: 'procesos_tenant_id_tipo_proceso_idx',
    sql: `SELECT * FROM procesos WHERE tenant_id = $1::uuid AND tipo_proceso = 'ORDINARIO'`,
  },
  {
    nombre: 'Expedientes de los que una persona es responsable',
    indice: 'procesos_id_abogado_resp_idx',
    sql: `SELECT * FROM procesos WHERE id_abogado_resp = $1::uuid`,
  },
  {
    nombre: 'Expedientes en los que una persona figura como equipo',
    indice: 'proceso_abogados_id_usuario_idx',
    sql: `SELECT * FROM proceso_abogados WHERE id_usuario = $1::uuid`,
  },
  {
    nombre: 'Búsqueda parcial por radicado (3 caracteres)',
    indice: 'procesos_numero_radicado_idx',
    sql: `SELECT * FROM procesos WHERE numero_radicado ILIKE '%110%'`,
  },
  {
    nombre: 'Búsqueda parcial por juzgado',
    indice: 'procesos_juzgado_idx',
    sql: `SELECT * FROM procesos WHERE juzgado ILIKE '%civil%'`,
  },
  {
    nombre: 'Búsqueda parcial por nombre de cliente',
    indice: 'clientes_nombre_idx',
    sql: `SELECT * FROM clientes WHERE nombre ILIKE '%rodr%'`,
  },
  {
    nombre: 'Búsqueda parcial por razón social',
    indice: 'clientes_razon_social_idx',
    sql: `SELECT * FROM clientes WHERE razon_social ILIKE '%s.a.s%'`,
  },
  {
    nombre: 'Búsqueda parcial por nombre del abogado responsable',
    indice: 'usuario_nombre_idx',
    sql: `SELECT * FROM usuario WHERE nombre ILIKE '%mar%'`,
  },
];

async function planDe(sql, usaParametro) {
  const filas = usaParametro
    ? await prisma.$queryRawUnsafe(`EXPLAIN ${sql}`, TENANT)
    : await prisma.$queryRawUnsafe(`EXPLAIN ${sql}`);
  return filas.map((f) => f['QUERY PLAN']).join('\n');
}

async function main() {
  console.log('\nRNF05.5 / HU-31.5 — ¿está indexada la búsqueda de expedientes?\n');

  // La extensión de trigramas es la condición previa de la mitad de los casos.
  const [{ instalada }] = await prisma.$queryRawUnsafe(
    `SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') AS instalada`
  );
  console.log(`  Extensión pg_trgm: ${instalada ? 'instalada' : 'NO INSTALADA'}`);
  if (!instalada) {
    console.log('  Sin ella, las búsquedas parciales no pueden estar indexadas.');
  }
  console.log('');

  // Qué índices existen realmente. Se pregunta a la base, no al esquema: lo que
  // decide es lo que está aplicado, no lo que dice el archivo.
  const existentes = new Set(
    (await prisma.$queryRawUnsafe(`SELECT indexname FROM pg_indexes WHERE schemaname = 'public'`))
      .map((f) => f.indexname)
  );

  await prisma.$executeRawUnsafe('SET enable_seqscan = off');

  const fallos = [];

  for (const caso of CASOS) {
    const usaParametro = caso.sql.includes('$1');
    let plan;
    try {
      plan = await planDe(caso.sql, usaParametro);
    } catch (error) {
      fallos.push({ ...caso, motivo: `la consulta falló: ${error.message}` });
      console.log(`  ✗ ${caso.nombre}\n      ${error.message}`);
      continue;
    }

    const indiceExiste = existentes.has(caso.indice);
    const recorreLaTabla = plan.includes('Seq Scan');

    if (!indiceExiste) {
      fallos.push({ ...caso, motivo: `el índice ${caso.indice} no existe en la base de datos` });
      console.log(`  ✗ ${caso.nombre}\n      falta el índice ${caso.indice}`);
      continue;
    }

    if (recorreLaTabla) {
      fallos.push({ ...caso, motivo: 'ni con el recorrido secuencial penalizado hay un índice que sirva' });
      console.log(`  ✗ ${caso.nombre}\n      recorre la tabla entera pese a la penalización. Plan:`);
      console.log(plan.split('\n').map((l) => `        ${l}`).join('\n'));
      continue;
    }

    // El índice elegido, para poder leer el resultado. Que no sea el previsto
    // no es un fallo: con la tabla vacía, dos índices con la misma primera
    // columna empatan en coste y el planificador desempata como quiere.
    const elegido = (plan.match(/using (\w+)/) || [])[1];
    const nota = elegido && elegido !== caso.indice
      ? ` (el planificador prefirió ${elegido}; empatan mientras la tabla esté vacía)`
      : '';
    console.log(`  ✓ ${caso.nombre}\n      ${caso.indice} existe y la consulta va por índice${nota}`);
  }

  await prisma.$executeRawUnsafe('SET enable_seqscan = on');

  console.log('');
  if (fallos.length === 0) {
    console.log(`Los ${CASOS.length} caminos de la búsqueda tienen índice y ninguno recorre la tabla entera.\n`);
    console.log('Esto no promete un tiempo de respuesta concreto: promete que ninguna');
    console.log('de estas consultas tendrá que leer la tabla completa cuando crezca,');
    console.log('que es lo único que hoy explica los milisegundos y lo que dejaba');
    console.log('HU-31.5 en el aire.\n');
    return 0;
  }

  console.log(`${fallos.length} de ${CASOS.length} consultas NO están indexadas:\n`);
  for (const f of fallos) {
    console.log(`  · ${f.nombre} — ${f.motivo}`);
  }
  console.log('');
  return 1;
}

main()
  .then(async (codigo) => {
    await prisma.$disconnect();
    process.exit(codigo);
  })
  .catch(async (error) => {
    console.error('\nNo se pudo completar la verificación:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  });
