/**
 * Coherencia entre la documentación técnica y la carpeta de sustentación.
 *
 *   npm run verificar:docs
 *
 * Este proyecto nació de un problema concreto: documentación que no
 * correspondía al sistema. Tener ahora DOS carpetas de documentos con la misma
 * numeración es repetir esa exposición, salvo que algo lo vigile.
 *
 * Esto es ese algo. Comprueba que ningún identificador exista en una carpeta y
 * falte en la otra, y que los recuentos que la documentación afirma coincidan
 * con el código.
 */
const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..', '..');
const TECNICA = path.join(RAIZ, 'docs');
const SUSTENTACION = path.join(RAIZ, 'documentacion-a-presentar');

const resultados = [];
const comprobar = (titulo, ok, detalle) => resultados.push({ titulo, ok, detalle });

/** Lee todos los .md de una carpeta, sin bajar a subcarpetas de histórico. */
function leerMarkdown(dir, omitir = []) {
  let texto = '';
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    if (omitir.includes(entrada.name)) continue;
    const ruta = path.join(dir, entrada.name);
    if (entrada.isDirectory()) texto += leerMarkdown(ruta, omitir);
    else if (entrada.name.endsWith('.md')) texto += fs.readFileSync(ruta, 'utf8');
  }
  return texto;
}

/** Extrae identificadores del tipo RF01, RNF02, RN03, HU-04. */
function extraer(texto, patron) {
  return new Set((texto.match(patron) || []).map((s) => s.toUpperCase()));
}

const diferencia = (a, b) => [...a].filter((x) => !b.has(x)).sort();

// ── Lectura ───────────────────────────────────────────────────────────
// De la técnica se omite `historico/`: describe versiones superadas del
// sistema a propósito, y sus identificadores no tienen por qué coincidir.
const tecnica = leerMarkdown(TECNICA, ['historico', 'fuentes']);
const sustentacion = leerMarkdown(SUSTENTACION);

// ── 1. Identificadores ────────────────────────────────────────────────
const TIPOS = [
  { nombre: 'requisitos funcionales (RF)', patron: /\bRF\d{2}\b/g },
  { nombre: 'requisitos no funcionales (RNF)', patron: /\bRNF\d{2}\b/g },
  { nombre: 'reglas de negocio (RN)', patron: /\bRN\d{2}\b/g },
  { nombre: 'historias de usuario (HU)', patron: /\bHU-\d{2}\b/g },
];

for (const { nombre, patron } of TIPOS) {
  const enTecnica = extraer(tecnica, patron);
  const enSustentacion = extraer(sustentacion, patron);

  const soloTecnica = diferencia(enTecnica, enSustentacion);
  const soloSustentacion = diferencia(enSustentacion, enTecnica);

  const ok = soloTecnica.length === 0 && soloSustentacion.length === 0;
  let detalle = `${enTecnica.size} en docs/ · ${enSustentacion.size} en la carpeta de sustentación`;
  if (!ok) {
    if (soloTecnica.length) detalle += `\n           Falta en sustentación: ${soloTecnica.join(', ')}`;
    if (soloSustentacion.length) detalle += `\n           Falta en docs/: ${soloSustentacion.join(', ')}`;
  }
  comprobar(`Los ${nombre} coinciden`, ok, detalle);
}

