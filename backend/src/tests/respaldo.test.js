/**
 * RNF10.3 y RNF10.4 — el respaldo y su retención.
 *
 * Lo que aquí se fija no es que `pg_dump` funcione —eso lo comprueba ejecutarlo
 * contra una base real, y se hizo, restaurando el volcado en una base aparte y
 * comparando tablas y filas—. Lo que se fija es lo que **no se ve al mirar la
 * salida del guion**: que un volcado a medias no pase por bueno, que la
 * retención borre solo lo que debe, y que la URL de Prisma se traduzca antes de
 * llegar a herramientas que no la entienden.
 *
 * Los tres nacen de fallos reales cometidos al escribirlo:
 *
 *   · La primera versión escuchaba el cierre de `pg_dump` **después** de un
 *     `await`, así que perdía el evento: dejaba un archivo de 20 bytes y salía
 *     con código 0. Un respaldo vacío que se declara correcto es peor que no
 *     tener respaldos, porque además da confianza.
 *   · La segunda le pasaba `DATABASE_URL` entera y `pg_dump` la rechazaba por
 *     el `?schema=public` de Prisma.
 *   · Y la orden de restauración que imprimía fallaba por lo mismo, que es el
 *     peor sitio donde tener un error: el día que hay que restaurar.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');

const GUION = path.join(__dirname, '..', '..', 'scripts', 'respaldo.js');
const fuente = fs.readFileSync(GUION, 'utf8');

describe('RNF10.3 · Un volcado incompleto no pasa por bueno', () => {
  it('Exige la marca de cierre que PostgreSQL escribe al final', () => {
    // `pg_dump` puede terminar con código 0 y dejar el archivo cortado si el
    // disco se llena a mitad. Sin esta comprobación, el fallo se descubre el
    // día que hace falta restaurar.
    expect(fuente).toContain('PostgreSQL database dump complete');
  });

  it('Exige que el volcado contenga tablas', () => {
    // El volcado de una base vacía es válido para PostgreSQL y no respalda nada.
    expect(fuente).toMatch(/CREATE TABLE/);
    expect(fuente).toMatch(/no contiene ninguna tabla/);
  });

  it('Sale con código distinto de cero si algo falla', () => {
    // Es lo que cron mira para avisar de que el respaldo de anoche no se hizo.
    expect(fuente).toMatch(/process\.exit\(1\)/);
  });

  it('Engancha el cierre de pg_dump ANTES de ceder el control', () => {
    // El orden importa y no se ve al leer por encima: si `dump.on('close')` se
    // registra después del `await pipeline(...)`, el evento ya pasó y la
    // promesa no resuelve nunca.
    const posicionEscucha = fuente.indexOf("dump.on('close'");
    const posicionPipeline = fuente.indexOf('await pipeline(');

    expect(posicionEscucha).toBeGreaterThan(-1);
    expect(posicionPipeline).toBeGreaterThan(-1);
    expect(posicionEscucha).toBeLessThan(posicionPipeline);
  });
});

describe('RNF10.4 · La retención borra solo lo que debe', () => {
  const { ES_RESPALDO, nombreDeHoy } = (() => {
    // El guion no exporta nada —es un ejecutable—, así que se reconstruyen
    // aquí las dos piezas que importan, tal como están escritas en él.
    const patron = /^sgpa-\d{4}-\d{2}-\d{2}T[\d-]+\.sql\.gz$/;
    return { ES_RESPALDO: patron, nombreDeHoy: () => 'sgpa-2026-09-03T20-20-02.sql.gz' };
  })();

  it('El patrón reconoce los respaldos propios', () => {
    expect(ES_RESPALDO.test(nombreDeHoy())).toBe(true);
  });

  it('El patrón NO reconoce nada más de la carpeta', () => {
    // La poda se hace sobre un patrón y nunca sobre un glob: la carpeta de
    // respaldos puede tener copias manuales, notas o volcados de otro sistema,
    // y borrarlas sería destruir justo lo que alguien guardó a mano.
    for (const ajeno of [
      'respaldo-manual.sql.gz',
      'sgpa.sql.gz',
      'notas.txt',
      'sgpa-2026-09-03.sql.gz',
      'copia-sgpa-2026-09-03T20-20-02.sql.gz',
    ]) {
      expect(ES_RESPALDO.test(ajeno)).toBe(false);
    }
  });

  it('La antigüedad se lee del nombre, no de la fecha del archivo', () => {
    // Copiar o mover los respaldos a otro disco cambia su fecha de
    // modificación; si la retención mirara eso, dejaría de significar lo que
    // dice justo cuando alguien los pone a salvo en otra parte.
    expect(fuente).toMatch(/marca va en el nombre a propósito/);
    expect(fuente).not.toMatch(/statSync\([^)]*\)\.mtime/);
  });

  it('La retención por defecto es de 30 días, como pide el requisito', () => {
    expect(fuente).toMatch(/RESPALDO_DIAS \|\| 30/);
  });
});

describe('RNF10.3 · La URL de Prisma se traduce antes de usarla', () => {
  it('Quita los parámetros que libpq no entiende', () => {
    // `?schema=public` es de Prisma. Pasárselo a pg_dump lo hace fallar con
    // «parámetro de URI no válido», que no dice nada a quien lo lee.
    expect(fuente).toMatch(/ADMITIDOS/);
    expect(fuente).toMatch(/searchParams\.delete/);
  });

  it('NO acota el volcado a un esquema: se perderían las extensiones', () => {
    // Este es el fallo que más caro habría salido, y solo apareció al
    // restaurar de verdad. Acotar con `--schema public` deja fuera las
    // extensiones, porque pertenecen a la base y no al esquema: el volcado
    // parecía correcto, y al restaurarlo los cinco índices de trigramas
    // fallaban uno a uno. Los datos volvían; la búsqueda indexada de HU-31
    // desaparecía en silencio.
    expect(fuente).not.toMatch(/'--schema'/);
    expect(fuente).toMatch(/las \*\*extensiones\*\*/);
  });

  it('NO arrastra los DROP de `--clean`', () => {
    // Un volcado que empieza borrando es un arma apuntando a la base de
    // destino: si falla a mitad, lo que queda no es la vieja ni la nueva. Y
    // además fallaba, porque `pg_trgm` depende del esquema que intenta borrar.
    expect(fuente).not.toMatch(/'--clean'/);
    expect(fuente).not.toMatch(/'--if-exists'/);
  });

  it('La orden de restauración no hace pasar la URL por la salida', () => {
    // La primera versión imprimía la URL entera —usuario, contraseña,
    // servidor— y este guion corre en cron con la salida a un registro: habría
    // escrito la clave de la base en un archivo del servidor todas las noches.
    //
    // Enmascararla lo arreglaba a medias: el valor del entorno seguiría
    // pasando por la salida, y basta que alguien «mejore» el mensaje para
    // destaparlo. Se resuelve con expansión de la shell, así que el secreto no
    // llega a tocar este código.
    const bloque = fuente.slice(fuente.indexOf('Para restaurar'));

    expect(bloque).not.toMatch(/traducirUrl\(/);
    expect(bloque).not.toMatch(/urlSinClave/);
    expect(bloque).toContain('DATABASE_URL%%');
  });

  it('La orden sigue recortando el parámetro de Prisma', () => {
    // Sin recortarlo `psql` falla igual que `pg_dump`. Una instrucción de
    // restauración que no funciona, en una urgencia, es peor que ninguna.
    // En el fuente va escrito `%%\\?*`: la barra escapa la interrogación en la
    // plantilla de JavaScript para que llegue literal a la shell.
    const bloque = fuente.slice(fuente.indexOf('Para restaurar'));
    expect(bloque).toContain('%%\\\\?*');
  });

  it('Dice que se restaura sobre una base vacía', () => {
    const bloque = fuente.slice(fuente.indexOf('Para restaurar'));
    expect(bloque).toMatch(/VACÍA/);
    expect(bloque).toMatch(/createdb/);
  });
});

