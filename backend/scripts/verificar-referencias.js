/**
 * Verifica que la documentación no cite cosas que no existen.
 *
 * `verificar-docs.js` comprueba que los identificadores (RF, RNF, HU) coincidan
 * entre las dos carpetas de documentación. Este guion mira hacia el **código**:
 * que cada archivo, cada ruta de la API y cada valor de enumerado que la
 * documentación menciona exista de verdad.
 *
 * Nació de una revisión manual que encontró tres desajustes reales: un estado
 * de audiencia inventado, un enumerado con los valores cambiados y dos
 * recuentos desfasados. Ninguno lo habría detectado una lectura por encima.
 *
 * Uso:  node scripts/verificar-referencias.js
 */
const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..', '..');
const DOCS = [
  path.join(RAIZ, 'documentacion-a-presentar'),
  path.join(RAIZ, 'docs'),
];

// ── Utilidades ────────────────────────────────────────────────────
function recorrer(dir, filtro, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    const completa = path.join(dir, entrada.name);
    if (entrada.isDirectory()) {
      if (entrada.name === 'node_modules' || entrada.name === '.git') continue;
      recorrer(completa, filtro, acc);
    } else if (filtro(entrada.name)) {
      acc.push(completa);
    }
  }
  return acc;
}

const esMarkdown = (n) => n.endsWith('.md');
const archivosDoc = DOCS.flatMap((d) => recorrer(d, esMarkdown));

const hallazgos = [];
const anotar = (tipo, detalle, donde) =>
  hallazgos.push({ tipo, detalle, donde: path.relative(RAIZ, donde) });

// ── 1. Rutas de la API ────────────────────────────────────────────
const rutasReales = new Set();
const modulos = path.join(RAIZ, 'backend', 'src', 'modules');

