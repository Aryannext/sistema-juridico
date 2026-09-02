const prisma = require('../../config/prisma');
const { signToken } = require('../../utils/jwt');
const { comparePassword } = require('../../utils/bcrypt');
const { TIPO_PLATAFORMA } = require('../../middlewares/plataforma.middleware');

/**
 * Administración de la plataforma: alta, suspensión y baja de consultorios.
 *
 * Alcance deliberadamente limitado: se ve el nombre del consultorio, su estado,
 * su plan y cuánto tiene dado de alta. **No se puede abrir ningún expediente,
 * cliente ni documento.** Para cobrar suscripciones y suspender morosos no hace
 * ninguna falta, y los expedientes están cubiertos por el secreto profesional
 * entre abogado y cliente.
 */

/** Deja constancia de la acción. Va a su propia bitácora: ver el esquema. */
function registrar(req, { accion, tenant_id, tenant_nombre, justificacion = null }) {
  return prisma.bitacoraPlataforma.create({
    data: {
      id_admin: req.admin.id_admin,
      accion,
      tenant_id,
      tenant_nombre,
      justificacion,
      ip_address: req.ip || null,
    },
  });
}

// ── 1. Inicio de sesión ────────────────────────────────────────────────
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Correo y contraseña son obligatorios' });
    }

    const admin = await prisma.adminPlataforma.findUnique({ where: { email } });

    // Mismo mensaje si no existe, si la contraseña falla o si está inactivo:
    // no se le dice a nadie qué correos son de administrador de plataforma.
    const credencialesInvalidas = () =>
      res.status(401).json({ error: 'Credenciales inválidas' });

    if (!admin || !admin.activo) return credencialesInvalidas();

    const valida = await comparePassword(password, admin.password_hash);
    if (!valida) return credencialesInvalidas();

    await prisma.adminPlataforma.update({
      where: { id_admin: admin.id_admin },
      data: { ultimo_acceso: new Date() },
    });

    // `tipo` es lo que distingue este token del de un consultorio.
    const token = signToken({ id_admin: admin.id_admin, tipo: TIPO_PLATAFORMA }, '4h');

    res.json({
      token,
      admin: { id: admin.id_admin, nombre: admin.nombre, email: admin.email },
    });
  } catch (error) {
    console.error('Error en el inicio de sesión de plataforma:', error);
    res.status(500).json({ error: 'Error en el inicio de sesión' });
  }
};

// ── 2. Listar consultorios ─────────────────────────────────────────────
exports.listarConsultorios = async (req, res) => {
  try {
    const { buscar, estado } = req.query;

    const where = {};
    if (buscar && buscar.trim().length >= 2) {
      const termino = buscar.trim();
      where.OR = [
        { nombre: { contains: termino, mode: 'insensitive' } },
        { email_admin: { contains: termino, mode: 'insensitive' } },
        { nit: { contains: termino, mode: 'insensitive' } },
      ];
    }
    if (estado === 'activos') where.activo = true;
    if (estado === 'suspendidos') where.activo = false;

    const consultorios = await prisma.tenant.findMany({
      where,
      // Selección explícita: se enumeran los campos administrativos y NADA del
      // contenido jurídico. Un `include` sin filtrar acabaría exponiendo
      // expedientes en cuanto alguien añadiera una relación al modelo.
      select: {
        id_tenant: true,
        nombre: true,
        tipo: true,
        nit: true,
        email_admin: true,
        telefono: true,
        ciudad: true,
        plan: true,
        activo: true,
        created_at: true,
        _count: {
          select: { usuarios: true, clientes: true, procesos: true },
        },
      },
      orderBy: [{ activo: 'desc' }, { created_at: 'desc' }],
    });

    res.json(consultorios);
  } catch (error) {
    console.error('Error listando consultorios:', error);
    res.status(500).json({ error: 'Error al obtener los consultorios' });
  }
};