// ── 2. Recuentos contra el código ─────────────────────────────────────
function contarEndpoints() {
  const dir = path.join(RAIZ, 'backend', 'src', 'modules');
  let total = 0;
  for (const modulo of fs.readdirSync(dir)) {
    const rutas = path.join(dir, modulo, `${modulo}.routes.js`);
    if (!fs.existsSync(rutas)) continue;
    const contenido = fs.readFileSync(rutas, 'utf8');
    total += (contenido.match(/router\.(get|post|put|patch|delete)\(/g) || []).length;
  }
  return total;
}

const endpointsReales = contarEndpoints();
const declarados = sustentacion.match(/(\d+)\s+endpoints/);
comprobar(
  'El número de endpoints declarado coincide con el código',
  declarados ? Number(declarados[1]) === endpointsReales : false,
  `código: ${endpointsReales} · documentado: ${declarados ? declarados[1] : 'no se declara'}`
);

const modulosReales = fs.readdirSync(path.join(RAIZ, 'backend', 'src', 'modules')).length;
const modulosDeclarados = sustentacion.match(/(\d+)\s+módulos/);
comprobar(
  'El número de módulos declarado coincide con el código',
  modulosDeclarados ? Number(modulosDeclarados[1]) === modulosReales : false,
  `código: ${modulosReales} · documentado: ${modulosDeclarados ? modulosDeclarados[1] : 'no se declara'}`
);

// ── 3. Estructura esperada ────────────────────────────────────────────
const ESPERADOS = [
  'README.md',
  'documentos/01-PROBLEMA-OBJETIVOS-ALCANCE.md',
  'documentos/02-REGLAS-DE-NEGOCIO.md',
  'documentos/03-REQUISITOS-FUNCIONALES.md',
  'documentos/04-REQUISITOS-NO-FUNCIONALES.md',
  'documentos/05-HISTORIAS-DE-USUARIO.md',
  'documentos/06-TRAZABILIDAD.md',
  'documentos/07-ARQUITECTURA.md',
  'documentos/08-MODELO-DE-DATOS.md',
  'diagramas/01-idea-de-negocio.md',
  'diagramas/02-arbol-del-problema.md',
  'diagramas/03-descomposicion-funcional.md',
  'diagramas/04-casos-de-uso.md',
  'diagramas/05-flujos-principales.md',
  'diagramas/06-entidad-relacion.md',
  'diagramas/07-clases.md',
  'diagramas/08-componentes.md',
  'diagramas/09-actividades.md',
  'diagramas/10-arquitectura-y-despliegue.md',
];

const faltantes = ESPERADOS.filter((f) => !fs.existsSync(path.join(SUSTENTACION, f)));
comprobar(
  'Están los 19 archivos de la carpeta de sustentación',
  faltantes.length === 0,
  faltantes.length === 0 ? 'completos' : `faltan: ${faltantes.join(', ')}`
);

// ── 4. Las 37 historias tienen ficha propia ───────────────────────────
const fichas = fs.readFileSync(
  path.join(SUSTENTACION, 'documentos', '05-HISTORIAS-DE-USUARIO.md'), 'utf8'
);
const sinFicha = [];
for (let i = 1; i <= 37; i++) {
  const id = `HU-${String(i).padStart(2, '0')}`;
  if (!fichas.includes(`## ${id} ·`)) sinFicha.push(id);
}
comprobar(
  'Las 37 historias tienen ficha propia',
  sinFicha.length === 0,
  sinFicha.length === 0 ? '37 fichas' : `sin ficha: ${sinFicha.join(', ')}`
);

// ── 5. Los diagramas contienen diagramas ──────────────────────────────
const sinMermaid = [];
for (const archivo of ESPERADOS.filter((f) => f.startsWith('diagramas/'))) {
  const contenido = fs.readFileSync(path.join(SUSTENTACION, archivo), 'utf8');
  if (!contenido.includes('```mermaid')) sinMermaid.push(path.basename(archivo));
}
comprobar(
  'Cada archivo de diagramas contiene al menos un diagrama',
  sinMermaid.length === 0,
  sinMermaid.length === 0 ? '10 archivos con Mermaid' : `sin diagrama: ${sinMermaid.join(', ')}`
);

// ── Informe ───────────────────────────────────────────────────────────
console.log('\n  Coherencia entre docs/ y documentacion-a-presentar/\n');
for (const r of resultados) {
  console.log(`  ${r.ok ? ' OK ' : 'FALLA'}  ${r.titulo}`);
  console.log(`          ${r.detalle}\n`);
}

const ok = resultados.filter((r) => r.ok).length;
console.log(`  ${ok} de ${resultados.length} comprobaciones correctas.\n`);

if (ok !== resultados.length) {
  console.log('  Si un identificador aparece en una carpeta y no en la otra, las dos');
  console.log('  documentaciones han empezado a divergir. Es exactamente el problema');
  console.log('  que originó este proyecto.\n');
}

process.exit(ok === resultados.length ? 0 : 1);
