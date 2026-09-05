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
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { spawn } = require('node:child_process');
const { pipeline } = require('node:stream/promises');

/**
 * Carga `backend/.env` sin depender de que `dotenv` esté instalado.
 *
 * Este guion tiene que poder correr **en el host del servidor**, y ahi no hay
 * `node_modules`: todo se instala dentro de la imagen de Docker. Tampoco sirve
 * ejecutarlo dentro del contenedor del backend, porque ese no lleva `pg_dump`
 * —solo lo tiene el de PostgreSQL—. El host es el unico sitio desde el que se
 * alcanzan las dos cosas: Node por un lado y, por el otro, la base a traves de
 * `docker compose exec postgres pg_dump`.
 *
 * Aparte de esto, el guion solo usa modulos propios de Node. Quitando esta
 * dependencia queda **autonomo**: para el respaldo nocturno basta con Node y
 * Docker, que es lo que el servidor ya tiene.
 *
 * Se usa `dotenv` cuando esta disponible —dentro del contenedor lo esta— y se
 * recurre al lector propio cuando no. En ambos casos **no se pisa** lo que ya
 * venga en el entorno, que es como se comporta `dotenv`: permite fijar
 * `RESPALDO_DIR` o `PG_DUMP` delante del comando sin tocar el archivo.
 */
function cargarEntorno() {
  try {
    require('dotenv').config();
    return;
  } catch {
    /* sin dotenv: se lee el archivo a mano, justo debajo */
  }

  const archivo = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(archivo)) return;

  for (const linea of fs.readFileSync(archivo, 'utf8').split(/\r?\n/)) {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith('#')) continue;

    const corte = limpia.indexOf('=');
    if (corte === -1) continue;

    // Se admite el prefijo `export`, habitual cuando el mismo archivo se
    // carga tambien desde la shell.
    const clave = limpia.slice(0, corte).replace(/^export\s+/, '').trim();
    if (!clave || clave in process.env) continue;

    let valor = limpia.slice(corte + 1).trim();
    const comilla = valor[0];
    if ((comilla === '"' || comilla === "'") && valor.endsWith(comilla)) {
      valor = valor.slice(1, -1);
    }

    process.env[clave] = valor;
  }
}

cargarEntorno();

const DIRECTORIO = process.env.RESPALDO_DIR || path.join(__dirname, '..', '..', 'respaldos');
const DIAS_RETENCION = Number(process.env.RESPALDO_DIAS || 30); // RNF10.4
/**
 * Cómo llamar a `pg_dump`.
 *
 * Se parte en palabras porque a menudo NO es un binario suelto. En este
 * despliegue el cliente de PostgreSQL no está en el host ni en la imagen del
 * backend —solo en el contenedor de la base—, así que la forma de invocarlo es:
 *
 *   PG_DUMP="docker compose exec -T postgres pg_dump" npm run respaldo
 *
 * `spawn` no pasa por una shell: si se le entrega esa cadena entera busca un
 * ejecutable llamado literalmente «docker compose exec -T postgres pg_dump» y
 * falla con ENOENT. Tampoco se quiere una shell de por medio —invitaría a
 * inyectar por la variable de entorno—, así que se separa aquí: la primera
 * palabra es el programa y el resto son argumentos que van delante de los
 * nuestros.
 */
const [PG_DUMP, ...PREFIJO] = (process.env.PG_DUMP || 'pg_dump').trim().split(/\s+/);

/** Nombre reconocible y ordenable: sgpa-2026-09-03T16-45-02.sql.gz */
const nombreDeHoy = () => {
  // Se corta por posición en vez de con una expresión regular: la marca ISO
  // tiene forma fija (2026-09-03T20:20:02.123Z) y `/\..+$/` retrocede.
  const marca = new Date().toISOString().slice(0, 19).replaceAll(':', '-');
  return `sgpa-${marca}.sql.gz`;
};

/** Solo se toca lo que este guion escribió. Nunca un glob sobre la carpeta. */
const ES_RESPALDO = /^sgpa-\d{4}-\d{2}-\d{2}T[\d-]+\.sql\.gz$/;

/**
 * `DATABASE_URL` está escrita para Prisma, no para `pg_dump`.
 *
 * Prisma admite parámetros propios que libpq desconoce y que hacen fallar al
 * volcado con un error poco evidente: *«parámetro de URI no válido: schema»*.
 * El más habitual es `?schema=public`, y **se descarta, no se traduce**: le
 * dice a Prisma dónde trabajar, no qué respaldar. Convertirlo en la opción
 * `--schema` de pg_dump fue un error que costó los índices de trigramas en la
 * restauración; ver el comentario de `volcar`.
 */
