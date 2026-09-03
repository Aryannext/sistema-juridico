/**
 * Medición de concurrencia y tiempos de respuesta — RNF08.
 *
 *   npm run medir:concurrencia
 *
 * RNF08 pide 50 usuarios concurrentes, lecturas por debajo de 3 segundos y
 * escrituras por debajo de 5. Estuvo mucho tiempo en **«nunca medido»**, que
 * ante un evaluador es peor que incumplido: de un incumplimiento se sabe el
 * tamaño; de algo sin medir no se puede afirmar nada en ninguna dirección.
 *
 * ── Qué mide esto y qué no ──────────────────────────────────────────────
 *
 * Levanta el servidor real —el mismo `app`, con sus middlewares, su
 * autenticación y su base— en un puerto libre, y lo golpea por HTTP con 50
 * conexiones simultáneas. No simula: ejecuta.
 *
 * **Lo que NO mide, y hay que decirlo al presentar el número:** esto corre en
 * la máquina de desarrollo, contra PostgreSQL local y sin la latencia de la
 * red ni el Nginx del VPS. El resultado dice *cómo se comporta el sistema bajo
 * carga simultánea*, no *cuánto tardará el navegador de un abogado en Neiva*.
 * Un número medido con su entorno declarado vale; el mismo número presentado
 * como si fuera producción, no.
 *
 * Se apoya en la convención de `verificar:limpiar`: crea un consultorio con
 * prefijo `verif_` y todo lo suyo se borra con `npm run verificar:limpiar`.
 */
require('dotenv').config();

const http = require('http');
const app = require('../src/app');
const prisma = require('../src/config/prisma');

const CONCURRENTES = Number(process.env.MEDIR_CONCURRENTES || 50); // RNF08.1
// Por debajo del limitador general de la API (1000 cada 15 min): medir por
// encima de él mediría el limitador, no el sistema.
const PETICIONES = Number(process.env.MEDIR_PETICIONES || 300);
const EXPEDIENTES = Number(process.env.MEDIR_EXPEDIENTES || 300);

const LIMITE_LECTURA = 3000;  // RNF08.2
const LIMITE_ESCRITURA = 5000; // RNF08.3

const SUFIJO = Date.now().toString(36);
const EMAIL = `verif_carga_${SUFIJO}@demo.local`;
const CLAVE = 'Medicion2026*';

// ── Utilidades de medición ─────────────────────────────────────────────
const percentil = (valores, p) => {
  if (valores.length === 0) return 0;
  const ordenados = [...valores].sort((a, b) => a - b);
  return ordenados[Math.min(ordenados.length - 1, Math.floor((p / 100) * ordenados.length))];
};

function resumir(nombre, tiempos, errores, limite) {
  const p95 = percentil(tiempos, 95);
  const cumple = tiempos.length > 0 && p95 < limite && errores === 0;
  console.log(`  ${cumple ? '✓' : '✗'} ${nombre}`);
  console.log(`      ${tiempos.length} peticiones · ${errores} errores`);
  console.log(
    `      mediana ${percentil(tiempos, 50)} ms · p95 ${p95} ms · ` +
    `p99 ${percentil(tiempos, 99)} ms · máximo ${Math.max(...tiempos, 0)} ms`
  );
  console.log(`      límite del requisito: ${limite} ms\n`);
  return cumple;
}

/** Una petición HTTP real, cronometrada de extremo a extremo. */
function pedir(puerto, { metodo, ruta, token, cuerpo }) {
  return new Promise((resolve) => {
    const datos = cuerpo ? JSON.stringify(cuerpo) : null;
    const inicio = process.hrtime.bigint();

    const req = http.request(
      {
        host: '127.0.0.1', port: puerto, path: ruta, method: metodo,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(datos ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(datos) } : {}),
        },
      },
      (res) => {
        res.resume();
        res.on('end', () => {
          const ms = Number(process.hrtime.bigint() - inicio) / 1e6;
          resolve({ ms, estado: res.statusCode });
        });
      }
    );

    req.on('error', () => resolve({ ms: 0, estado: 0 }));
    if (datos) req.write(datos);
    req.end();
  });
}

/**
 * Lanza `total` peticiones manteniendo `simultaneas` en vuelo todo el tiempo.
 *
 * No se lanzan las 500 de golpe: eso mediría la capacidad de encolar de Node,
 * no la del sistema. Se sostiene una presión constante, que es lo que significa
 * «50 usuarios concurrentes».
 */
async function golpear(puerto, simultaneas, total, hacerPeticion) {
  const tiempos = [];
  let errores = 0;
  let lanzadas = 0;

  async function trabajador() {
    while (lanzadas < total) {
      lanzadas++;
      const { ms, estado } = await pedir(puerto, hacerPeticion());
      if (estado >= 200 && estado < 300) tiempos.push(Math.round(ms));
      else errores++;
    }
  }

  await Promise.all(Array.from({ length: simultaneas }, trabajador));
  return { tiempos, errores };
}

