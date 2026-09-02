/**
 * Verificador de arreglos — solo desarrollo.
 *
 * Complemento de scripts/reproducir-defectos.js. Aquel demostraba que los
 * defectos existían; este comprueba que ya no. La diferencia importante es que
 * aquí NO se replica la lógica: se invocan los controladores de verdad con un
 * `req` y un `res` simulados, de modo que si alguien deshace el arreglo en el
 * controlador, esto falla.
 *
 *   node -r dotenv/config scripts/verificar-arreglos.js
 *
 * Se niega a ejecutarse contra cualquier base que no sea local.
 */
const prisma = require('../src/config/prisma');
const procesos = require('../src/modules/procesos/procesos.controller');
const clientes = require('../src/modules/clientes/clientes.controller');
const auth = require('../src/modules/auth/auth.controller');
const { authMiddleware } = require('../src/middlewares/auth.middleware');
const { signToken } = require('../src/utils/jwt');
const { hashPassword } = require('../src/utils/bcrypt');

const url = process.env.DATABASE_URL || '';
if (!/localhost|127\.0\.0\.1/.test(url)) {
  console.error('ABORTADO: DATABASE_URL no apunta a una base local.');
  process.exit(1);
}

const marca = `arreglo_${Date.now()}`;
const creados = { tenants: [], usuarios: [], clientes: [], procesos: [], actuaciones: [] };
const resultados = [];

function comprobar(id, titulo, ok, detalle) {
  resultados.push({ id, titulo, ok, detalle });
}

