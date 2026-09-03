/**
 * Toda la verificación del proyecto, en una sola orden.
 *
 *   npm run verificar:todo
 *
 * ── Por qué existe ──────────────────────────────────────────────────────
 *
 * El proyecto tenía un flujo de integración continua en GitHub Actions que
 * **no ejecutaba nada**: la cuenta está bloqueada por facturación, así que los
 * trabajos ni siquiera arrancaban. Los checks salían en rojo y ese rojo no
 * significaba «las pruebas fallan» sino «no se sabe», que es peor, porque se
 * parece a lo primero.
 *
 * Un proyecto sin presupuesto para minutos de servidor no tiene por qué
 * quedarse sin verificación: **la máquina de quien programa ya la ejecuta
 * gratis**. Lo que faltaba no era capacidad de cómputo, era una sola orden que
 * lo corriera todo y un sitio donde fuera obligatoria (ver `.githooks/pre-push`).
 *
 * Esto no sustituye a un servidor de integración —no comprueba que el proyecto
 * compile en una máquina limpia, ni que el `package-lock.json` sea coherente—,
 * y conviene decirlo. Cubre lo que de verdad se rompe a diario.
 */
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const RAIZ = path.resolve(__dirname, '..', '..');
const BACKEND = path.join(RAIZ, 'backend');
const FRONTEND = path.join(RAIZ, 'frontend');

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

/**
 * Cada paso declara si es **exigible**. Los que necesitan una base de datos en
 * marcha no lo son: quien programa sin la base levantada no debería quedarse
 * sin poder verificar lo demás. Se avisa de que se saltaron, eso sí, para que
 * nadie confunda «no se comprobó» con «salió bien» —que es exactamente el
 * error que este archivo viene a corregir—.
 */
const PASOS = [
  { nombre: 'Backend · lint', dir: BACKEND, orden: [npm, ['run', 'lint']], exigible: true },
  { nombre: 'Backend · pruebas', dir: BACKEND, orden: [npm, ['test']], exigible: true },
  { nombre: 'Coherencia de la documentación', dir: BACKEND, orden: [npm, ['run', 'verificar:docs']], exigible: true },
  { nombre: 'Referencias al código', dir: BACKEND, orden: [npm, ['run', 'verificar:referencias']], exigible: true },
  { nombre: 'Frontend · compilación', dir: FRONTEND, orden: [npm, ['run', 'build']], exigible: true },
  {
    nombre: 'Índices de búsqueda',
    dir: BACKEND,
    orden: [npm, ['run', 'verificar:indices']],
    exigible: false,
    requiere: 'una base de datos accesible',
  },
];

const resultados = [];

for (const paso of PASOS) {
  process.stdout.write(`  ${paso.nombre.padEnd(36)}`);

  const salida = spawnSync(paso.orden[0], paso.orden[1], {
    cwd: paso.dir,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });

  const ok = salida.status === 0;
  resultados.push({ ...paso, ok, salida });

  if (ok) console.log('OK');
  else console.log(paso.exigible ? 'FALLA' : `omitido (necesita ${paso.requiere})`);
}

// ── Informe ────────────────────────────────────────────────────────────
const fallos = resultados.filter((r) => !r.ok && r.exigible);
const omitidos = resultados.filter((r) => !r.ok && !r.exigible);

console.log('');

for (const f of fallos) {
  console.log(`\n  ── ${f.nombre} ${'─'.repeat(Math.max(0, 50 - f.nombre.length))}`);
  const texto = `${f.salida.stdout || ''}${f.salida.stderr || ''}`.trim();
  // Las últimas líneas son las que dicen qué falló; el resto es ruido de npm.
  console.log(texto.split('\n').slice(-25).map((l) => `  ${l}`).join('\n'));
}

if (omitidos.length > 0) {
  console.log(`\n  Sin comprobar: ${omitidos.map((o) => o.nombre).join(', ')}`);
  console.log('  No es un fallo, pero tampoco es un visto bueno.');
}

const exigibles = resultados.filter((r) => r.exigible).length;
console.log(`\n  ${exigibles - fallos.length} de ${exigibles} comprobaciones exigibles, correctas.\n`);

process.exit(fallos.length === 0 ? 0 : 1);