// ── 3. Suspender y reactivar ───────────────────────────────────────────
exports.cambiarEstadoConsultorio = async (req, res) => {
  try {
    const { id } = req.params;
    const { activo, justificacion } = req.body;

    if (typeof activo !== 'boolean') {
      return res.status(400).json({ error: 'Indique si el consultorio queda activo o suspendido' });
    }
    if (activo === false && (!justificacion || !justificacion.trim())) {
      return res.status(400).json({ error: 'La suspensión requiere una justificación escrita' });
    }

    const consultorio = await prisma.tenant.findUnique({ where: { id_tenant: id } });
    if (!consultorio) {
      return res.status(404).json({ error: 'Consultorio no encontrado' });
    }
    if (consultorio.activo === activo) {
      return res.status(400).json({
        error: `El consultorio ya está ${activo ? 'activo' : 'suspendido'}`,
      });
    }

    const actualizado = await prisma.tenant.update({
      where: { id_tenant: id },
      data: { activo },
    });

    await registrar(req, {
      accion: activo ? 'REACTIVAR_CONSULTORIO' : 'SUSPENDER_CONSULTORIO',
      tenant_id: id,
      tenant_nombre: consultorio.nombre,
      justificacion: justificacion ? justificacion.trim() : null,
    });

    res.json({
      message: activo
        ? `El consultorio ${consultorio.nombre} vuelve a tener acceso`
        : `El consultorio ${consultorio.nombre} queda suspendido. Sus usuarios ya no pueden entrar.`,
      consultorio: { id_tenant: actualizado.id_tenant, activo: actualizado.activo },
    });
  } catch (error) {
    console.error('Error cambiando el estado del consultorio:', error);
    res.status(500).json({ error: 'Error al cambiar el estado del consultorio' });
  }
};

