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
// El artículo va aparte porque el género cambia: «los requisitos» pero «las
// reglas». Sin esto el informe decía «Los reglas de negocio coinciden».
const TIPOS = [
  { articulo: 'los', nombre: 'requisitos funcionales (RF)', patron: /\bRF\d{2}\b/g },
  { articulo: 'los', nombre: 'requisitos no funcionales (RNF)', patron: /\bRNF\d{2}\b/g },
  { articulo: 'las', nombre: 'reglas de negocio (RN)', patron: /\bRN\d{2}\b/g },
  { articulo: 'las', nombre: 'historias de usuario (HU)', patron: /\bHU-\d{2}\b/g },
];

for (const { articulo, nombre, patron } of TIPOS) {
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
  comprobar(`Coinciden ${articulo} ${nombre}`, ok, detalle);
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

// ── 6. Los estados coinciden entre las dos documentaciones ────────────
/**
 * La comprobación 1 mira que ningún identificador falte en una carpeta. Eso
 * dejaba pasar algo peor: que el mismo requisito exista en las dos y **cada una
 * diga una cosa distinta sobre él**.
 *
 * Ocurrió de verdad. Entre el 2 y el 3 de septiembre de 2026 se cerraron once
 * brechas; la carpeta de sustentación se mantuvo al día y `docs/` se quedó
 * atrás, de modo que los dos juegos se contradijeron en once historias y en seis
 * requisitos sin que nada avisara. Una de esas seis, RNF03, llegó a
 * contradecirse **dentro de su propia fila**: figuraba como cumplida mientras su
 * evidencia terminaba diciendo que la retención estaba pendiente.
 *
 * Comparar recuentos e identificadores no lo detecta. Hay que comparar estados.
 */

// La bandera `u` no es opcional: 🟡, 🟥 y 🔵 son pares suplentes, y sin ella una
// clase de caracteres los parte por la mitad y puede emparejar cualquier cosa.
const ESTADO = /[✅🟡🟥❌🔵❓]/u;

/**
 * Estados declarados en una tabla: `| ID | … | ESTADO | … |`.
 *
 * `patronId` se aplica a la celda del identificador y **captura** el id, para
 * admitir tanto `| RF01 |` como `| RN01 · Bitácora inmutable |`.
 */
function estadosDeTabla(texto, patronId, columna) {
  const mapa = new Map();
  for (const linea of texto.split('\n')) {
    if (!linea.startsWith('|')) continue;
    const celdas = linea.split('|').map((c) => c.trim());
    if (celdas.length <= columna) continue;

    const id = (celdas[1].match(patronId) || [])[1];
    if (!id) continue;

    const estado = (celdas[columna].match(ESTADO) || [])[0];
    if (estado) mapa.set(id, estado);
  }
  return mapa;
}

/** Estados de la carpeta de sustentación: `### RFxx · …` seguido de `**Estado X`. */
function estadosDeSeccion(texto, prefijo) {
  const mapa = new Map();
  const corte = new RegExp(`^#{2,3} (?=${prefijo}\\d{2} )`, 'm');
  for (const trozo of texto.split(corte)) {
    const id = (trozo.match(new RegExp(`^(${prefijo}\\d{2})\\b`)) || [])[1];
    if (!id) continue;
    const estado = (trozo.match(/\*\*Estado ([✅🟡🟥❌🔵❓])/u) || [])[1];
    if (estado) mapa.set(id, estado);
  }
  return mapa;
}

/** Estados de las fichas de historia: `## HU-xx · …` con `**N pts** · ESTADO`. */
function estadosDeFicha(texto) {
  const mapa = new Map();
  for (const trozo of texto.split(/^## (?=HU-\d{2} )/m)) {
    const id = (trozo.match(/^(HU-\d{2})\b/) || [])[1];
    if (!id) continue;
    const estado = (trozo.match(/pts\*\*\s*·\s*([✅🟡🟥❌])/u) || [])[1];
    if (estado) mapa.set(id, estado);
  }
  return mapa;
}

const leerDoc = (base, rel) => fs.readFileSync(path.join(base, rel), 'utf8');

const catalogoTecnico = leerDoc(TECNICA, '03-CATALOGO-REQUISITOS.md');

const FAMILIAS = [
  {
    articulo: 'los',
    nombre: 'requisitos funcionales (RF)',
    sustentacion: estadosDeSeccion(leerDoc(SUSTENTACION, 'documentos/03-REQUISITOS-FUNCIONALES.md'), 'RF'),
    tecnica: estadosDeTabla(catalogoTecnico, /^(RF\d{2})$/, 3),
  },
  {
    articulo: 'los',
    nombre: 'requisitos no funcionales (RNF)',
    sustentacion: estadosDeSeccion(leerDoc(SUSTENTACION, 'documentos/04-REQUISITOS-NO-FUNCIONALES.md'), 'RNF'),
    tecnica: estadosDeTabla(catalogoTecnico, /^(RNF\d{2})$/, 3),
  },
  {
    articulo: 'las',
    nombre: 'reglas de negocio (RN)',
    // En la sustentación el identificador y el título comparten celda.
    sustentacion: estadosDeTabla(leerDoc(SUSTENTACION, 'documentos/02-REGLAS-DE-NEGOCIO.md'), /^(RN\d{2})\b/, 2),
    tecnica: estadosDeTabla(catalogoTecnico, /^(RN\d{2})$/, 3),
  },
  {
    articulo: 'las',
    nombre: 'historias de usuario (HU)',
    sustentacion: estadosDeFicha(leerDoc(SUSTENTACION, 'documentos/05-HISTORIAS-DE-USUARIO.md')),
    tecnica: estadosDeTabla(leerDoc(TECNICA, '04-HISTORIAS-DE-USUARIO.md'), /^(HU-\d{2})$/, 7),
  },
];

for (const { articulo, nombre, sustentacion: sus, tecnica: tec } of FAMILIAS) {
  const problemas = [];

  // Un extractor roto por un cambio de formato devolvería un mapa vacío y esta
  // comprobación pasaría sin comprobar nada, que es peor que no tenerla. Se
  // exige que ambos lados declaren algo.
  if (sus.size === 0 || tec.size === 0) {
    problemas.push(
      'no se pudo leer ningún estado en uno de los dos lados: ' +
      'probablemente cambió el formato y este guion dejó de mirar'
    );
  }

  for (const id of [...new Set([...sus.keys(), ...tec.keys()])].sort()) {
    const a = sus.get(id);
    const b = tec.get(id);

    if (!a) problemas.push(`${id}: la sustentación no declara estado`);
    else if (!b) problemas.push(`${id}: docs/ no declara estado`);
    else if (a !== b) problemas.push(`${id}: sustentación dice ${a} y docs/ dice ${b}`);
  }

  comprobar(
    `Coinciden los estados de ${articulo} ${nombre}`,
    problemas.length === 0,
    problemas.length === 0
      ? `${sus.size} comparados, todos iguales`
      : `${sus.size} en sustentación · ${tec.size} en docs/\n           ` +
        problemas.join('\n           ')
  );
}

// ── 7. Lo que el código hace y la documentación no dice ───────────────
/**
 * Las seis comprobaciones anteriores miran en una sola dirección: que lo que
 * los documentos **citan** exista, y que los dos juegos digan lo mismo entre
 * sí. Ninguna detecta lo contrario, que es la pregunta que de verdad importa
 * ante un evaluador: **¿la plataforma hace algo que no está documentado?**
 *
 * Las dos direcciones fallan de forma distinta. Citar algo inexistente se nota
 * al ir a buscarlo. Que el sistema haga algo que nadie escribió no se nota
 * nunca: no hay dónde tropezar. Es la que hay que automatizar.
 *
 * Se comprueban cuatro inventarios: rutas de la API, modelos, valores de
 * enumerado y pantallas.
 */

/** Prefijo real de cada módulo, leído de `app.js`. No se inventa ni se deduce. */
function prefijosDeModulos() {
  const app = fs.readFileSync(path.join(RAIZ, 'backend', 'src', 'app.js'), 'utf8');
  const porVariable = new Map();
  for (const m of app.matchAll(/app\.use\(\s*['"`](\/api\/[\w-]*)['"`]\s*,\s*(\w+)/g)) {
    porVariable.set(m[2], m[1].replace(/\/$/, ''));
  }
  return porVariable;
}

/** Rutas montadas de verdad: `MÉTODO /api/prefijo/ruta`. */
function rutasDelCodigo() {
  const dir = path.join(RAIZ, 'backend', 'src', 'modules');
  const prefijos = prefijosDeModulos();
  const rutas = new Set();

  for (const modulo of fs.readdirSync(dir)) {
    const archivo = path.join(dir, modulo, `${modulo}.routes.js`);
    if (!fs.existsSync(archivo)) continue;

    // La variable en app.js se llama `<modulo>Routes`; si algún día deja de
    // ser así, se cae al convencional en vez de fallar en silencio.
    const clave = [...prefijos.keys()].find((k) => k.toLowerCase().startsWith(modulo.toLowerCase()));
    const prefijo = prefijos.get(clave) || `/api/${modulo}`;

    const texto = fs.readFileSync(archivo, 'utf8');
    for (const m of texto.matchAll(/router\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]*)['"`]/g)) {
      const ruta = m[2] === '/' ? '' : m[2];
      rutas.add(`${m[1].toUpperCase()} ${prefijo}${ruta}`);
    }
  }
  return rutas;
}

/**
 * Rutas documentadas en el catálogo de la API.
 *
 * Cada sección declara su prefijo en el encabezado (`## 4. Procesos —
 * `/api/procesos``) y sus filas llevan la ruta relativa. Sin juntar las dos
 * cosas, `GET /` de clientes y `GET /` de procesos serían la misma entrada y
 * la comparación no valdría nada.
 */
function rutasDelCatalogo() {
  const texto = fs.readFileSync(path.join(TECNICA, '06-API-REST.md'), 'utf8');
  const rutas = new Set();
  let prefijo = null;

  for (const linea of texto.split('\n')) {
    const encabezado = linea.match(/^##\s.*?—\s+`(\/api\/[\w-]*)`/);
    if (encabezado) { prefijo = encabezado[1].replace(/\/$/, ''); continue; }

    const fila = linea.match(/^\|\s*(GET|POST|PUT|PATCH|DELETE)\s*\|\s*`([^`]+)`/);
    if (fila && prefijo) {
      const ruta = fila[2] === '/' ? '' : fila[2];
      rutas.add(`${fila[1]} ${prefijo}${ruta}`);
    }
  }
  return rutas;
}

const rutasCodigo = rutasDelCodigo();
const rutasDoc = rutasDelCatalogo();
const rutasSinDocumentar = [...rutasCodigo].filter((r) => !rutasDoc.has(r)).sort();

comprobar(
  'Toda ruta de la API está en el catálogo',
  rutasSinDocumentar.length === 0,
  rutasSinDocumentar.length === 0
    ? `${rutasCodigo.size} rutas, todas documentadas`
    : `${rutasCodigo.size} en el código\n           ` +
      rutasSinDocumentar.map((r) => `sin documentar: ${r}`).join('\n           ')
);

/**
 * Inventarios que se comprueban por mención en cualquier documento.
 *
 * **Es una comprobación débil y conviene decirlo:** que el nombre aparezca no
 * garantiza que esté bien descrito. Detecta la ausencia total, que es el fallo
 * grave —una tabla o una pantalla que nadie mencionó nunca—, no la descripción
 * equivocada. Eso último solo lo encuentra leerlo, y por eso los diagramas se
 * revisan a mano.
 */
const esquema = fs.readFileSync(path.join(RAIZ, 'backend', 'prisma', 'schema.prisma'), 'utf8');
const todaLaDoc = tecnica + sustentacion;

const modelos = [...esquema.matchAll(/^model (\w+)/gm)].map((m) => m[1]);
const modelosSinMencion = modelos.filter((m) => !todaLaDoc.includes(m));
comprobar(
  'Todo modelo del esquema se menciona en la documentación',
  modelosSinMencion.length === 0,
  modelosSinMencion.length === 0
    ? `${modelos.length} modelos`
    : `sin mencionar: ${modelosSinMencion.join(', ')}`
);

const valores = [];
for (const bloque of esquema.matchAll(/^enum (\w+) \{([\s\S]*?)^\}/gm)) {
  for (const linea of bloque[2].split('\n')) {
    const valor = linea.trim();
    if (valor && !valor.startsWith('//')) valores.push({ enumerado: bloque[1], valor });
  }
}
const valoresSinMencion = valores.filter((v) => !todaLaDoc.includes(v.valor));
comprobar(
  'Todo valor de enumerado se menciona en la documentación',
  valoresSinMencion.length === 0,
  valoresSinMencion.length === 0
    ? `${valores.length} valores en ${new Set(valores.map((v) => v.enumerado)).size} enumerados`
    : `sin mencionar: ${valoresSinMencion.map((v) => `${v.enumerado}.${v.valor}`).join(', ')}`
);

function pantallas(dir, acc = []) {
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    const ruta = path.join(dir, entrada.name);
    if (entrada.isDirectory()) pantallas(ruta, acc);
    else if (entrada.name.endsWith('.jsx')) acc.push(entrada.name);
  }
  return acc;
}

// Una pantalla que ningún documento nombra es funcionalidad que el sistema
// tiene y la sustentación no puede señalar. Siete lo estaban.
const vistas = pantallas(path.join(RAIZ, 'frontend', 'src', 'pages'));
const vistasSinMencion = vistas.filter((v) => !todaLaDoc.includes(v));
comprobar(
  'Toda pantalla del frontend se menciona en la documentación',
  vistasSinMencion.length === 0,
  vistasSinMencion.length === 0
    ? `${vistas.length} pantallas`
    : `sin mencionar: ${vistasSinMencion.join(', ')}`
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