/** `res` simulado: guarda el código y el cuerpo en lugar de escribir en el socket. */
function fakeRes() {
  const res = { statusCode: 200, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

function fakeReq(tenant_id, usuario, { params = {}, body = {}, query = {} } = {}) {
  return {
    tenant_id,
    user: { id_usuario: usuario.id_usuario, rol: usuario.rol, nombre: usuario.nombre },
    params, body, query,
    ip: '203.0.113.9',
  };
}

async function crearConsultorio(sufijo) {
  const tenant = await prisma.tenant.create({
    data: { nombre: `${marca}_${sufijo}`, tipo: 'CONSULTORIO', email_admin: `${marca}_${sufijo}@local.test` },
  });
  creados.tenants.push(tenant.id_tenant);
  const usuario = await prisma.usuario.create({
    data: {
      tenant_id: tenant.id_tenant, nombre: `Admin ${sufijo}`,
      email: `${marca}_${sufijo}@local.test`, password_hash: 'x', rol: 'ADMINISTRADOR',
    },
  });
  creados.usuarios.push(usuario.id_usuario);
  return { tenant, usuario };
}

async function crearClienteDirecto(tenant, usuario, documento) {
  const cliente = await prisma.cliente.create({
    data: {
      tenant_id: tenant.id_tenant, tipo: 'NATURAL', nombre: 'Cliente de prueba',
      tipo_documento: 'CC', numero_documento: documento, telefono: '3000000000',
      email: `${documento}@local.test`, id_usuario: usuario.id_usuario,
    },
  });
  creados.clientes.push(cliente.id_cliente);
  return cliente;
}

// ── A-01 ── Borrado definitivo de un expediente CON actuaciones ─────────
async function arreglo01() {
  const { tenant, usuario } = await crearConsultorio('a01');
  const cliente = await crearClienteDirecto(tenant, usuario, `${marca}_a01`.slice(-30));

  const reqCrear = fakeReq(tenant.id_tenant, usuario, {
    body: {
      numero_radicado: `${marca}_a01`.slice(-50), tipo_proceso: 'ORDINARIO',
      estado: 'ACTIVO', id_cliente: cliente.id_cliente, id_abogado_resp: usuario.id_usuario,
    },
  });
  const resCrear = fakeRes();
  await procesos.createProceso(reqCrear, resCrear);
  const proceso = resCrear.body.proceso;
  creados.procesos.push(proceso.id_proceso);

  const actuacion = await prisma.actuacion.create({
    data: {
      tenant_id: tenant.id_tenant, id_proceso: proceso.id_proceso,
      fecha_actuacion: new Date('2026-01-15'), tipo: 'AUTO',
      anotacion: 'Auto admisorio', registrado_por: usuario.id_usuario,
    },
  });
  creados.actuaciones.push(actuacion.id_actuacion);

  const res = fakeRes();
  await procesos.deleteProcesoDefinitivo(
    fakeReq(tenant.id_tenant, usuario, {
      params: { id: proceso.id_proceso }, body: { justificacion: 'Prueba de borrado' },
    }),
    res
  );

  const sigue = await prisma.proceso.findUnique({ where: { id_proceso: proceso.id_proceso } });
  const quedanActuaciones = await prisma.actuacion.count({ where: { id_proceso: proceso.id_proceso } });
  const ok = res.statusCode === 200 && !sigue && quedanActuaciones === 0;

  if (ok) {
    creados.procesos = creados.procesos.filter((p) => p !== proceso.id_proceso);
    creados.actuaciones = creados.actuaciones.filter((a) => a !== actuacion.id_actuacion);
  }
  comprobar('A-01', 'Borrar expediente con actuaciones', ok,
    ok ? 'Expediente y actuaciones eliminados; respuesta 200.'
       : `HTTP ${res.statusCode}: ${res.body && res.body.error}`);
}

// ── A-04 ── Dos consultorios con el mismo radicado ──────────────────────
async function arreglo04() {
  const radicado = `${marca}_rad`.slice(-50);
  const a = await crearConsultorio('a04a');
  const clienteA = await crearClienteDirecto(a.tenant, a.usuario, `${marca}_a04a`.slice(-30));
  const b = await crearConsultorio('a04b');
  const clienteB = await crearClienteDirecto(b.tenant, b.usuario, `${marca}_a04b`.slice(-30));

  const cuerpo = (cli, usr) => ({
    numero_radicado: radicado, tipo_proceso: 'ORDINARIO', estado: 'ACTIVO',
    id_cliente: cli.id_cliente, id_abogado_resp: usr.id_usuario,
  });

  const res1 = fakeRes();
  await procesos.createProceso(fakeReq(a.tenant.id_tenant, a.usuario, { body: cuerpo(clienteA, a.usuario) }), res1);
  if (res1.body && res1.body.proceso) creados.procesos.push(res1.body.proceso.id_proceso);

  const res2 = fakeRes();
  await procesos.createProceso(fakeReq(b.tenant.id_tenant, b.usuario, { body: cuerpo(clienteB, b.usuario) }), res2);
  if (res2.body && res2.body.proceso) creados.procesos.push(res2.body.proceso.id_proceso);

  const ok = res1.statusCode === 201 && res2.statusCode === 201;
  comprobar('A-04', 'Contraparte registra el mismo radicado', ok,
    ok ? 'Ambos consultorios registraron el expediente.'
       : `Primero ${res1.statusCode}, segundo ${res2.statusCode}: ${res2.body && res2.body.error}`);

  // Y dentro del MISMO consultorio debe seguir estando prohibido duplicarlo.
  const res3 = fakeRes();
  await procesos.createProceso(fakeReq(a.tenant.id_tenant, a.usuario, { body: cuerpo(clienteA, a.usuario) }), res3);
  comprobar('A-04b', 'Duplicado dentro del mismo consultorio sigue bloqueado', res3.statusCode === 400,
    `HTTP ${res3.statusCode}: ${res3.body && res3.body.error}`);
}

// ── A-05 ── La misma persona como cliente de dos consultorios ───────────
async function arreglo05() {
  const documento = `${marca}_doc`.slice(-30);
  const a = await crearConsultorio('a05a');
  const b = await crearConsultorio('a05b');
  const cuerpo = {
    tipo: 'NATURAL', nombre: 'Persona compartida', tipo_documento: 'CC',
    numero_documento: documento, telefono: '3001112222', email: 'persona@local.test',
  };

  const res1 = fakeRes();
  await clientes.createCliente(fakeReq(a.tenant.id_tenant, a.usuario, { body: cuerpo }), res1);
  if (res1.body && res1.body.cliente) creados.clientes.push(res1.body.cliente.id_cliente);

  const res2 = fakeRes();
  await clientes.createCliente(fakeReq(b.tenant.id_tenant, b.usuario, { body: cuerpo }), res2);
  if (res2.body && res2.body.cliente) creados.clientes.push(res2.body.cliente.id_cliente);

  const ok = res1.statusCode === 201 && res2.statusCode === 201;
  comprobar('A-05', 'Misma persona en dos consultorios', ok,
    ok ? 'Ambos consultorios la registraron como cliente.'
       : `Primero ${res1.statusCode}, segundo ${res2.statusCode}: ${res2.body && res2.body.error}`);

  const res3 = fakeRes();
  await clientes.createCliente(fakeReq(a.tenant.id_tenant, a.usuario, { body: cuerpo }), res3);
  comprobar('A-05b', 'Duplicado dentro del mismo consultorio sigue bloqueado', res3.statusCode === 400,
    `HTTP ${res3.statusCode}: ${res3.body && res3.body.error}`);
}

// ── A-06 ── Intento de mudar un cliente a otro consultorio ──────────────
async function arreglo06() {
  const a = await crearConsultorio('a06a');
  const b = await crearConsultorio('a06b');
  const cliente = await crearClienteDirecto(a.tenant, a.usuario, `${marca}_a06`.slice(-30));

  const res = fakeRes();
  await clientes.updateCliente(
    fakeReq(a.tenant.id_tenant, a.usuario, {
      params: { id: cliente.id_cliente },
      body: { nombre: 'Nombre nuevo', tenant_id: b.tenant.id_tenant, id_usuario: b.usuario.id_usuario },
    }),
    res
  );

  const despues = await prisma.cliente.findUnique({ where: { id_cliente: cliente.id_cliente } });
  const sigueEnSuSitio = despues.tenant_id === a.tenant.id_tenant
    && despues.id_usuario === a.usuario.id_usuario;
  const seAplicoLoLegitimo = despues.nombre === 'Nombre nuevo';

  comprobar('A-06', 'tenant_id del cuerpo se descarta', sigueEnSuSitio && seAplicoLoLegitimo,
    sigueEnSuSitio
      ? `El cliente sigue en su consultorio y el nombre sí se actualizó (HTTP ${res.statusCode}).`
      : 'EL CLIENTE SE MUDÓ DE CONSULTORIO.');

  // Un cliente de otro consultorio debe dar 404, no 500.
  const resAjeno = fakeRes();
  await clientes.updateCliente(
    fakeReq(b.tenant.id_tenant, b.usuario, {
      params: { id: cliente.id_cliente }, body: { nombre: 'Intruso' },
    }),
    resAjeno
  );
  comprobar('A-06b', 'Editar cliente ajeno devuelve 404', resAjeno.statusCode === 404,
    `HTTP ${resAjeno.statusCode}: ${resAjeno.body && resAjeno.body.error}`);
}

// ── A-02 ── Modificar un expediente ajeno devuelve 404, no 500 ──────────
async function arreglo02() {
  const a = await crearConsultorio('a02a');
  const b = await crearConsultorio('a02b');
  const cliente = await crearClienteDirecto(a.tenant, a.usuario, `${marca}_a02`.slice(-30));

  const resCrear = fakeRes();
  await procesos.createProceso(fakeReq(a.tenant.id_tenant, a.usuario, {
    body: {
      numero_radicado: `${marca}_a02`.slice(-50), tipo_proceso: 'ORDINARIO',
      estado: 'ACTIVO', id_cliente: cliente.id_cliente, id_abogado_resp: a.usuario.id_usuario,
    },
  }), resCrear);
  const proceso = resCrear.body.proceso;
  creados.procesos.push(proceso.id_proceso);

  const res = fakeRes();
  await procesos.updateProceso(
    fakeReq(b.tenant.id_tenant, b.usuario, {
      params: { id: proceso.id_proceso }, body: { juzgado: 'Juzgado intruso' },
    }),
    res
  );

  const sinTocar = await prisma.proceso.findUnique({ where: { id_proceso: proceso.id_proceso } });
  comprobar('A-02', 'Modificar expediente ajeno devuelve 404', res.statusCode === 404 && !sinTocar.juzgado,
    `HTTP ${res.statusCode}: ${res.body && res.body.error}`);
}

// ── A-09 ── Suspensión de un consultorio completo ──────────────────────
// Comprueba las dos caras: que el suspendido queda fuera y que el activo
// sigue entrando. Un arreglo que bloqueara a todos también "pasaría" si solo
// se mirase la primera.
async function arreglo09() {
  const clave = 'Clave1234*';
  const hash = await hashPassword(clave);

  const crear = async (sufijo, tenantActivo) => {
    const tenant = await prisma.tenant.create({
      data: {
        nombre: `${marca}_${sufijo}`,
        tipo: 'CONSULTORIO',
        email_admin: `${marca}_${sufijo}@local.test`,
        activo: tenantActivo,
      },
    });
    creados.tenants.push(tenant.id_tenant);

    const usuario = await prisma.usuario.create({
      data: {
        tenant_id: tenant.id_tenant,
        nombre: `Abogado ${sufijo}`,
        email: `${marca}_${sufijo}@local.test`,
        password_hash: hash,
        rol: 'ABOGADO',
        activo: true,
      },
    });
    creados.usuarios.push(usuario.id_usuario);
    return { tenant, usuario };
  };

  const pasaElMiddleware = async (usuario, tenant) => {
    const token = signToken({
      id_usuario: usuario.id_usuario,
      tenant_id: tenant.id_tenant,
      rol: usuario.rol,
    });
    let paso = false;
    const res = fakeRes();
    await authMiddleware(
      { headers: { authorization: `Bearer ${token}` } },
      res,
      () => { paso = true; }
    );
    return { paso, estado: res.statusCode };
  };

  const intentarLogin = async (usuario) => {
    const res = fakeRes();
    await auth.login({ body: { email: usuario.email, password: clave }, ip: '203.0.113.9' }, res);
    return res;
  };

  // Consultorio suspendido: fuera.
  const susp = await crear('a09susp', false);
  const mwSusp = await pasaElMiddleware(susp.usuario, susp.tenant);
  comprobar('A-09', 'Consultorio suspendido no puede usar la API', !mwSusp.paso && mwSusp.estado === 403,
    `El middleware respondió ${mwSusp.estado} y no dejó pasar.`);

  const loginSusp = await intentarLogin(susp.usuario);
  comprobar('A-09b', 'Consultorio suspendido no puede iniciar sesión',
    loginSusp.statusCode === 403 && !(loginSusp.body && loginSusp.body.token),
    `HTTP ${loginSusp.statusCode}: ${loginSusp.body && loginSusp.body.error}`);

  // Consultorio activo: sigue trabajando con normalidad.
  const act = await crear('a09act', true);
  const mwAct = await pasaElMiddleware(act.usuario, act.tenant);
  comprobar('A-09c', 'Consultorio activo sigue usando la API', mwAct.paso,
    mwAct.paso ? 'El middleware lo dejó pasar.' : `Bloqueado con ${mwAct.estado}: NO debería.`);

  const loginAct = await intentarLogin(act.usuario);
  comprobar('A-09d', 'Consultorio activo sigue iniciando sesión',
    loginAct.statusCode === 200 && !!(loginAct.body && loginAct.body.token),
    loginAct.statusCode === 200 ? 'Recibió su token.' : `HTTP ${loginAct.statusCode}.`);
}

async function limpiar() {
  await prisma.historialProceso.deleteMany({ where: { id_proceso: { in: creados.procesos } } });
  await prisma.actuacion.deleteMany({ where: { id_actuacion: { in: creados.actuaciones } } });
  await prisma.proceso.deleteMany({ where: { id_proceso: { in: creados.procesos } } });
  await prisma.cliente.deleteMany({ where: { id_cliente: { in: creados.clientes } } });
  await prisma.bitacoraAuditoria.deleteMany({ where: { tenant_id: { in: creados.tenants } } });
  await prisma.usuario.deleteMany({ where: { id_usuario: { in: creados.usuarios } } });
  await prisma.tenant.deleteMany({ where: { id_tenant: { in: creados.tenants } } });
}

(async () => {
  let fallo = false;
  try {
    await arreglo01();
    await arreglo02();
    await arreglo04();
    await arreglo05();
    await arreglo06();
    await arreglo09();
  } catch (error) {
    console.error('\nError inesperado durante la verificación:\n', error);
    fallo = true;
  } finally {
    await limpiar();
    await prisma.$disconnect();
  }

  console.log('\n  Verificación de arreglos\n');
  for (const r of resultados) {
    console.log(`  ${r.ok ? ' OK ' : 'FALLA'}  ${r.id.padEnd(6)} ${r.titulo}`);
    console.log(`          ${r.detalle}\n`);
  }
  const ok = resultados.filter((r) => r.ok).length;
  console.log(`  ${ok} de ${resultados.length} comprobaciones correctas.\n`);
  process.exit(fallo || ok !== resultados.length ? 1 : 0);
})();