// ── Preparación ────────────────────────────────────────────────────────
async function preparar(puerto) {
  await pedir(puerto, { metodo: 'POST', ruta: '/api/auth/registro' }); // calienta el proceso

  const registro = await new Promise((resolve) => {
    const cuerpo = JSON.stringify({
      tipo: 'CONSULTORIO', nombre_tenant: `Medicion ${SUFIJO}`,
      email: EMAIL, password: CLAVE, nombre_admin: 'Medicion',
    });
    const req = http.request(
      { host: '127.0.0.1', port: puerto, path: '/api/auth/registro', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(cuerpo) } },
      (res) => { res.resume(); res.on('end', resolve); }
    );
    req.end(cuerpo);
  });
  void registro;

  const usuario = await prisma.usuario.findUnique({ where: { email: EMAIL } });
  if (!usuario) throw new Error('No se pudo crear el consultorio de medición.');

  const cliente = await prisma.cliente.create({
    data: {
      tenant_id: usuario.tenant_id, tipo: 'NATURAL', nombre: 'Cliente de carga',
      tipo_documento: 'CC', numero_documento: `MC${SUFIJO}`, telefono: '3000000000',
      email: `verif_cc_${SUFIJO}@demo.local`, id_usuario: usuario.id_usuario,
    },
  });

  // Volumen suficiente para que la búsqueda tenga algo que recorrer. Sin datos,
  // medir la búsqueda mide la latencia de la red y nada más.
  await prisma.proceso.createMany({
    data: Array.from({ length: EXPEDIENTES }, (_, i) => ({
      tenant_id: usuario.tenant_id,
      numero_radicado: `11001${String(i).padStart(6, '0')}-${SUFIJO}`,
      juzgado: `Juzgado ${i % 40} Civil del Circuito`,
      tipo_proceso: ['CIVIL', 'LABORAL', 'PENAL', 'FAMILIA'][i % 4],
      estado: 'ACTIVO', id_cliente: cliente.id_cliente, id_abogado_resp: usuario.id_usuario,
    })),
  });

  // Sesión real, por la puerta de siempre.
  const login = await new Promise((resolve) => {
    const cuerpo = JSON.stringify({ identificador: EMAIL, password: CLAVE });
    const req = http.request(
      { host: '127.0.0.1', port: puerto, path: '/api/auth/login', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(cuerpo) } },
      (res) => { let d = ''; res.on('data', (c) => { d += c; }); res.on('end', () => resolve(JSON.parse(d))); }
    );
    req.end(cuerpo);
  });

  if (!login.token) throw new Error(`No se pudo iniciar sesión: ${JSON.stringify(login)}`);
  return { token: login.token, idCliente: cliente.id_cliente, idUsuario: usuario.id_usuario };
}

// ── Ejecución ──────────────────────────────────────────────────────────
async function main() {
  const servidor = http.createServer(app);
  await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
  const puerto = servidor.address().port;

  console.log('\n  RNF08 · Concurrencia y tiempos de respuesta\n');
  console.log(`  ${CONCURRENTES} peticiones simultáneas · ${PETICIONES} por prueba`);
  console.log(`  ${EXPEDIENTES} expedientes de fondo\n`);

  const { token, idCliente, idUsuario } = await preparar(puerto);

  console.log('  Preparado. Midiendo...\n');

  // RNF08.2 — lectura. Se mide la búsqueda, que es la consulta más cara y la
  // que RNF05 somete a su propio límite.
  const terminos = ['11001', 'Civil', 'Juzgado 3', '000123', 'Circuito'];
  const lectura = await golpear(puerto, CONCURRENTES, PETICIONES, () => ({
    metodo: 'GET', token,
    ruta: `/api/procesos?search=${encodeURIComponent(terminos[Math.floor(Math.random() * terminos.length)])}&page=1&limit=20`,
  }));

  // RNF08.3 — escritura. Crear un expediente toca la validación del
  // responsable, el único de radicado y la bitácora: es una escritura completa.
  let n = 0;
  const escritura = await golpear(puerto, CONCURRENTES, Math.round(PETICIONES / 2), () => ({
    metodo: 'POST', ruta: '/api/procesos', token,
    cuerpo: {
      numero_radicado: `W-${SUFIJO}-${n++}`, tipo_proceso: 'CIVIL',
      id_cliente: idCliente, id_abogado_resp: idUsuario,
    },
  }));

  console.log('  Resultados\n');
  const okLectura = resumir('RNF08.2 · Lecturas bajo carga', lectura.tiempos, lectura.errores, LIMITE_LECTURA);
  const okEscritura = resumir('RNF08.3 · Escrituras bajo carga', escritura.tiempos, escritura.errores, LIMITE_ESCRITURA);
  const okConcurrencia = lectura.errores === 0 && lectura.tiempos.length > 0;

  console.log(`  ${okConcurrencia ? '✓' : '✗'} RNF08.1 · ${CONCURRENTES} peticiones simultáneas sin errores\n`);

  console.log('  Entorno de esta medición');
  console.log(`      ${process.platform} · Node ${process.version}`);
  console.log('      PostgreSQL local, sin red ni Nginx entre medias.');
  console.log('      El número describe el comportamiento bajo carga simultánea,');
  console.log('      no el tiempo que verá un usuario en producción.\n');

  servidor.close();
  await prisma.$disconnect();

  console.log(`  Consultorio de medición: ${EMAIL}`);
  console.log('  Se elimina con  npm run verificar:limpiar\n');

  process.exit(okLectura && okEscritura && okConcurrencia ? 0 : 1);
}

main().catch(async (error) => {
  console.error('\n  No se pudo completar la medición:', error.message, '\n');
  await prisma.$disconnect();
  process.exit(1);
});
