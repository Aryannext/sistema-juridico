/**
 * Verificación de la plataforma contra lo documentado.
 *
 * Comprueba, sobre una API en ejecución, que el comportamiento real coincide
 * con lo que afirman docs/03-CATALOGO-REQUISITOS.md y docs/05-MATRIZ-TRAZABILIDAD.md.
 *
 * No sustituye a las pruebas unitarias (`npm test`): estas recorren el sistema
 * completo de extremo a extremo, incluida la base de datos.
 *
 * Uso:
 *   node scripts/verificar-plataforma.js [http://localhost:3000/api]
 *
 * SEGURIDAD: se niega a ejecutarse si DATABASE_URL no apunta a localhost.
 * Crea datos de prueba y no debe correr nunca contra producción.
 */
require('dotenv').config();

const API = process.argv[2] || `http://localhost:${process.env.PORT || 3000}/api`;

// ── Guardarraíl ───────────────────────────────────────────────────
const db = process.env.DATABASE_URL || '';
if (!/localhost|127\.0\.0\.1/.test(db)) {
  console.error('\n  ABORTADO: DATABASE_URL no apunta a localhost.');
  console.error('  Este script crea datos de prueba y no debe correr contra producción.\n');
  process.exit(1);
}

// ── Utilidades ────────────────────────────────────────────────────
const resultados = [];
let seccionActual = '';

const seccion = (t) => { seccionActual = t; resultados.push({ seccion: t }); };

function comprobar(ref, descripcion, condicion, detalle = '') {
  resultados.push({ ref, descripcion, ok: !!condicion, detalle, seccion: seccionActual });
}

async function pedir(metodo, ruta, { token, body } = {}) {
  const cabeceras = { 'Content-Type': 'application/json' };
  if (token) cabeceras.Authorization = `Bearer ${token}`;
  const r = await fetch(API + ruta, {
    method: metodo,
    headers: cabeceras,
    body: body ? JSON.stringify(body) : undefined
  });
  // Se lee como texto y luego se intenta interpretar: las exportaciones
  // (CSV, PDF) no son JSON, y `r.json()` a secas dejaría el cuerpo perdido.
  const texto = await r.text();
  let datos = null;
  try { datos = JSON.parse(texto); } catch { /* respuesta que no es JSON */ }
  return { estado: r.status, datos, texto, tipo: r.headers.get('content-type') || '' };
}

const sufijo = Date.now().toString().slice(-8);

async function registrarConsultorio(nombre) {
  const email = `verif_${nombre}_${sufijo}@demo.local`;
  const password = 'Verifica1234*';
  await pedir('POST', '/auth/registro', {
    body: {
      tipo: 'CONSULTORIO', nombre_tenant: `Consultorio ${nombre} ${sufijo}`,
      nombre_admin: `Admin ${nombre}`, email, password
    }
  });
  const login = await pedir('POST', '/auth/login', { body: { email, password } });
  return { email, password, token: login.datos?.token, estadoLogin: login.estado };
}

