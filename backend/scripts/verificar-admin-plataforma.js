/**
 * Verificación del administrador de plataforma — solo desarrollo.
 *
 *   npm run verificar:plataforma
 *
 * Crea un consultorio DESECHABLE con datos en todas las tablas, comprueba el
 * ciclo completo (separación, suspensión, reactivación y borrado) y lo elimina.
 * No toca ningún consultorio real.
 *
 * Se niega a ejecutarse contra cualquier base que no sea local.
 */
const prisma = require('../src/config/prisma');
const plataforma = require('../src/modules/plataforma/plataforma.controller');
const auth = require('../src/modules/auth/auth.controller');
const { authMiddleware } = require('../src/middlewares/auth.middleware');
const { plataformaMiddleware } = require('../src/middlewares/plataforma.middleware');
const { hashPassword } = require('../src/utils/bcrypt');

const url = process.env.DATABASE_URL || '';
if (!/localhost|127\.0\.0\.1/.test(url)) {
  console.error('ABORTADO: DATABASE_URL no apunta a una base local.');
  process.exit(1);
}

const marca = `plat_${Date.now()}`;
const resultados = [];
let idAdmin = null;
let idTenant = null;

const comprobar = (id, titulo, ok, detalle) => resultados.push({ id, titulo, ok, detalle });

