/**
 * Elimina los consultorios creados por scripts/verificar-plataforma.js.
 *
 * Solo borra tenants cuyo correo de administrador empieza por `verif_` o
 * `debil_`, que es el patrón que usa el script de verificación.
 * Los datos sembrados por seed-dev.js NO se tocan.
 *
 * SEGURIDAD: se niega a ejecutarse fuera de localhost.
 */
require('dotenv').config();
const prisma = require('../src/config/prisma');

const db = process.env.DATABASE_URL || '';
if (!/localhost|127\.0\.0\.1/.test(db)) {
  console.error('\n  ABORTADO: DATABASE_URL no apunta a localhost.\n');
  process.exit(1);
}

const ES_DE_PRUEBA = (email) => /^(verif_|debil_)/.test(email || '');

(async () => {
  const tenants = await prisma.tenant.findMany({ select: { id_tenant: true, nombre: true, email_admin: true } });
  const objetivo = tenants.filter(t => ES_DE_PRUEBA(t.email_admin));

  if (objetivo.length === 0) {
    console.log('No hay consultorios de verificación que eliminar.');
    return;
  }

  console.log(`Se eliminarán ${objetivo.length} consultorio(s) de prueba:`);
  objetivo.forEach(t => console.log(`  - ${t.nombre} (${t.email_admin})`));

  for (const t of objetivo) {
    const id = t.id_tenant;
    // El orden importa: se borran primero las tablas que apuntan a otras
    await prisma.$transaction(async (tx) => {
      const procesos = await tx.proceso.findMany({ where: { tenant_id: id }, select: { id_proceso: true } });
      const ids = procesos.map(p => p.id_proceso);

      const terminos = await tx.terminoJudicial.findMany({ where: { tenant_id: id }, select: { id_termino: true } });
      await tx.recordatorioTermino.deleteMany({ where: { id_termino: { in: terminos.map(x => x.id_termino) } } });
      await tx.terminoJudicial.deleteMany({ where: { tenant_id: id } });

      const audiencias = await tx.audiencia.findMany({ where: { tenant_id: id }, select: { id_audiencia: true } });
      await tx.recordatorioAudiencia.deleteMany({ where: { id_audiencia: { in: audiencias.map(x => x.id_audiencia) } } });
      await tx.audiencia.deleteMany({ where: { tenant_id: id } });

      await tx.actuacion.deleteMany({ where: { tenant_id: id } });

      const docs = await tx.documento.findMany({ where: { tenant_id: id }, select: { id_documento: true } });
      await tx.documento.updateMany({ where: { tenant_id: id }, data: { id_version_actual: null } });
      await tx.versionDocumento.deleteMany({ where: { id_documento: { in: docs.map(x => x.id_documento) } } });
      await tx.documento.deleteMany({ where: { tenant_id: id } });

      await tx.parteProcesal.deleteMany({ where: { tenant_id: id } });
      await tx.procesoAbogado.deleteMany({ where: { id_proceso: { in: ids } } });
      await tx.historialProceso.deleteMany({ where: { tenant_id: id } });
      await tx.notificacion.deleteMany({ where: { tenant_id: id } });
      await tx.bitacoraAuditoria.deleteMany({ where: { tenant_id: id } });
      await tx.proceso.deleteMany({ where: { tenant_id: id } });
      await tx.cliente.deleteMany({ where: { tenant_id: id } });

      const usuarios = await tx.usuario.findMany({ where: { tenant_id: id }, select: { id_usuario: true } });
      await tx.permisoRol.deleteMany({ where: { id_usuario: { in: usuarios.map(u => u.id_usuario) } } });
      await tx.usuario.deleteMany({ where: { tenant_id: id } });
      await tx.tenant.delete({ where: { id_tenant: id } });
    });
  }

  const restantes = await prisma.tenant.count();
  console.log(`\nListo. Consultorios restantes en la base: ${restantes}`);
})()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
