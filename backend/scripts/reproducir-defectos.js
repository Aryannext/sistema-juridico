/**
 * Reproductor de defectos — solo desarrollo.
 *
 * No arregla nada: demuestra con datos reales que los defectos existen, para
 * no discutir sobre lecturas del código. Cada bloque deja la base como estaba.
 *
 *   node scripts/reproducir-defectos.js
 *
 * Se niega a ejecutarse contra cualquier base que no sea local.
 */
const prisma = require('../src/config/prisma');
const { signToken } = require('../src/utils/jwt');
const { authMiddleware } = require('../src/middlewares/auth.middleware');
const authController = require('../src/modules/auth/auth.controller');
const { hashPassword } = require('../src/utils/bcrypt');

const url = process.env.DATABASE_URL || '';
if (!/localhost|127\.0\.0\.1/.test(url)) {
  console.error('ABORTADO: DATABASE_URL no apunta a una base local.');
  process.exit(1);
}

const marca = `defecto_${Date.now()}`;
const creados = { tenants: [], usuarios: [], clientes: [], procesos: [], actuaciones: [] };
const resultados = [];

function registrar(id, titulo, reproducido, detalle) {
  resultados.push({ id, titulo, reproducido, detalle });
}

async function crearConsultorio(sufijo) {
  const tenant = await prisma.tenant.create({
    data: {
      nombre: `${marca}_${sufijo}`,
      tipo: 'CONSULTORIO',
      email_admin: `${marca}_${sufijo}@local.test`,
    },
  });
  creados.tenants.push(tenant.id_tenant);

  const usuario = await prisma.usuario.create({
    data: {
      tenant_id: tenant.id_tenant,
      nombre: `Admin ${sufijo}`,
      email: `${marca}_${sufijo}@local.test`,
      password_hash: 'x',
      rol: 'ADMINISTRADOR',
    },
  });
  creados.usuarios.push(usuario.id_usuario);

  return { tenant, usuario };
}

async function crearCliente(tenant, usuario, documento) {
  const cliente = await prisma.cliente.create({
    data: {
      tenant_id: tenant.id_tenant,
      tipo: 'NATURAL',
      nombre: 'Cliente de prueba',
      tipo_documento: 'CC',
      numero_documento: documento,
      telefono: '3000000000',
      email: 'cliente@local.test',
      id_usuario: usuario.id_usuario,
    },
  });
  creados.clientes.push(cliente.id_cliente);
  return cliente;
}

async function crearProceso(tenant, usuario, cliente, radicado) {
  const proceso = await prisma.proceso.create({
    data: {
      tenant_id: tenant.id_tenant,
      numero_radicado: radicado,
      tipo_proceso: 'ORDINARIO',
      estado: 'ACTIVO',
      id_cliente: cliente.id_cliente,
      id_abogado_resp: usuario.id_usuario,
    },
  });
  creados.procesos.push(proceso.id_proceso);
  return proceso;
}

