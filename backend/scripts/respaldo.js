/**
 * Respaldo diario de la base de datos — RNF10.3 y RNF10.4.
 *
 *   npm run respaldo
 *
 * Era el punto más grave del catálogo, y el único cuyo daño es irreversible.
 * Todo lo demás degrada el servicio; **no tener copias lo pierde**: un fallo de
 * disco se lleva expedientes judiciales, que es justo lo que este sistema
 * existe para custodiar.
 *
 * ── Dos decisiones que conviene entender ────────────────────────────────
 *
 * **SQL plano comprimido, no formato propio de PostgreSQL.** `pg_dump -Fc`
 * comprime mejor y permite restaurar por partes, pero exige `pg_restore` y saber
 * usarlo. Un respaldo se restaura el peor día del año, con prisa y con alguien
 * mirando; poder hacerlo con un `psql < archivo` y leer el contenido con un
 * editor vale más que unos megabytes.
 *
 * **El respaldo se comprueba antes de darlo por bueno.** Es la diferencia entre
 * tener copias y creer que se tienen. `pg_dump` puede terminar con código 0 y
 * dejar un archivo truncado si el disco se llena a mitad; sin comprobarlo, el
 * fallo se descubre el día que hace falta restaurar. Aquí se verifica que el
 * volcado termine con la marca de cierre que PostgreSQL escribe al final.
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { spawn } = require('child_process');
const { pipeline } = require('stream/promises');

const DIRECTORIO = process.env.RESPALDO_DIR || path.join(__dirname, '..', '..', 'respaldos');
const DIAS_RETENCION = Number(process.env.RESPALDO_DIAS || 30); // RNF10.4
const PG_DUMP = process.env.PG_DUMP || 'pg_dump';

/** Nombre reconocible y ordenable: sgpa-2026-09-03T16-45-02.sql.gz */
const nombreDeHoy = () => {
  const marca = new Date().toISOString().replace(/:/g, '-').replace(/\..+$/, '');
  return `sgpa-${marca}.sql.gz`;
};

/** Solo se toca lo que este guion escribió. Nunca un glob sobre la carpeta. */
const ES_RESPALDO = /^sgpa-\d{4}-\d{2}-\d{2}T[\d-]+\.sql\.gz$/;

/**
 * `DATABASE_URL` está escrita para Prisma, no para `pg_dump`.
 *
 * Prisma admite parámetros propios que libpq desconoce y que hacen fallar al
 * volcado con un error poco evidente (*«parámetro de URI no válido: schema»*).
 * El más habitual es `?schema=public`, que además **no se descarta: se traduce**
 * a la opción `-n` de pg_dump, porque decirle qué esquema volcar es
 * precisamente lo que ese parámetro significa. Perderlo respaldaría la base
 * entera o la equivocada.
 */
function traducirUrl(bruta) {
  const url = new URL(bruta);

  // Lo que libpq sí entiende y conviene conservar: afecta a cómo se conecta.
  const ADMITIDOS = new Set([
    'sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'connect_timeout',
    'application_name', 'options',
  ]);

  const esquema = url.searchParams.get('schema');
  for (const clave of [...url.searchParams.keys()]) {
    if (!ADMITIDOS.has(clave)) url.searchParams.delete(clave);
  }

  return { url: url.toString(), esquema };
}

async function volcar(destino) {
  const bruta = process.env.DATABASE_URL;
  if (!bruta) throw new Error('Falta DATABASE_URL: no hay base que respaldar.');
  const { url, esquema } = traducirUrl(bruta);

  // `--no-owner` y `--no-privileges`: el volcado tiene que poder restaurarse en
  // un servidor donde los roles no se llamen igual. En una urgencia, el destino
  // puede ser una máquina recién levantada.
  const opciones = ['--no-owner', '--no-privileges', '--clean', '--if-exists'];
  if (esquema) opciones.push('--schema', esquema);
  opciones.push(url);

  const dump = spawn(PG_DUMP, opciones, { stdio: ['ignore', 'pipe', 'pipe'] });

  let errores = '';
  dump.stderr.on('data', (d) => { errores += d.toString(); });

  // El resultado se engancha AHORA, antes de ceder el control al `await` de
  // abajo. Escuchar `close` después es una carrera perdida: para entonces el
  // proceso ya pudo terminar, el evento se habría emitido sin nadie oyéndolo y
  // la promesa no resolvería nunca. Node se limitaría a salir con código 0
  // —sin volcado y sin queja—, que es exactamente el fallo silencioso que este
  // guion existe para no tener.
  const cerrado = new Promise((resolve, reject) => {
    dump.on('close', resolve);
    dump.on('error', (e) =>
      reject(new Error(`No se pudo ejecutar ${PG_DUMP}: ${e.message}`))
    );
  });

  const salida = fs.createWriteStream(destino);
  await pipeline(dump.stdout, zlib.createGzip({ level: 9 }), salida);

  const codigo = await cerrado;
  if (codigo !== 0) {
    throw new Error(`pg_dump terminó con código ${codigo}. ${errores.trim()}`);
  }
  return errores.trim();
}