// ── 4. Eliminar definitivamente ────────────────────────────────────────
exports.eliminarConsultorio = async (req, res) => {
  try {
    const { id } = req.params;
    const { justificacion, confirmacion } = req.body;

    const consultorio = await prisma.tenant.findUnique({ where: { id_tenant: id } });
    if (!consultorio) {
      return res.status(404).json({ error: 'Consultorio no encontrado' });
    }

    // Tres cerrojos, y ninguno es decorativo. Esto borra expedientes judiciales:
    // en un despacho, perderlos puede tener consecuencias legales para su
    // titular, así que la operación tiene que costar trabajo a propósito.

    // 1) Suspendido primero. Obliga a que exista un periodo en el que el
    //    consultorio ya no entra pero sus datos siguen ahí, y da margen a
    //    rectificar si la baja fue un error o el cliente se arrepiente.
    if (consultorio.activo) {
      return res.status(400).json({
        error: 'Antes de eliminarlo hay que suspenderlo. Así queda un periodo de gracia para rectificar.',
        requiereSuspension: true,
      });
    }

    // 2) Escribir el nombre exacto. Evita eliminar el de la fila de al lado.
    if (!confirmacion || confirmacion.trim() !== consultorio.nombre) {
      return res.status(400).json({
        error: 'Para confirmar, escriba el nombre exacto del consultorio.',
        nombreEsperado: consultorio.nombre,
      });
    }

    // 3) Justificación, que queda en la bitácora de plataforma.
    if (!justificacion || justificacion.trim().length < 10) {
      return res.status(400).json({
        error: 'Se requiere una justificación de al menos 10 caracteres.',
      });
    }

    // La bitácora se escribe ANTES de borrar y fuera de la transacción: si el
    // borrado fallara a medias, queda constancia del intento. Su tabla no
    // cuelga del consultorio, así que sobrevive a su desaparición.
    await registrar(req, {
      accion: 'ELIMINAR_CONSULTORIO',
      tenant_id: id,
      tenant_nombre: consultorio.nombre,
      justificacion: justificacion.trim(),
    });

    const resumen = await prisma.$transaction(async (tx) => {
      const usuarios = await tx.usuario.findMany({
        where: { tenant_id: id },
        select: { id_usuario: true },
      });
      const idsUsuarios = usuarios.map((u) => u.id_usuario);

      const procesos = await tx.proceso.findMany({
        where: { tenant_id: id },
        select: { id_proceso: true },
      });
      const idsProcesos = procesos.map((p) => p.id_proceso);

      const documentos = await tx.documento.findMany({
        where: { tenant_id: id },
        select: { id_documento: true },
      });
      const idsDocumentos = documentos.map((d) => d.id_documento);

      const audiencias = await tx.audiencia.findMany({
        where: { tenant_id: id },
        select: { id_audiencia: true },
      });
      const terminos = await tx.terminoJudicial.findMany({
        where: { tenant_id: id },
        select: { id_termino: true },
      });

      // El orden importa: de las hojas hacia la raíz. Las claves foráneas son
      // ON DELETE RESTRICT, así que cualquier salto rompe la transacción.
      await tx.recordatorioAudiencia.deleteMany({
        where: { id_audiencia: { in: audiencias.map((a) => a.id_audiencia) } },
      });
      await tx.recordatorioTermino.deleteMany({
        where: { id_termino: { in: terminos.map((t) => t.id_termino) } },
      });
      await tx.versionDocumento.deleteMany({ where: { id_documento: { in: idsDocumentos } } });
      await tx.notificacion.deleteMany({ where: { tenant_id: id } });
      await tx.historialProceso.deleteMany({ where: { tenant_id: id } });
      await tx.bitacoraAuditoria.deleteMany({ where: { tenant_id: id } });
      await tx.permisoRol.deleteMany({ where: { id_usuario: { in: idsUsuarios } } });
      await tx.procesoAbogado.deleteMany({ where: { id_proceso: { in: idsProcesos } } });
      await tx.parteProcesal.deleteMany({ where: { tenant_id: id } });
      await tx.terminoJudicial.deleteMany({ where: { tenant_id: id } });
      await tx.actuacion.deleteMany({ where: { tenant_id: id } });
      await tx.audiencia.deleteMany({ where: { tenant_id: id } });
      await tx.documento.deleteMany({ where: { tenant_id: id } });
      await tx.proceso.deleteMany({ where: { tenant_id: id } });
      await tx.cliente.deleteMany({ where: { tenant_id: id } });
      await tx.usuario.deleteMany({ where: { tenant_id: id } });
      await tx.tenant.delete({ where: { id_tenant: id } });

      return {
        usuarios: idsUsuarios.length,
        procesos: idsProcesos.length,
        documentos: idsDocumentos.length,
      };
    });

    res.json({
      message: `El consultorio ${consultorio.nombre} y toda su información han sido eliminados definitivamente.`,
      resumen,
      // Los archivos subidos viven en el almacenamiento externo (Cloudflare R2)
      // y no los borra esta transacción. Se avisa para que quede constancia.
      avisoArchivos: resumen.documentos > 0
        ? `Quedan ${resumen.documentos} archivos en el almacenamiento externo que deben retirarse aparte.`
        : null,
    });
  } catch (error) {
    console.error('Error eliminando el consultorio:', error);
    res.status(500).json({ error: 'Error al eliminar el consultorio' });
  }
};

// ── 5. Bitácora de la plataforma ───────────────────────────────────────
exports.bitacora = async (req, res) => {
  try {
    const registros = await prisma.bitacoraPlataforma.findMany({
      include: { admin: { select: { nombre: true, email: true } } },
      orderBy: { created_at: 'desc' },
      take: 200,
    });
    res.json(registros);
  } catch (error) {
    console.error('Error obteniendo la bitácora de plataforma:', error);
    res.status(500).json({ error: 'Error al obtener la bitácora' });
  }
};

// ── 6. Resumen general ─────────────────────────────────────────────────
exports.resumen = async (req, res) => {
  try {
    const [total, activos, usuarios, procesos] = await Promise.all([
      prisma.tenant.count(),
      prisma.tenant.count({ where: { activo: true } }),
      prisma.usuario.count(),
      prisma.proceso.count(),
    ]);

    res.json({
      consultorios: { total, activos, suspendidos: total - activos },
      usuarios,
      procesos,
    });
  } catch (error) {
    console.error('Error obteniendo el resumen de plataforma:', error);
    res.status(500).json({ error: 'Error al obtener el resumen' });
  }
};