function fakeRes() {
  const res = { statusCode: 200, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

const CLAVE_ADMIN = 'Plataforma2026!Prueba';
const CLAVE_USUARIO = 'Usuario2026!Prueba';

/** Consultorio desechable con al menos una fila en cada tabla dependiente. */
async function crearConsultorioCompleto() {
  const tenant = await prisma.tenant.create({
    data: { nombre: `${marca} Desechable`, tipo: 'CONSULTORIO', email_admin: `${marca}@local.test` },
  });
  idTenant = tenant.id_tenant;

  const usuario = await prisma.usuario.create({
    data: {
      tenant_id: tenant.id_tenant, nombre: 'Abogado desechable',
      email: `${marca}@local.test`, password_hash: await hashPassword(CLAVE_USUARIO),
      rol: 'ADMINISTRADOR',
    },
  });

  await prisma.permisoRol.create({
    data: { id_usuario: usuario.id_usuario, modulo: 'PROCESOS', puede_leer: true },
  });

  const cliente = await prisma.cliente.create({
    data: {
      tenant_id: tenant.id_tenant, tipo: 'NATURAL', nombre: 'Cliente desechable',
      tipo_documento: 'CC', numero_documento: `${marca}`.slice(-30), telefono: '3000000000',
      email: `${marca}c@local.test`, id_usuario: usuario.id_usuario,
    },
  });

  const proceso = await prisma.proceso.create({
    data: {
      tenant_id: tenant.id_tenant, numero_radicado: `${marca}-RAD`.slice(-50),
      tipo_proceso: 'ORDINARIO', estado: 'ACTIVO',
      id_cliente: cliente.id_cliente, id_abogado_resp: usuario.id_usuario,
    },
  });

  await prisma.procesoAbogado.create({
    data: { id_proceso: proceso.id_proceso, id_usuario: usuario.id_usuario, rol_en_proceso: 'ABOGADO' },
  });
  await prisma.parteProcesal.create({
    data: { tenant_id: tenant.id_tenant, id_proceso: proceso.id_proceso, nombre: 'Parte X', tipo: 'DEMANDADO' },
  });

  const actuacion = await prisma.actuacion.create({
    data: {
      tenant_id: tenant.id_tenant, id_proceso: proceso.id_proceso,
      fecha_actuacion: new Date('2026-05-05'), tipo: 'AUTO',
      anotacion: 'Auto admisorio', registrado_por: usuario.id_usuario,
    },
  });

  const termino = await prisma.terminoJudicial.create({
    data: {
      tenant_id: tenant.id_tenant, id_proceso: proceso.id_proceso,
      id_actuacion: actuacion.id_actuacion, nombre: 'Término desechable',
      fecha_vencimiento: new Date(Date.now() + 864e5), estado: 'PENDIENTE',
      created_by: usuario.id_usuario,
    },
  });
  await prisma.recordatorioTermino.create({
    data: { id_termino: termino.id_termino, fecha_hora_envio: new Date(), canal: 'EMAIL' },
  });

  const audiencia = await prisma.audiencia.create({
    data: {
      tenant_id: tenant.id_tenant, id_proceso: proceso.id_proceso, nombre: 'Audiencia',
      tipo: 'CONCILIACION', fecha_hora: new Date(), lugar: 'Juzgado 1',
      estado: 'PROGRAMADA', created_by: usuario.id_usuario,
    },
  });
  await prisma.recordatorioAudiencia.create({
    data: { id_audiencia: audiencia.id_audiencia, minutos_antes: 60, canal: 'EMAIL' },
  });

  const documento = await prisma.documento.create({
    data: {
      tenant_id: tenant.id_tenant, id_proceso: proceso.id_proceso, nombre: 'Demanda.pdf',
      categoria: 'DEMANDA', visibilidad: 'PRIVADO', estado: 'ACTIVO',
      subido_por: usuario.id_usuario,
    },
  });
  await prisma.versionDocumento.create({
    data: {
      id_documento: documento.id_documento, numero_version: 1, url_archivo: 'https://x/y.pdf',
      nombre_archivo: 'Demanda.pdf', tamano_bytes: 1024, formato: 'pdf',
      subido_por: usuario.id_usuario,
    },
  });

  await prisma.notificacion.create({
    data: {
      tenant_id: tenant.id_tenant, id_usuario: usuario.id_usuario,
      titulo: 'Aviso', mensaje: 'Mensaje', prioridad: 'ALTA',
    },
  });
  await prisma.bitacoraAuditoria.create({
    data: {
      tenant_id: tenant.id_tenant, id_usuario: usuario.id_usuario,
      accion: 'CREAR', modulo: 'PROCESOS', detalle: 'Creó algo', ip_adress: '1.1.1.1',
    },
  });
  await prisma.historialProceso.create({
    data: {
      tenant_id: tenant.id_tenant, id_proceso: proceso.id_proceso,
      campo_modificado: 'estado', accion: 'CAMBIO', realizado_por: usuario.id_usuario,
    },
  });

  return { tenant, usuario };
}

async function crearAdminPlataforma() {
  const admin = await prisma.adminPlataforma.create({
    data: {
      nombre: 'Admin de prueba', email: `${marca}admin@local.test`,
      password_hash: await hashPassword(CLAVE_ADMIN),
    },
  });
  idAdmin = admin.id_admin;
  return admin;
}

/** Ejecuta el login de plataforma y devuelve la respuesta simulada. */
async function loginPlataforma(email, password) {
  const res = fakeRes();
  await plataforma.login({ body: { email, password }, ip: '203.0.113.9' }, res);
  return res;
}

/** Pasa un token por un middleware y dice si dejó continuar. */
async function pasaPor(middleware, token) {
  let paso = false;
  const res = fakeRes();
  const req = { headers: { authorization: `Bearer ${token}` } };
  await middleware(req, res, () => { paso = true; });
  return { paso, estado: res.statusCode, cuerpo: res.body, req };
}

const reqAdmin = (admin, extra = {}) => ({
  admin: { id_admin: admin.id_admin, nombre: admin.nombre, email: admin.email },
  params: {}, body: {}, query: {}, ip: '203.0.113.9',
  ...extra,
});

async function ejecutar() {
  const { tenant, usuario } = await crearConsultorioCompleto();
  const admin = await crearAdminPlataforma();

  // ── 1. Inicio de sesión ──────────────────────────────────────────
  const malas = await loginPlataforma(admin.email, 'incorrecta');
  comprobar('P-01', 'Rechaza credenciales incorrectas', malas.statusCode === 401,
    `HTTP ${malas.statusCode}: ${malas.body && malas.body.error}`);

  const buenas = await loginPlataforma(admin.email, CLAVE_ADMIN);
  const tokenPlataforma = buenas.body && buenas.body.token;
  comprobar('P-02', 'Entrega token con credenciales correctas', !!tokenPlataforma,
    `HTTP ${buenas.statusCode}`);

  // ── 2. Separación entre los dos mundos ───────────────────────────
  const enConsultorio = await pasaPor(authMiddleware, tokenPlataforma);
  comprobar('P-03', 'El token de plataforma NO abre un consultorio',
    !enConsultorio.paso && enConsultorio.estado === 403,
    `HTTP ${enConsultorio.estado}: ${enConsultorio.cuerpo && enConsultorio.cuerpo.error}`);

  const resLoginUsuario = fakeRes();
  await auth.login({ body: { email: usuario.email, password: CLAVE_USUARIO }, ip: '1.1.1.1' }, resLoginUsuario);
  const tokenUsuario = resLoginUsuario.body && resLoginUsuario.body.token;

  const enPlataforma = await pasaPor(plataformaMiddleware, tokenUsuario);
  comprobar('P-04', 'El token de consultorio NO administra la plataforma',
    !enPlataforma.paso && enPlataforma.estado === 401,
    `HTTP ${enPlataforma.estado}`);

  // ── 3. El listado no expone contenido jurídico ───────────────────
  const resLista = fakeRes();
  await plataforma.listarConsultorios(reqAdmin(admin, { query: {} }), resLista);
  const fila = (resLista.body || []).find((c) => c.id_tenant === tenant.id_tenant);
  const camposExpuestos = fila ? Object.keys(fila) : [];
  const filtraContenido = !camposExpuestos.some((k) =>
    ['procesos', 'clientes', 'documentos', 'usuarios', 'actuaciones'].includes(k));

  comprobar('P-05', 'El listado solo expone datos administrativos', !!fila && filtraContenido,
    fila ? `Campos: ${camposExpuestos.join(', ')}` : 'No apareció el consultorio');
  comprobar('P-06', 'Incluye los recuentos para poder facturar',
    !!(fila && fila._count && typeof fila._count.usuarios === 'number'),
    fila && fila._count ? JSON.stringify(fila._count) : 'sin recuentos');

  // ── 4. Suspensión ────────────────────────────────────────────────
  const sinJustificar = fakeRes();
  await plataforma.cambiarEstadoConsultorio(
    reqAdmin(admin, { params: { id: tenant.id_tenant }, body: { activo: false } }), sinJustificar);
  comprobar('P-07', 'Suspender exige justificación', sinJustificar.statusCode === 400,
    `HTTP ${sinJustificar.statusCode}: ${sinJustificar.body && sinJustificar.body.error}`);

  const suspender = fakeRes();
  await plataforma.cambiarEstadoConsultorio(
    reqAdmin(admin, {
      params: { id: tenant.id_tenant },
      body: { activo: false, justificacion: 'Impago de la mensualidad' },
    }), suspender);
  comprobar('P-08', 'Suspende el consultorio', suspender.statusCode === 200,
    `HTTP ${suspender.statusCode}`);

  const trasSuspender = fakeRes();
  await auth.login({ body: { email: usuario.email, password: CLAVE_USUARIO }, ip: '1.1.1.1' }, trasSuspender);
  comprobar('P-09', 'Sus usuarios dejan de poder entrar',
    trasSuspender.statusCode === 403 && !!(trasSuspender.body && trasSuspender.body.consultorioSuspendido),
    `HTTP ${trasSuspender.statusCode}: ${trasSuspender.body && trasSuspender.body.error}`);

  // ── 5. Cerrojos del borrado ──────────────────────────────────────
  const nombreMal = fakeRes();
  await plataforma.eliminarConsultorio(
    reqAdmin(admin, {
      params: { id: tenant.id_tenant },
      body: { confirmacion: 'Nombre equivocado', justificacion: 'El cliente solicitó la baja del servicio' },
    }), nombreMal);
  comprobar('P-10', 'Exige escribir el nombre exacto', nombreMal.statusCode === 400,
    `HTTP ${nombreMal.statusCode}: ${nombreMal.body && nombreMal.body.error}`);

  const justCorta = fakeRes();
  await plataforma.eliminarConsultorio(
    reqAdmin(admin, {
      params: { id: tenant.id_tenant },
      body: { confirmacion: tenant.nombre, justificacion: 'baja' },
    }), justCorta);
  comprobar('P-11', 'Exige una justificación con contenido', justCorta.statusCode === 400,
    `HTTP ${justCorta.statusCode}: ${justCorta.body && justCorta.body.error}`);

  // Reactivar para comprobar que NO se puede borrar un consultorio activo.
  await plataforma.cambiarEstadoConsultorio(
    reqAdmin(admin, { params: { id: tenant.id_tenant }, body: { activo: true } }), fakeRes());

  const trasReactivar = fakeRes();
  await auth.login({ body: { email: usuario.email, password: CLAVE_USUARIO }, ip: '1.1.1.1' }, trasReactivar);
  comprobar('P-12', 'Al reactivar, sus usuarios vuelven a entrar',
    trasReactivar.statusCode === 200 && !!(trasReactivar.body && trasReactivar.body.token),
    `HTTP ${trasReactivar.statusCode}`);

  const activoNoSeBorra = fakeRes();
  await plataforma.eliminarConsultorio(
    reqAdmin(admin, {
      params: { id: tenant.id_tenant },
      body: { confirmacion: tenant.nombre, justificacion: 'El cliente solicitó la baja del servicio' },
    }), activoNoSeBorra);
  comprobar('P-13', 'No se puede eliminar un consultorio activo', activoNoSeBorra.statusCode === 400,
    `HTTP ${activoNoSeBorra.statusCode}: ${activoNoSeBorra.body && activoNoSeBorra.body.error}`);

  // ── 6. Borrado real ──────────────────────────────────────────────
  await plataforma.cambiarEstadoConsultorio(
    reqAdmin(admin, {
      params: { id: tenant.id_tenant },
      body: { activo: false, justificacion: 'Baja definitiva solicitada' },
    }), fakeRes());

  const borrar = fakeRes();
  await plataforma.eliminarConsultorio(
    reqAdmin(admin, {
      params: { id: tenant.id_tenant },
      body: { confirmacion: tenant.nombre, justificacion: 'El cliente solicitó la baja del servicio' },
    }), borrar);
  comprobar('P-14', 'Elimina el consultorio con todos los cerrojos superados',
    borrar.statusCode === 200,
    borrar.statusCode === 200
      ? JSON.stringify(borrar.body.resumen)
      : `HTTP ${borrar.statusCode}: ${borrar.body && borrar.body.error}`);

  // ── 7. Que no quede nada suelto ──────────────────────────────────
  const restos = {
    tenant: await prisma.tenant.count({ where: { id_tenant: tenant.id_tenant } }),
    usuarios: await prisma.usuario.count({ where: { tenant_id: tenant.id_tenant } }),
    clientes: await prisma.cliente.count({ where: { tenant_id: tenant.id_tenant } }),
    procesos: await prisma.proceso.count({ where: { tenant_id: tenant.id_tenant } }),
    actuaciones: await prisma.actuacion.count({ where: { tenant_id: tenant.id_tenant } }),
    audiencias: await prisma.audiencia.count({ where: { tenant_id: tenant.id_tenant } }),
    terminos: await prisma.terminoJudicial.count({ where: { tenant_id: tenant.id_tenant } }),
    documentos: await prisma.documento.count({ where: { tenant_id: tenant.id_tenant } }),
    notificaciones: await prisma.notificacion.count({ where: { tenant_id: tenant.id_tenant } }),
    bitacora: await prisma.bitacoraAuditoria.count({ where: { tenant_id: tenant.id_tenant } }),
    historial: await prisma.historialProceso.count({ where: { tenant_id: tenant.id_tenant } }),
  };
  const sobrantes = Object.entries(restos).filter(([, n]) => n > 0);
  comprobar('P-15', 'No queda ninguna fila huérfana en once tablas', sobrantes.length === 0,
    sobrantes.length === 0 ? 'Todas a cero.' : `QUEDAN: ${JSON.stringify(Object.fromEntries(sobrantes))}`);
  if (sobrantes.length === 0) idTenant = null;

  // ── 8. La constancia del borrado sobrevive ───────────────────────
  const registros = await prisma.bitacoraPlataforma.findMany({
    where: { id_admin: admin.id_admin, accion: 'ELIMINAR_CONSULTORIO' },
  });
  comprobar('P-16', 'La bitácora de plataforma sobrevive al consultorio borrado',
    registros.length === 1 && registros[0].tenant_nombre === tenant.nombre,
    registros.length === 1
      ? `"${registros[0].tenant_nombre}" · ${registros[0].justificacion}`
      : `${registros.length} registros`);
}

async function limpiar() {
  if (idTenant) {
    console.error('\n  AVISO: el consultorio de prueba no se borró del todo. Id:', idTenant, '\n');
  }
  if (idAdmin) {
    await prisma.bitacoraPlataforma.deleteMany({ where: { id_admin: idAdmin } });
    await prisma.adminPlataforma.delete({ where: { id_admin: idAdmin } });
  }
}

(async () => {
  let fallo = false;
  try {
    await ejecutar();
  } catch (error) {
    console.error('\nError inesperado:\n', error);
    fallo = true;
  } finally {
    await limpiar();
    await prisma.$disconnect();
  }

  console.log('\n  Administrador de plataforma\n');
  for (const r of resultados) {
    console.log(`  ${r.ok ? ' OK ' : 'FALLA'}  ${r.id.padEnd(5)} ${r.titulo}`);
    console.log(`          ${r.detalle}\n`);
  }
  const ok = resultados.filter((r) => r.ok).length;
  console.log(`  ${ok} de ${resultados.length} comprobaciones correctas.\n`);
  process.exit(fallo || ok !== resultados.length ? 1 : 0);
})();