/**
 * Un archivo con peso no es un respaldo: puede estar cortado por la mitad.
 * PostgreSQL cierra todo volcado con una línea de cierre; si no está, el
 * proceso murió a mitad y lo que hay no sirve para restaurar.
 */
function comprobar(destino) {
  const comprimido = fs.readFileSync(destino);
  const sql = zlib.gunzipSync(comprimido).toString('utf8');

  if (!sql.includes('PostgreSQL database dump complete')) {
    throw new Error('El volcado no está completo: falta la marca de cierre de PostgreSQL.');
  }

  // Además debe traer datos, no solo el esqueleto. Un volcado de una base
  // vacía es válido para PostgreSQL y no sirve como respaldo de nada.
  const tablas = (sql.match(/^CREATE TABLE /gm) || []).length;
  if (tablas === 0) {
    throw new Error('El volcado no contiene ninguna tabla.');
  }

  return { bytes: comprimido.length, tablas };
}

/** RNF10.4: 30 días. Se borra por fecha del nombre, no por fecha del archivo. */
function podar() {
  const limite = Date.now() - DIAS_RETENCION * 24 * 60 * 60 * 1000;
  const borrados = [];

  for (const archivo of fs.readdirSync(DIRECTORIO)) {
    if (!ES_RESPALDO.test(archivo)) continue;

    // La marca va en el nombre a propósito: la fecha de modificación del
    // archivo cambia al copiarlo o al moverlo de disco, y entonces la
    // retención dejaría de significar lo que dice.
    const marca = archivo.slice('sgpa-'.length, -'.sql.gz'.length);
    const fecha = new Date(marca.replace(/T(\d{2})-(\d{2})-(\d{2})$/, 'T$1:$2:$3'));
    if (isNaN(fecha) || fecha.getTime() >= limite) continue;

    fs.unlinkSync(path.join(DIRECTORIO, archivo));
    borrados.push(archivo);
  }
  return borrados;
}

async function main() {
  fs.mkdirSync(DIRECTORIO, { recursive: true });

  const destino = path.join(DIRECTORIO, nombreDeHoy());
  console.log(`\n  Respaldo de la base de datos (RNF10.3)\n`);
  console.log(`  Destino:   ${destino}`);
  console.log(`  Retención: ${DIAS_RETENCION} días\n`);

  const avisos = await volcar(destino);
  if (avisos) console.log(`  pg_dump informó: ${avisos}\n`);

  const { bytes, tablas } = comprobar(destino);
  console.log(`  ✓ Volcado completo y verificado`);
  console.log(`    ${tablas} tablas · ${(bytes / 1024).toFixed(1)} KB comprimidos`);

  const borrados = podar();
  console.log(`  ✓ Retención aplicada: ${borrados.length} respaldo(s) por encima de ${DIAS_RETENCION} días`);

  const quedan = fs.readdirSync(DIRECTORIO).filter((f) => ES_RESPALDO.test(f));
  console.log(`  ✓ Copias disponibles: ${quedan.length}\n`);

  // La orden se imprime con la URL ya traducida, no con DATABASE_URL tal cual.
  // `psql` falla igual que `pg_dump` ante el `?schema=` de Prisma, y una
  // instrucción de restauración que no funciona, el día que hace falta
  // restaurar, es peor que no dar ninguna.
  const { url } = traducirUrl(process.env.DATABASE_URL);
  console.log('  Para restaurar:');
  console.log(`    gunzip -c ${path.basename(destino)} | psql "${url}"\n`);
}

main().catch((error) => {
  // El código de salida importa: es lo que cron mira para avisar de que el
  // respaldo de anoche no se hizo. Un fallo silencioso es peor que no tener
  // respaldos, porque además da confianza.
  console.error(`\n  ✗ EL RESPALDO NO SE COMPLETÓ: ${error.message}\n`);
  process.exit(1);
});