function traducirUrl(bruta) {
  const url = new URL(bruta);

  // Lo que libpq sí entiende y conviene conservar: afecta a cómo se conecta.
  const ADMITIDOS = new Set([
    'sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'connect_timeout',
    'application_name', 'options',
  ]);

  for (const clave of Array.from(url.searchParams.keys())) {
    if (!ADMITIDOS.has(clave)) url.searchParams.delete(clave);
  }

  return url.toString();
}

async function volcar(destino) {
  const bruta = process.env.DATABASE_URL;
  if (!bruta) throw new Error('Falta DATABASE_URL: no hay base que respaldar.');
  const url = traducirUrl(bruta);

  // `--no-owner` y `--no-privileges`: el volcado tiene que poder restaurarse en
  // un servidor donde los roles no se llamen igual. En una urgencia, el destino
  // puede ser una máquina recién levantada.
  //
  // **Sin `--clean`, y es una decisión, no un olvido.** Esa opción antepone los
  // `DROP` de todo lo que va a recrear, y trae dos problemas. El técnico:
  // intenta borrar el esquema `public`, del que depende la extensión
  // `pg_trgm` —la de los índices de búsqueda—, y PostgreSQL lo rechaza; se vio
  // al probar la restauración de verdad. El grave: un volcado que empieza
  // borrando es un arma apuntando a la base de destino. Si la restauración
  // falla a mitad, lo que queda no es la base vieja ni la nueva.
  //
  // Se restaura sobre una base **vacía**, que además es la maniobra correcta:
  // crear una al lado, restaurar, comprobar, y solo entonces apuntar la
  // aplicación. Nunca encima de la que está en producción.
  // **Se vuelca la base entera, no un esquema.** Aquí hubo un error que solo
  // apareció al restaurar de verdad: acotar con `--schema public` —traduciendo
  // el `?schema=` de Prisma— deja fuera las **extensiones**, porque pertenecen
  // a la base y no al esquema. El volcado se restauraba «bien» y sin `pg_trgm`
  // los cinco índices de trigramas fallaban uno a uno: los datos volvían y la
  // búsqueda indexada de HU-31 desaparecía en silencio.
  //
  // Para un respaldo, acotar nunca fue lo correcto. `?schema=` le dice a Prisma
  // dónde trabajar; una copia de seguridad tiene que traerlo todo.
  const opciones = [...PREFIJO, '--no-owner', '--no-privileges', url];

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
    if (Number.isNaN(fecha.getTime()) || fecha.getTime() >= limite) continue;

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

  // La orden de restauración **no lleva la URL dentro**, ni siquiera con la
  // contraseña tapada.
  //
  // Este guion corre en `cron` con la salida redirigida a un registro.
  // Imprimir la URL entera escribiría la clave de la base en un archivo del
  // servidor todas las noches —así estaba escrito al principio, y era un
  // fallo—. Enmascararla lo arreglaba a medias: el valor del entorno seguiría
  // pasando por la salida, y basta que alguien «mejore» el mensaje para
  // destaparlo otra vez.
  //
  // La expansión de la shell resuelve las dos cosas. `%%\?*` recorta desde la
  // primera interrogación —el `?schema=` de Prisma, que hace fallar a `psql`
  // con «parámetro de URI no válido»— y la orden queda copiable tal cual sin
  // que el secreto haya pasado nunca por este código.
  console.log('  Para restaurar, sobre una base VACÍA y con DATABASE_URL en el entorno:');
  console.log(`    createdb sgpa_restaurada`);
  console.log(`    gunzip -c ${path.basename(destino)} | psql "\${DATABASE_URL%%\\?*}"\n`);
  console.log('  Nunca encima de la base en uso: se restaura al lado, se comprueba,');
  console.log('  y solo entonces se apunta la aplicación.\n');
}

main().catch((error) => {
  // El código de salida importa: es lo que cron mira para avisar de que el
  // respaldo de anoche no se hizo. Un fallo silencioso es peor que no tener
  // respaldos, porque además da confianza.
  console.error(`\n  ✗ EL RESPALDO NO SE COMPLETÓ: ${error.message}\n`);
  process.exit(1);
});