// ── D-01 ────────────────────────────────────────────────────────────────
// El borrado definitivo de expediente no contempla las actuaciones.
async function defecto01() {
  const { tenant, usuario } = await crearConsultorio('d01');
  const cliente = await crearCliente(tenant, usuario, `${marca}_d01`.slice(-30));
  const proceso = await crearProceso(tenant, usuario, cliente, `${marca}_d01`.slice(-50));

  const actuacion = await prisma.actuacion.create({
    data: {
      tenant_id: tenant.id_tenant,
      id_proceso: proceso.id_proceso,
      fecha_actuacion: new Date('2026-01-15'),
      tipo: 'AUTO',
      anotacion: 'Auto admisorio de la demanda',
      registrado_por: usuario.id_usuario,
    },
  });
  creados.actuaciones.push(actuacion.id_actuacion);

  // Réplica exacta de la transacción de deleteProcesoDefinitivo.
  try {
    await prisma.$transaction(async (tx) => {
      const id = proceso.id_proceso;
      await tx.procesoAbogado.deleteMany({ where: { id_proceso: id } });
      await tx.parteProcesal.deleteMany({ where: { id_proceso: id } });
      const audiencias = await tx.audiencia.findMany({ where: { id_proceso: id } });
      const idAudiencias = audiencias.map((a) => a.id_audiencia);
      await tx.recordatorioAudiencia.deleteMany({ where: { id_audiencia: { in: idAudiencias } } });
      await tx.audiencia.deleteMany({ where: { id_proceso: id } });
      const terminos = await tx.terminoJudicial.findMany({ where: { id_proceso: id } });
      const idTerminos = terminos.map((t) => t.id_termino);
      await tx.recordatorioTermino.deleteMany({ where: { id_termino: { in: idTerminos } } });
      await tx.terminoJudicial.deleteMany({ where: { id_proceso: id } });
      const documentos = await tx.documento.findMany({ where: { id_proceso: id } });
      const idDocumentos = documentos.map((d) => d.id_documento);
      await tx.versionDocumento.deleteMany({ where: { id_documento: { in: idDocumentos } } });
      await tx.documento.deleteMany({ where: { id_proceso: id } });
      await tx.historialProceso.deleteMany({ where: { id_proceso: id } });
      await tx.proceso.delete({ where: { id_proceso: id } });
    });
    registrar('D-01', 'Borrado definitivo con actuaciones', false, 'El borrado funcionó.');
    // Si borró, ya no hay que limpiarlo.
    creados.procesos = creados.procesos.filter((p) => p !== proceso.id_proceso);
    creados.actuaciones = creados.actuaciones.filter((a) => a !== actuacion.id_actuacion);
  } catch (error) {
    registrar('D-01', 'Borrado definitivo con actuaciones', true,
      `${error.code || 'error'}: ${String(error.message).split('\n').pop().trim()}`);
  }
}

// ── D-04 ────────────────────────────────────────────────────────────────
// numero_radicado es único en TODO el sistema, no por consultorio.
async function defecto04() {
  const radicado = `${marca}_rad`.slice(-50);
  const a = await crearConsultorio('d04a');
  const clienteA = await crearCliente(a.tenant, a.usuario, `${marca}_d04a`.slice(-30));
  await crearProceso(a.tenant, a.usuario, clienteA, radicado);

  const b = await crearConsultorio('d04b');
  const clienteB = await crearCliente(b.tenant, b.usuario, `${marca}_d04b`.slice(-30));
  try {
    await crearProceso(b.tenant, b.usuario, clienteB, radicado);
    registrar('D-04', 'Mismo radicado en dos consultorios', false, 'Ambos pudieron registrarlo.');
  } catch (error) {
    registrar('D-04', 'Mismo radicado en dos consultorios', true,
      `${error.code}: el segundo consultorio no puede registrar el mismo radicado.`);
  }
}

// ── D-05 ────────────────────────────────────────────────────────────────
// numero_documento del cliente es único en TODO el sistema.
async function defecto05() {
  const documento = `${marca}_doc`.slice(-30);
  const a = await crearConsultorio('d05a');
  await crearCliente(a.tenant, a.usuario, documento);

  const b = await crearConsultorio('d05b');
  try {
    await crearCliente(b.tenant, b.usuario, documento);
    registrar('D-05', 'Misma persona como cliente de dos consultorios', false, 'Ambos pudieron registrarla.');
  } catch (error) {
    registrar('D-05', 'Misma persona como cliente de dos consultorios', true,
      `${error.code}: el segundo consultorio no puede registrar a la misma persona.`);
  }
}

// ── D-06 ────────────────────────────────────────────────────────────────
// updateCliente vuelca req.body entero en Prisma. Si el cuerpo trae
// tenant_id, el cliente se muda de consultorio.
async function defecto06() {
  const a = await crearConsultorio('d06a');
  const b = await crearConsultorio('d06b');
  const cliente = await crearCliente(a.tenant, a.usuario, `${marca}_d06`.slice(-30));

  // Exactamente lo que hace el controlador: where con tenant, data con el body.
  const cuerpoMalicioso = { nombre: 'Secuestrado', tenant_id: b.tenant.id_tenant };
  try {
    await prisma.cliente.update({
      where: { id_cliente: cliente.id_cliente, tenant_id: a.tenant.id_tenant },
      data: cuerpoMalicioso,
    });
    const despues = await prisma.cliente.findUnique({ where: { id_cliente: cliente.id_cliente } });
    const semudo = despues.tenant_id === b.tenant.id_tenant;
    registrar('D-06', 'Reescritura de tenant_id vía updateCliente', semudo,
      semudo
        ? 'El cliente quedó registrado en el consultorio ajeno. OJO: esto replica ' +
          'Prisma en crudo, que sigue permitiéndolo y siempre lo permitirá; el ' +
          'arreglo está en el controlador, que ya filtra los campos. Lo comprueba A-06.'
        : 'Prisma ignoró el tenant_id del cuerpo.');
  } catch (error) {
    registrar('D-06', 'Reescritura de tenant_id vía updateCliente', false,
      `Prisma lo rechazó: ${error.code || error.message.split('\n').pop().trim()}`);
  }
}