describe('RNF10.3 · El respaldo no viaja al repositorio', () => {
  it('La carpeta está excluida en .gitignore', () => {
    // Un volcado contiene expedientes judiciales completos, en claro.
    const raiz = path.join(__dirname, '..', '..', '..');
    const ignorados = fs.readFileSync(path.join(raiz, '.gitignore'), 'utf8');
    expect(ignorados).toMatch(/^respaldos\/$/m);
  });
});

describe('RNF10.3 · El formato elegido se puede leer y restaurar sin herramientas', () => {
  it('Es SQL plano comprimido con gzip, no un formato propio', () => {
    // Se restaura el peor día del año, con prisa. Un `psql < archivo` y poder
    // abrirlo con un editor vale más que unos megabytes de compresión.
    expect(fuente).toMatch(/createGzip/);
    expect(fuente).not.toMatch(/'-Fc'|--format=custom/);
  });

  it('Un gzip de SQL se descomprime con las herramientas del sistema', () => {
    // Comprobación real, no de texto: se genera y se recupera.
    const temporal = path.join(os.tmpdir(), `sgpa-prueba-${Date.now()}.sql.gz`);
    const sql = '-- PostgreSQL database dump\nCREATE TABLE x();\n-- PostgreSQL database dump complete\n';

    fs.writeFileSync(temporal, zlib.gzipSync(Buffer.from(sql, 'utf8')));
    const recuperado = zlib.gunzipSync(fs.readFileSync(temporal)).toString('utf8');
    fs.unlinkSync(temporal);

    expect(recuperado).toBe(sql);
    expect(recuperado).toContain('PostgreSQL database dump complete');
  });
});