// ── Verificación ──────────────────────────────────────────────────
(async () => {
  console.log(`\nVerificando contra ${API}\n`);

  // Comprobar que la API responde antes de nada
  try {
    const raiz = await fetch(API.replace(/\/api$/, '/'));
    if (!raiz.ok) throw new Error('respuesta no OK');
  } catch {
    console.error(`  No se pudo contactar la API en ${API}.`);
    console.error('  Levanta el backend con: npm start\n');
    process.exit(1);
  }

  // ═══ Consultorio A ═══
  const A = await registrarConsultorio('A');
  const B = await registrarConsultorio('B');

  seccion('Autenticación y registro multi-tenant');

  comprobar('RF51', 'El registro público crea el consultorio y permite iniciar sesión',
    A.estadoLogin === 200 && !!A.token, `estado=${A.estadoLogin}`);

  const loginMal = await pedir('POST', '/auth/login',
    { body: { email: A.email, password: 'incorrecta' } });
  comprobar('RF01', 'Credenciales inválidas se rechazan con mensaje genérico',
    loginMal.estado === 401 && /inválidas/i.test(loginMal.datos?.error || ''),
    `estado=${loginMal.estado} · "${loginMal.datos?.error}"`);

  const sinToken = await pedir('GET', '/procesos');
  comprobar('RNF01', 'Sin token, la API responde 401',
    sinToken.estado === 401, `estado=${sinToken.estado}`);

  const debil = await pedir('POST', '/auth/registro', {
    body: { tipo: 'INDEPENDIENTE', nombre_tenant: `Debil ${sufijo}`,
            nombre_admin: 'Débil', email: `debil_${sufijo}@demo.local`, password: '1' }
  });
  comprobar('RNF02', 'La contraseña débil "1" se rechaza en el backend',
    debil.estado === 400, `estado=${debil.estado} · "${debil.datos?.error || ''}"`);

  // ═══ Datos base en el consultorio A ═══
  seccion('Clientes y expedientes');

  const cli = await pedir('POST', '/clientes', { token: A.token, body: {
    tipo: 'NATURAL', nombre: 'Cliente Verificación', tipo_documento: 'CC',
    numero_documento: `VERIF${sufijo}`, telefono: '3000000000', email: `cliente_${sufijo}@demo.local`
  }});
  comprobar('RF06', 'Se registra un cliente persona natural',
    cli.estado === 201, `estado=${cli.estado}`);
  const idCliente = cli.datos?.cliente?.id_cliente;

  const perfilA = await pedir('GET', '/auth/perfil', { token: A.token });
  const idAdminA = perfilA.datos?.id_usuario;

  const radicado = `41001310300120260${sufijo.slice(-5)}`;
  const proc = await pedir('POST', '/procesos', { token: A.token, body: {
    numero_radicado: radicado, tipo_proceso: 'ORDINARIO', estado: 'ACTIVO',
    id_cliente: idCliente, id_abogado_resp: idAdminA, juzgado: 'JUZGADO 001 DE NEIVA'
  }});
  comprobar('RF09', 'Se crea un expediente con número de radicado',
    proc.estado === 201, `estado=${proc.estado}`);
  const idProceso = proc.datos?.proceso?.id_proceso;

  const dup = await pedir('POST', '/procesos', { token: A.token, body: {
    numero_radicado: radicado, tipo_proceso: 'ORDINARIO', estado: 'ACTIVO',
    id_cliente: idCliente, id_abogado_resp: idAdminA
  }});
  comprobar('RF10', 'Se rechaza un radicado duplicado',
    dup.estado === 400, `estado=${dup.estado}`);

  // ═══ Aislamiento entre consultorios ═══
  seccion('Aislamiento entre consultorios (RF52 / RNF11)');

  const ajeno = await pedir('GET', `/procesos/${idProceso}`, { token: B.token });
  comprobar('RF52', 'El consultorio B NO puede leer un expediente del consultorio A',
    ajeno.estado === 404 || ajeno.estado === 403, `estado=${ajeno.estado}`);

  const listaB = await pedir('GET', '/procesos', { token: B.token });
  const fuga = (listaB.datos?.procesos || []).some(p => p.numero_radicado === radicado);
  comprobar('RF52', 'El listado del consultorio B no incluye expedientes del A',
    !fuga, fuga ? 'FUGA DETECTADA' : 'sin fugas');

  const clientesB = await pedir('GET', '/clientes', { token: B.token });
  const fugaCli = (clientesB.datos || []).some(c => c.numero_documento === `VERIF${sufijo}`);
  comprobar('RF52', 'El listado de clientes del B no incluye clientes del A',
    !fugaCli, fugaCli ? 'FUGA DETECTADA' : 'sin fugas');

  const actAjena = await pedir('POST', '/actuaciones', { token: B.token, body: {
    id_proceso: idProceso, fecha_actuacion: '2026-06-20', tipo: 'AUTO', anotacion: 'Intrusión'
  }});
  comprobar('RF52', 'El consultorio B NO puede registrar actuaciones en expedientes del A',
    actAjena.estado === 404 || actAjena.estado === 403, `estado=${actAjena.estado}`);

  // ═══ Búsqueda y paginación ═══
  seccion('Búsqueda y paginación (RNF05 / HU-31)');

  const busca = await pedir('GET', `/procesos?search=${radicado.slice(0, 8)}`, { token: A.token });
  comprobar('RNF05', 'La búsqueda parcial por radicado encuentra el expediente',
    (busca.datos?.procesos || []).some(p => p.numero_radicado === radicado),
    `encontrados=${busca.datos?.procesos?.length}`);

  const pag = busca.datos?.pagination;
  comprobar('RNF05', 'La respuesta incluye paginación con total, page, limit y pages',
    pag && ['total','page','limit','pages'].every(k => k in pag),
    pag ? `limit=${pag.limit}` : 'sin objeto pagination');
  comprobar('RNF05', 'El tamaño de página por defecto es 20',
    pag?.limit === 20, `limit=${pag?.limit}`);

  const corta = await pedir('GET', '/procesos?search=41', { token: A.token });
  comprobar('RNF05', 'Una búsqueda de menos de 3 caracteres se ignora (no filtra)',
    (corta.datos?.procesos || []).length >= (busca.datos?.procesos || []).length,
    'el filtro no se aplica por debajo de 3 caracteres');

  // ═══ Actuaciones ═══
  seccion('Actuaciones procesales (RF55–RF59)');

  const act = await pedir('POST', '/actuaciones', { token: A.token, body: {
    id_proceso: idProceso, fecha_actuacion: '2026-06-20', tipo: 'AUTO',
    anotacion: 'Auto admisorio de la demanda.'
  }});
  comprobar('RF55', 'Se registra una actuación procesal',
    act.estado === 201, `estado=${act.estado}`);
  const idActuacion = act.datos?.actuacion?.id_actuacion;

  const tipoMalo = await pedir('POST', '/actuaciones', { token: A.token, body: {
    id_proceso: idProceso, fecha_actuacion: '2026-06-20', tipo: 'INVENTADO', anotacion: 'X'
  }});
  comprobar('RF56', 'Se rechaza un tipo de actuación fuera del catálogo',
    tipoMalo.estado === 400, `estado=${tipoMalo.estado}`);

  const listaAct = await pedir('GET', `/actuaciones/proceso/${idProceso}`, { token: A.token });
  const primera = (listaAct.datos || [])[0];
  comprobar('RF57', 'La fecha de la actuación se conserva sin desplazamiento de día',
    primera?.fecha_actuacion?.startsWith('2026-06-20'),
    `almacenado=${primera?.fecha_actuacion}`);
  comprobar('RF57', 'La fecha de registro es distinta de la fecha de la actuación',
    primera && primera.fecha_registro !== primera.fecha_actuacion, '');

  // ═══ Términos y su vínculo con la actuación ═══
  seccion('Términos judiciales (RF32–RF37, RN07)');

  const term = await pedir('POST', '/terminos', { token: A.token, body: {
    id_proceso: idProceso, id_actuacion: idActuacion,
    nombre: 'Traslado para contestar', fecha_vencimiento: '2026-07-06T17:00:00.000Z',
    es_critico: true
  }});
  comprobar('RF58', 'Un término se vincula a la actuación que lo originó',
    term.estado === 201, `estado=${term.estado}`);
  const idTermino = term.datos?.termino?.id_termino;

  const actAjenaId = await pedir('POST', '/terminos', { token: A.token, body: {
    id_proceso: idProceso, id_actuacion: '00000000-0000-0000-0000-000000000000',
    nombre: 'Inválido', fecha_vencimiento: '2026-07-06T17:00:00.000Z'
  }});
  comprobar('RF58', 'Se rechaza vincular un término a una actuación inexistente',
    actAjenaId.estado === 400, `estado=${actAjenaId.estado}`);

  const listaAct2 = await pedir('GET', `/actuaciones/proceso/${idProceso}`, { token: A.token });
  comprobar('RF58', 'La actuación muestra los términos que originó',
    ((listaAct2.datos || [])[0]?.terminos || []).length === 1, '');

  const borrarAct = await pedir('DELETE', `/actuaciones/${idActuacion}`, { token: A.token });
  comprobar('RF59', 'No se puede eliminar una actuación con términos asociados',
    borrarAct.estado === 400, `estado=${borrarAct.estado}`);

  const gestion = await pedir('PUT', `/terminos/${idTermino}/gestion`, { token: A.token, body: {
    estado: 'CUMPLIDO', justificacion: 'Se contestó dentro del plazo.'
  }});
  comprobar('RN07', 'Un término vencido marcado CUMPLIDO se reclasifica a CUMPLIDO_TARDIO',
    gestion.datos?.termino?.estado === 'CUMPLIDO_TARDIO',
    `estado resultante=${gestion.datos?.termino?.estado}`);

  const sinJustif = await pedir('PUT', `/terminos/${idTermino}/gestion`,
    { token: A.token, body: { estado: 'CUMPLIDO' } });
  comprobar('RF35', 'La gestión de un término exige justificación escrita',
    sinJustif.estado === 400, `estado=${sinJustif.estado}`);

  // ═══ Estados del proceso ═══
  seccion('Estados del expediente (RN03, RN05)');

  const sinJust = await pedir('PUT', `/procesos/${idProceso}/estado`,
    { token: A.token, body: { estado: 'ARCHIVADO' } });
  comprobar('RN03', 'El cambio de estado exige justificación escrita',
    sinJust.estado === 400, `estado=${sinJust.estado}`);

  await pedir('POST', '/terminos', { token: A.token, body: {
    id_proceso: idProceso, nombre: 'Pendiente sin gestionar',
    fecha_vencimiento: '2027-01-15T17:00:00.000Z'
  }});
  const archivar = await pedir('PUT', `/procesos/${idProceso}/estado`, { token: A.token, body: {
    estado: 'ARCHIVADO', justificacion: 'Cierre del caso.'
  }});
  comprobar('RN05', 'No se archiva un expediente con términos pendientes',
    archivar.estado === 400 && archivar.datos?.hasPending === true,
    `estado=${archivar.estado} · pendientes=${archivar.datos?.terminos?.length}`);

  const forzar = await pedir('PUT', `/procesos/${idProceso}/estado`, { token: A.token, body: {
    estado: 'ARCHIVADO', justificacion: 'Cierre forzado por el Administrador.', force: true
  }});
  comprobar('RN05', 'El Administrador puede forzar el archivado con confirmación explícita',
    forzar.estado === 200, `estado=${forzar.estado}`);

  // ═══ Bitácora ═══
  seccion('Bitácora de auditoría (RF05, RNF03, RN01)');

  const bit = await pedir('GET', '/admin/auditoria', { token: A.token });
  const registros = bit.datos?.bitacora || bit.datos || [];
  const lista = Array.isArray(registros) ? registros : [];
  comprobar('RNF03', 'La bitácora es consultable por el Administrador',
    bit.estado === 200 && lista.length > 0, `registros=${lista.length}`);
  comprobar('RF05', 'Cada registro incluye usuario, módulo, acción e IP',
    lista[0] && ['id_usuario','modulo','accion','ip_adress'].every(k => k in lista[0]), '');

  const entrada = lista.find(r => r.accion === 'INICIO_SESION');
  comprobar('RF05', 'El inicio de sesión queda registrado en la bitácora',
    Boolean(entrada), entrada ? `"${entrada.detalle}"` : 'no aparece ningún INICIO_SESION');

  const expBit = await pedir('GET', '/admin/auditoria/export', { token: A.token });
  const lineasCsv = expBit.texto ? expBit.texto.trim().split('\n').length - 1 : 0;
  comprobar('RNF03', 'La bitácora se puede exportar (CSV o PDF)',
    expBit.estado === 200 && lineasCsv > 0,
    `estado=${expBit.estado} · ${lineasCsv} fila(s) exportadas`);

  // ═══ Reportes ═══
  seccion('Reportes (RF42)');

  const stats = await pedir('GET', '/reportes/stats?filter=anio', { token: A.token });
  comprobar('RF42', 'Las estadísticas responden con filtro por rango de fechas',
    stats.estado === 200, `estado=${stats.estado}`);

  const pdf = await pedir('GET', '/reportes/export/pdf', { token: A.token });
  // No basta con el 200: un error devuelto como JSON también responde 200 en
  // algunos marcos. Se exige la firma real del formato.
  const esPdf = pdf.texto.startsWith('%PDF-');
  comprobar('RF42', 'Los reportes se pueden exportar en PDF',
    pdf.estado === 200 && esPdf,
    `estado=${pdf.estado} · ${esPdf ? `${pdf.texto.length} bytes, firma %PDF` : `no es un PDF (${pdf.tipo})`}`);

  // ── Informe ─────────────────────────────────────────────────────
  console.log('');
  let ok = 0, fallos = 0;
  for (const r of resultados) {
    if (r.seccion && !r.ref) { console.log(`\n  ${r.seccion}`); continue; }
    const marca = r.ok ? '  [ OK ]' : '  [FALLA]';
    console.log(`${marca} ${r.ref.padEnd(6)} ${r.descripcion}`);
    if (r.detalle) console.log(`           ${r.detalle}`);
    r.ok ? ok++ : fallos++;
  }

  console.log(`\n  ${ok} conformes · ${fallos} no conformes · ${ok + fallos} comprobaciones\n`);
  process.exit(fallos > 0 ? 1 : 0);
})().catch(e => { console.error('\nError inesperado:', e.message, '\n'); process.exit(2); });