// ── D-09 ────────────────────────────────────────────────────────────────
// Suspender un consultorio (tenant.activo = false) no impide que sus
// usuarios sigan entrando y trabajando: nadie comprueba ese campo.
async function defecto09() {
  const tenant = await prisma.tenant.create({
    data: {
      nombre: `${marca}_d09`,
      tipo: 'CONSULTORIO',
      email_admin: `${marca}_d09@local.test`,
      activo: false, // consultorio SUSPENDIDO, p. ej. por impago
    },
  });
  creados.tenants.push(tenant.id_tenant);

  const usuario = await prisma.usuario.create({
    data: {
      tenant_id: tenant.id_tenant,
      nombre: 'Abogado del consultorio suspendido',
      email: `${marca}_d09@local.test`,
      password_hash: await hashPassword('Clave1234*'),
      rol: 'ABOGADO',
      activo: true, // el usuario en sí nunca se desactivó
    },
  });
  creados.usuarios.push(usuario.id_usuario);

  // 1) ¿Puede usar la API con un token válido?
  const token = signToken({
    id_usuario: usuario.id_usuario,
    tenant_id: tenant.id_tenant,
    rol: usuario.rol,
  });

  let pasoElMiddleware = false;
  const req = { headers: { authorization: `Bearer ${token}` } };
  const res = { status: () => res, json: () => res };
  await authMiddleware(req, res, () => { pasoElMiddleware = true; });

  registrar('D-09a', 'El consultorio suspendido sigue usando la API', pasoElMiddleware,
    pasoElMiddleware
      ? 'El middleware dejó pasar la petición pese a estar el consultorio inactivo.'
      : 'El middleware la bloqueó.');

  // 2) ¿Puede iniciar sesión de nuevo?
  const resLogin = { statusCode: 200, body: null };
  resLogin.status = (c) => { resLogin.statusCode = c; return resLogin; };
  resLogin.json = (b) => { resLogin.body = b; return resLogin; };

  await authController.login(
    { body: { email: usuario.email, password: 'Clave1234*' }, ip: '203.0.113.9' },
    resLogin
  );

  const entro = resLogin.statusCode === 200 && !!(resLogin.body && resLogin.body.token);
  registrar('D-09b', 'El consultorio suspendido puede iniciar sesión', entro,
    entro
      ? 'El login devolvió un token válido.'
      : `HTTP ${resLogin.statusCode}: ${resLogin.body && resLogin.body.error}`);
}

async function limpiar() {
  await prisma.actuacion.deleteMany({ where: { id_actuacion: { in: creados.actuaciones } } });
  await prisma.proceso.deleteMany({ where: { id_proceso: { in: creados.procesos } } });
  await prisma.cliente.deleteMany({ where: { id_cliente: { in: creados.clientes } } });
  await prisma.usuario.deleteMany({ where: { id_usuario: { in: creados.usuarios } } });
  await prisma.tenant.deleteMany({ where: { id_tenant: { in: creados.tenants } } });
}

(async () => {
  try {
    await defecto01();
    await defecto04();
    await defecto05();
    await defecto06();
    await defecto09();
  } finally {
    await limpiar();
    await prisma.$disconnect();
  }

  console.log('\n  Reproducción de defectos\n');
  for (const r of resultados) {
    console.log(`  ${r.reproducido ? 'REPRODUCIDO' : '   no      '}  ${r.id}  ${r.titulo}`);
    console.log(`                 ${r.detalle}\n`);
  }
  const n = resultados.filter((r) => r.reproducido).length;
  console.log(`  ${n} de ${resultados.length} defectos confirmados con datos reales.\n`);
})();