for (const archivo of recorrer(modulos, (n) => n.endsWith('.routes.js'))) {
  const modulo = path.basename(path.dirname(archivo));
  const fuente = fs.readFileSync(archivo, 'utf8');
  const patron = /router\.(get|post|put|patch|delete)\(\s*['"]([^'"]*)/g;
  let m;
  while ((m = patron.exec(fuente)) !== null) {
    const ruta = `/${modulo}${m[2]}`.replace(/\/$/, '');
    rutasReales.add(`${m[1].toUpperCase()} ${normalizar(ruta)}`);
  }
}

/** Los parámetros se escriben `:id` en el código y `{id}` en la documentación. */
function normalizar(ruta) {
  return ruta.replace(/:[A-Za-z_]+/g, '{id}').replace(/\/$/, '');
}

/**
 * Dentro de la sección de un módulo, la documentación escribe la ruta relativa
 * (`POST /login` en el apartado de `auth`). Se acepta la cita si coincide con
 * el final de alguna ruta real: exigir la ruta completa daría falsos positivos
 * en decenas de tablas que están bien.
 */
function existeRuta(verbo, ruta) {
  const clave = `${verbo} ${ruta}`;
  if (rutasReales.has(clave)) return true;
  for (const real of rutasReales) {
    if (real.startsWith(`${verbo} `) && real.endsWith(ruta)) return true;
  }
  return false;
}

// Las tablas de «rutas que no existen y podrían esperarse» citan a propósito
// rutas ausentes. Se reconocen porque van tachadas o dentro de esa sección.
const SECCION_AUSENTES = /## Rutas que no existen[\s\S]*?(?=\n## |$)/g;

for (const archivo of archivosDoc) {
  let texto = fs.readFileSync(archivo, 'utf8');
  texto = texto.replace(SECCION_AUSENTES, '');

  const patron = /(GET|POST|PUT|PATCH|DELETE)\s+`?(?:\/api)?(\/[A-Za-z0-9_:/{}-]+)/g;
  let m;
  while ((m = patron.exec(texto)) !== null) {
    const verbo = m[1];
    const ruta = normalizar(m[2]);
    if (!existeRuta(verbo, ruta)) anotar('ruta inexistente', `${verbo} ${ruta}`, archivo);
  }
}

// ── 2. Valores de enumerado ───────────────────────────────────────
const schema = fs.readFileSync(
  path.join(RAIZ, 'backend', 'prisma', 'schema.prisma'), 'utf8');

const valoresEnum = new Set();
const nombresEnum = new Set();
for (const m of schema.matchAll(/enum (\w+) \{([^}]*)\}/g)) {
  nombresEnum.add(m[1]);
  for (const linea of m[2].split('\n')) {
    const v = linea.trim();
    if (v && !v.startsWith('//')) valoresEnum.add(v);
  }
}

// Solo se revisan los bloques `enum campo "A | B | C"` de los diagramas ER:
// ahí la documentación afirma explícitamente cuáles son los valores.
for (const archivo of archivosDoc) {
  const texto = fs.readFileSync(archivo, 'utf8');
  for (const m of texto.matchAll(/enum\s+\w+\s+"([^"]+)"/g)) {
    for (const bruto of m[1].split('|')) {
      const valor = bruto.trim();
      if (!valor || valor === '...' || valor.includes(' ')) continue;
      if (!valoresEnum.has(valor)) {
        anotar('valor de enumerado inexistente', valor, archivo);
      }
    }
  }
}

// ── 3. Modelos del esquema ────────────────────────────────────────
const modelosReales = new Set(
  [...schema.matchAll(/^model (\w+)/gm)].map((m) => m[1]));

// ── 4. Archivos citados entre comillas invertidas ─────────────────
const archivosReales = new Set();
recorrer(RAIZ, (n) => /\.(js|jsx|prisma|json|ya?ml)$/.test(n))
  .forEach((p) => {
    archivosReales.add(path.basename(p));
    archivosReales.add(path.relative(RAIZ, p).replace(/\\/g, '/'));
  });

/**
 * Hay citas de archivos que **no deben existir**, y son correctas: un hallazgo
 * que señala un archivo fantasma del diagrama antiguo, o un plan que propone
 * crear uno. Se listan aquí con su motivo en vez de silenciarlas en bloque,
 * para que la excepción tenga que justificarse.
 */
const AUSENCIAS_DELIBERADAS = new Map([
  ['tenant.middleware.js', 'H-02: el diagrama antiguo lo dibujaba; nunca existió'],
  ['src/i18n/es.js', 'propuesta del plan de españolización, todavía sin hacer'],
]);

for (const archivo of archivosDoc) {
  // `docs/historico/` conserva a propósito documentos superados: describen el
  // sistema que se dejó atrás, así que citan archivos que ya no existen.
  if (archivo.replace(/\\/g, '/').includes('/docs/historico/')) continue;

  const texto = fs.readFileSync(archivo, 'utf8');
  for (const m of texto.matchAll(/`([A-Za-z0-9_./-]+\.(?:js|jsx|prisma))`/g)) {
    const cita = m[1];
    if (archivosReales.has(cita) || archivosReales.has(path.basename(cita))) continue;
    if (AUSENCIAS_DELIBERADAS.has(cita)) continue;
    anotar('archivo inexistente', cita, archivo);
  }
}

// ── 5. Inmutabilidad de la bitácora (RN01) ────────────────────────
// La documentación afirma esto y además invita a comprobarlo con un grep.
// Se vigila aquí para que la afirmación no se quede atrás si alguien añade
// una escritura nueva.
const fuenteBackend = recorrer(path.join(RAIZ, 'backend', 'src'), (n) => n.endsWith('.js'))
  .map((p) => fs.readFileSync(p, 'utf8'))
  .join('\n');

const ediciones = (fuenteBackend.match(/bitacoraAuditoria\.update/g) || []).length;
const borrados = (fuenteBackend.match(/bitacoraAuditoria\.delete/g) || []).length;

if (ediciones > 0) {
  anotar('RN01 rota', `${ediciones} edición(es) de la bitácora`,
    path.join(RAIZ, 'backend', 'src'));
}
// Uno solo, y es la baja completa de un consultorio. Dos ya sería otra cosa.
if (borrados > 1) {
  anotar('RN01 en riesgo',
    `${borrados} borrados de bitácora; solo debe existir el de la baja de consultorio`,
    path.join(RAIZ, 'backend', 'src'));
}

// ── Informe ───────────────────────────────────────────────────────
console.log('\n  Referencias de la documentación contra el código\n');
console.log(`  Rutas reales de la API: ${rutasReales.size}`);
console.log(`  Modelos en el esquema:  ${modelosReales.size}`);
console.log(`  Enumerados:             ${nombresEnum.size} (${valoresEnum.size} valores)`);
console.log(`  Documentos revisados:   ${archivosDoc.length}`);
console.log(`  Bitácora: ${ediciones} edición(es) · ${borrados} borrado(s)\n`);

if (hallazgos.length === 0) {
  console.log('  Todo lo que la documentación cita existe en el código.\n');
  process.exit(0);
}

for (const h of hallazgos) {
  console.log(`  [FALLA] ${h.tipo}: ${h.detalle}`);
  console.log(`          ${h.donde}`);
}
console.log(`\n  ${hallazgos.length} referencia(s) que no existen.\n`);
process.exit(1);
