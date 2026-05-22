const prisma = require('../../config/prisma');

// 1. Crear un expediente jurídico digital
exports.createProceso = async (req, res) => {
  try {
    const { numero_radicado, juzgado, tipo_proceso, clase_proceso, area_derecho, estado, fecha_radicado, id_cliente, id_abogado_resp } = req.body;

    const existingProceso = await prisma.proceso.findUnique({ where: { numero_radicado } });
    if (existingProceso) {
      return res.status(400).json({ error: 'El número de radicado ya existe en el sistema' });
    }

    const proceso = await prisma.proceso.create({
      data: {
        tenant_id: req.tenant_id,
        numero_radicado,
        juzgado,
        tipo_proceso,
        clase_proceso,
        area_derecho,
        estado: estado || 'ACTIVO',
        fecha_radicado: fecha_radicado ? new Date(fecha_radicado) : null,
        id_cliente,
        id_abogado_resp
      }
    });

    // Registrar en auditoría
    await prisma.bitacoraAuditoria.create({
      data: {
        tenant_id: req.tenant_id,
        id_usuario: req.user.id_usuario,
        accion: 'CREAR_EXPEDIENTE',
        modulo: 'PROCESOS',
        detalle: `Expediente creado con radicado ${numero_radicado}`,
        ip_adress: req.ip || '127.0.0.1'
      }
    });

    res.status(201).json({ message: 'Expediente creado exitosamente', proceso });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error creando el expediente' });
  }
};

// 2. Obtener expedientes jurídicos (HU-31: Búsqueda y Filtrado Avanzado)
exports.getProcesos = async (req, res) => {
  try {
    const { search, estado, tipo_proceso, page = 1, limit = 20 } = req.query;
    const parsedPage = Math.max(1, parseInt(page));
    const parsedLimit = Math.max(1, parseInt(limit));
    const skip = (parsedPage - 1) * parsedLimit;

    let baseConditions = { tenant_id: req.tenant_id };

    // Si no es admin, solo ve los procesos donde es abogado responsable OR está asignado en proceso_abogados
    if (req.user.rol !== 'ADMINISTRADOR') {
      baseConditions.OR = [
        { id_abogado_resp: req.user.id_usuario },
        {
          abogados: {
            some: {
              id_usuario: req.user.id_usuario
            }
          }
        }
      ];
    }

    let andConditions = [];

    // Búsqueda parcial activada al ingresar al menos 3 caracteres
    if (search && search.trim().length >= 3) {
      const term = search.trim();
      andConditions.push({
        OR: [
          { numero_radicado: { contains: term, mode: 'insensitive' } },
          { juzgado: { contains: term, mode: 'insensitive' } },
          {
            cliente: {
              OR: [
                { nombre: { contains: term, mode: 'insensitive' } },
                { razon_social: { contains: term, mode: 'insensitive' } }
              ]
            }
          },
          {
            abogado_resp: {
              nombre: { contains: term, mode: 'insensitive' }
            }
          }
        ]
      });
    }

    if (estado) {
      andConditions.push({ estado });
    }

    if (tipo_proceso) {
      andConditions.push({ tipo_proceso });
    }

    const whereClause = andConditions.length > 0 
      ? { ...baseConditions, AND: andConditions }
      : baseConditions;

    // Conteo total para paginación
    const totalCount = await prisma.proceso.count({ where: whereClause });

    const procesos = await prisma.proceso.findMany({
      where: whereClause,
      include: {
        cliente: { select: { nombre: true, razon_social: true } },
        abogado_resp: { select: { nombre: true, email: true, rol: true } }
      },
      orderBy: { create_at: 'desc' },
      skip,
      take: parsedLimit
    });

    res.json({
      procesos,
      pagination: {
        total: totalCount,
        page: parsedPage,
        limit: parsedLimit,
        pages: Math.ceil(totalCount / parsedLimit)
      }
    });
  } catch (error) {
    console.error('Error en getProcesos:', error);
    res.status(500).json({ error: 'Error obteniendo expedientes' });
  }
};

// 3. Consultar expediente por ID (incluye historial y partes)
exports.getProcesoById = async (req, res) => {
  try {
    const { id } = req.params;
    const proceso = await prisma.proceso.findUnique({
      where: { id_proceso: id, tenant_id: req.tenant_id },
      include: {
        cliente: true,
        abogado_resp: true,
        abogados: { include: { usuario: true } },
        partes: true,
        historial: {
          include: {
            usuario: { select: { nombre: true } }
          },
          orderBy: {
            created_at: 'desc'
          }
        }
      }
    });

    if (!proceso) return res.status(404).json({ error: 'Expediente no encontrado' });

    res.json(proceso);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error obteniendo expediente' });
  }
};

// 4. Modificar información general del expediente (HU-33)
exports.updateProceso = async (req, res) => {
  try {
    const { id } = req.params;
    const { juzgado, clase_proceso, area_derecho, fecha_radicado } = req.body;

    const procesoOld = await prisma.proceso.findUnique({ where: { id_proceso: id } });
    if (!procesoOld) return res.status(404).json({ error: 'Expediente no encontrado' });

    const proceso = await prisma.proceso.update({
      where: { id_proceso: id, tenant_id: req.tenant_id },
      data: {
        ...(juzgado && { juzgado }),
        ...(clase_proceso && { clase_proceso }),
        ...(area_derecho && { area_derecho }),
        ...(fecha_radicado && { fecha_radicado: new Date(fecha_radicado) })
      }
    });

    // Registrar en historial_proceso (HU-33)
    const camposModificados = Object.keys(req.body).join(', ');
    await prisma.historialProceso.create({
      data: {
        tenant_id: req.tenant_id,
        id_proceso: id,
        campo_modificado: camposModificados,
        valor_anterior: JSON.stringify({
          juzgado: procesoOld.juzgado,
          clase_proceso: procesoOld.clase_proceso,
          area_derecho: procesoOld.area_derecho
        }),
        valor_nuevo: JSON.stringify(req.body),
        accion: 'ACTUALIZACION_GENERAL',
        realizado_por: req.user.id_usuario
      }
    });

    res.json({ message: 'Expediente actualizado', proceso });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error actualizando expediente' });
  }
};

// 5. HU-08: Asignar abogados y colaboradores adicionales
exports.addAbogadoProceso = async (req, res) => {
  try {
    const { id } = req.params; // id_proceso
    const { id_usuario, rol_en_proceso } = req.body; // rol_en_proceso: 'ABOGADO' o 'ASISTENTE'

    const proceso = await prisma.proceso.findFirst({
      where: { id_proceso: id, tenant_id: req.tenant_id }
    });

    if (!proceso) return res.status(404).json({ error: 'Expediente no encontrado' });

    const user = await prisma.usuario.findFirst({
      where: { id_usuario, tenant_id: req.tenant_id }
    });

    if (!user) return res.status(404).json({ error: 'Usuario a asignar no encontrado en el consultorio' });

    // Verificar si ya está asignado
    const existingAsign = await prisma.procesoAbogado.findFirst({
      where: { id_proceso: id, id_usuario }
    });

    if (existingAsign) return res.status(400).json({ error: 'Este usuario ya se encuentra asignado a este proceso' });

    const asignation = await prisma.procesoAbogado.create({
      data: {
        id_proceso: id,
        id_usuario,
        rol_en_proceso: rol_en_proceso || 'ABOGADO'
      }
    });

    // Registrar en Historial
    await prisma.historialProceso.create({
      data: {
        tenant_id: req.tenant_id,
        id_proceso: id,
        campo_modificado: 'equipo_trabajo',
        valor_nuevo: `Asignado: ${user.nombre} (${rol_en_proceso || 'ABOGADO'})`,
        accion: 'ASIGNACION_ABOGADO',
        realizado_por: req.user.id_usuario
      }
    });

    // Registrar en Bitácora
    await prisma.bitacoraAuditoria.create({
      data: {
        tenant_id: req.tenant_id,
        id_usuario: req.user.id_usuario,
        accion: 'ASIGNAR_COLABORADOR',
        modulo: 'PROCESOS',
        detalle: `Abogado ${user.nombre} asignado a expediente ${proceso.numero_radicado}`,
        ip_adress: req.ip || '127.0.0.1'
      }
    });

    res.status(201).json({ message: 'Abogado/Colaborador asignado con éxito', asignation });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error asignando abogado al expediente' });
  }
};

// 6. HU-08: Remover abogado o colaborador adicional
exports.removeAbogadoProceso = async (req, res) => {
  try {
    const { id, id_usuario } = req.params;

    const proceso = await prisma.proceso.findFirst({
      where: { id_proceso: id, tenant_id: req.tenant_id }
    });

    if (!proceso) return res.status(404).json({ error: 'Expediente no encontrado' });

    // Verificar existencia de la asignación
    const existingAsign = await prisma.procesoAbogado.findFirst({
      where: { id_proceso: id, id_usuario }
    });

    if (!existingAsign) return res.status(404).json({ error: 'La asignación no existe' });

    // Regla de negocio: El proceso debe tener al menos un abogado responsable
    // (id_abogado_resp sigue siendo el responsable principal, así que remover de ProcesoAbogado es seguro).
    await prisma.procesoAbogado.delete({
      where: {
        id_proceso_id_usuario: {
          id_proceso: id,
          id_usuario
        }
      }
    });

    const user = await prisma.usuario.findUnique({ where: { id_usuario } });

    // Registrar en Historial
    await prisma.historialProceso.create({
      data: {
        tenant_id: req.tenant_id,
        id_proceso: id,
        campo_modificado: 'equipo_trabajo',
        valor_nuevo: `Removido: ${user?.nombre || id_usuario}`,
        accion: 'DESASIGNACION_ABOGADO',
        realizado_por: req.user.id_usuario
      }
    });

    // Registrar en Auditoría
    await prisma.bitacoraAuditoria.create({
      data: {
        tenant_id: req.tenant_id,
        id_usuario: req.user.id_usuario,
        accion: 'DESASIGNAR_COLABORADOR',
        modulo: 'PROCESOS',
        detalle: `Abogado/Asistente desasignado del expediente ${proceso.numero_radicado}`,
        ip_adress: req.ip || '127.0.0.1'
      }
    });

    res.json({ message: 'Abogado/Colaborador desasignado con éxito' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error removiendo abogado del expediente' });
  }
};

// 7. HU-09: Cambiar el estado del proceso con reglas de validación
exports.cambiarEstadoProceso = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado, justificacion, force = false } = req.body; // estado: 'ACTIVO', 'SUSPENDIDO', 'ARCHIVADO', 'FINALIZADO'

    if (!estado || !justificacion) {
      return res.status(400).json({ error: 'El nuevo estado y la justificación escrita son requeridos.' });
    }

    const proceso = await prisma.proceso.findFirst({
      where: { id_proceso: id, tenant_id: req.tenant_id }
    });

    if (!proceso) return res.status(404).json({ error: 'Expediente no encontrado' });

    // Regla 1: Bloqueo de archivado si hay audiencias en 30 días o términos pendientes sin gestionar
    if (estado === 'ARCHIVADO') {
      const terminosPendientes = await prisma.terminoJudicial.findMany({
        where: { id_proceso: id, estado: 'PENDIENTE' }
      });

      const fechaLimiteAudiencia = new Date();
      fechaLimiteAudiencia.setDate(fechaLimiteAudiencia.getDate() + 30);
      const audienciasProximas = await prisma.audiencia.findMany({
        where: {
          id_proceso: id,
          estado: 'PROGRAMADA',
          fecha_hora: {
            gte: new Date(),
            lte: fechaLimiteAudiencia
          }
        }
      });

      if (terminosPendientes.length > 0 || audienciasProximas.length > 0) {
        // Si no es admin o no se forzó, bloquear
        if (req.user.rol !== 'ADMINISTRADOR' || !force) {
          return res.status(400).json({
            error: 'No se puede archivar el expediente: existen términos pendientes o audiencias programadas en los próximos 30 días.',
            hasPending: true,
            terminos: terminosPendientes.map(t => t.nombre),
            audiencias: audienciasProximas.map(a => `${a.nombre} (${new Date(a.fecha_hora).toLocaleDateString()})`)
          });
        }
      }
    }

    // Regla 2: Un proceso en estado FINALIZADO o ARCHIVADO no puede regresar a ACTIVO sin autorización de Admin
    if ((proceso.estado === 'FINALIZADO' || proceso.estado === 'ARCHIVADO') && (estado === 'ACTIVO' || estado === 'SUSPENDIDO')) {
      if (req.user.rol !== 'ADMINISTRADOR') {
        return res.status(403).json({ error: 'Reactivación denegada. Los expedientes archivados o finalizados solo pueden ser reactivados por un ADMINISTRADOR.' });
      }
    }

    // Ejecutar actualización
    const updatedProceso = await prisma.proceso.update({
      where: { id_proceso: id },
      data: { estado }
    });

    // Registrar en Historial
    await prisma.historialProceso.create({
      data: {
        tenant_id: req.tenant_id,
        id_proceso: id,
        campo_modificado: 'estado',
        valor_anterior: proceso.estado,
        valor_nuevo: `${estado} (Justificación: ${justificacion})`,
        accion: 'CAMBIO_ESTADO',
        realizado_por: req.user.id_usuario
      }
    });

    // Registrar en Bitácora
    await prisma.bitacoraAuditoria.create({
      data: {
        tenant_id: req.tenant_id,
        id_usuario: req.user.id_usuario,
        accion: 'CAMBIAR_ESTADO_EXPEDIENTE',
        modulo: 'PROCESOS',
        detalle: `Expediente ${proceso.numero_radicado} cambiado a estado ${estado}. Justificación: ${justificacion}`,
        ip_adress: req.ip || '127.0.0.1'
      }
    });

    res.json({ message: `Estado del expediente actualizado a ${estado} exitosamente`, proceso: updatedProceso });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error cambiando el estado del expediente' });
  }
};

// 8. HU-11: Registrar partes procesales de un expediente
exports.addParteProcesal = async (req, res) => {
  try {
    const { id } = req.params; // id_proceso
    const { nombre, tipo, id_documento } = req.body; // tipo: 'DEMANDANTE', 'DEMANDADO', 'VICTIMA', etc.

    if (!nombre || !tipo) {
      return res.status(400).json({ error: 'El nombre y el tipo de parte procesal son obligatorios.' });
    }

    const proceso = await prisma.proceso.findFirst({
      where: { id_proceso: id, tenant_id: req.tenant_id }
    });

    if (!proceso) return res.status(404).json({ error: 'Expediente no encontrado' });

    const parte = await prisma.parteProcesal.create({
      data: {
        tenant_id: req.tenant_id,
        id_proceso: id,
        nombre,
        tipo,
        id_documento: id_documento || null
      }
    });

    // Registrar en Historial
    await prisma.historialProceso.create({
      data: {
        tenant_id: req.tenant_id,
        id_proceso: id,
        campo_modificado: 'partes_procesales',
        valor_nuevo: `Registrado: ${nombre} (${tipo})`,
        accion: 'REGISTRO_PARTE',
        realizado_por: req.user.id_usuario
      }
    });

    // Registrar en Auditoría
    await prisma.bitacoraAuditoria.create({
      data: {
        tenant_id: req.tenant_id,
        id_usuario: req.user.id_usuario,
        accion: 'REGISTRAR_PARTE',
        modulo: 'PROCESOS',
        detalle: `Parte procesal ${nombre} (${tipo}) registrada en expediente ${proceso.numero_radicado}`,
        ip_adress: req.ip || '127.0.0.1'
      }
    });

    res.status(201).json({ message: 'Parte procesal registrada exitosamente', parte });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error registrando parte procesal en el expediente' });
  }
};

// 9. HU-11: Eliminar parte procesal de un expediente
exports.removeParteProcesal = async (req, res) => {
  try {
    const { id, id_parte } = req.params;

    const proceso = await prisma.proceso.findFirst({
      where: { id_proceso: id, tenant_id: req.tenant_id }
    });

    if (!proceso) return res.status(404).json({ error: 'Expediente no encontrado' });

    const parte = await prisma.parteProcesal.findFirst({
      where: { id_procesal: id_parte, id_proceso: id }
    });

    if (!parte) return res.status(404).json({ error: 'Parte procesal no encontrada' });

    await prisma.parteProcesal.delete({
      where: { id_procesal: id_parte }
    });

    // Registrar en Historial
    await prisma.historialProceso.create({
      data: {
        tenant_id: req.tenant_id,
        id_proceso: id,
        campo_modificado: 'partes_procesales',
        valor_nuevo: `Removido: ${parte.nombre}`,
        accion: 'ELIMINACION_PARTE',
        realizado_por: req.user.id_usuario
      }
    });

    // Registrar en Auditoría
    await prisma.bitacoraAuditoria.create({
      data: {
        tenant_id: req.tenant_id,
        id_usuario: req.user.id_usuario,
        accion: 'ELIMINAR_PARTE',
        modulo: 'PROCESOS',
        detalle: `Parte procesal ${parte.nombre} desvinculada del expediente ${proceso.numero_radicado}`,
        ip_adress: req.ip || '127.0.0.1'
      }
    });

    res.json({ message: 'Parte procesal eliminada con éxito' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error eliminando parte procesal' });
  }
};

// 10. HU-34: Eliminar definitivamente un expediente (ADMINISTRADOR)
exports.deleteProcesoDefinitivo = async (req, res) => {
  try {
    const { id } = req.params;
    const { justificacion } = req.body;

    if (!justificacion) {
      return res.status(400).json({ error: 'Se requiere obligatoriamente ingresar una justificación escrita para eliminar el expediente.' });
    }

    // Validar rol de administrador
    if (req.user.rol !== 'ADMINISTRADOR') {
      return res.status(403).json({ error: 'Acceso Denegado. Solo los administradores pueden realizar la eliminación definitiva de expedientes.' });
    }

    const proceso = await prisma.proceso.findFirst({
      where: { id_proceso: id, tenant_id: req.tenant_id }
    });

    if (!proceso) return res.status(404).json({ error: 'Expediente no encontrado' });

    // Regla de negocio: Impedir eliminar si hay documentos activos o términos pendientes sin gestionar
    const documentosActivos = await prisma.documento.findMany({
      where: { id_proceso: id, estado: { not: 'INACTIVO' } }
    });

    const terminosPendientes = await prisma.terminoJudicial.findMany({
      where: { id_proceso: id, estado: 'PENDIENTE' }
    });

    if (documentosActivos.length > 0 || terminosPendientes.length > 0) {
      return res.status(400).json({
        error: 'No se puede eliminar el expediente definitivamente: existen documentos soporte activos o términos judiciales pendientes sin gestionar.',
        documentosCount: documentosActivos.length,
        terminosCount: terminosPendientes.length
      });
    }

    // Eliminar en cascada
    await prisma.$transaction(async (tx) => {
      // Eliminar registros de ProcesoAbogado
      await tx.procesoAbogado.deleteMany({ where: { id_proceso: id } });
      // Eliminar partes procesales
      await tx.parteProcesal.deleteMany({ where: { id_proceso: id } });
      // Eliminar audiencias y recordatorios
      const audiencias = await tx.audiencia.findMany({ where: { id_proceso: id } });
      const idAudiencias = audiencias.map(a => a.id_audiencia);
      await tx.recordatorioAudiencia.deleteMany({ where: { id_audiencia: { in: idAudiencias } } });
      await tx.audiencia.deleteMany({ where: { id_proceso: id } });
      // Eliminar términos y recordatorios
      const terminos = await tx.terminoJudicial.findMany({ where: { id_proceso: id } });
      const idTerminos = terminos.map(t => t.id_termino);
      await tx.recordatorioTermino.deleteMany({ where: { id_termino: { in: idTerminos } } });
      await tx.terminoJudicial.deleteMany({ where: { id_proceso: id } });
      // Eliminar documentos (ya validado que están INACTIVOS)
      const documentos = await tx.documento.findMany({ where: { id_proceso: id } });
      const idDocumentos = documentos.map(d => d.id_documento);
      await tx.versionDocumento.deleteMany({ where: { id_documento: { in: idDocumentos } } });
      await tx.documento.deleteMany({ where: { id_proceso: id } });
      // Eliminar historial
      await tx.historialProceso.deleteMany({ where: { id_proceso: id } });
      // Finalmente, eliminar el Proceso
      await tx.proceso.delete({ where: { id_proceso: id } });
    });

    // Registrar en auditoría de forma inmutable
    await prisma.bitacoraAuditoria.create({
      data: {
        tenant_id: req.tenant_id,
        id_usuario: req.user.id_usuario,
        accion: 'ELIMINAR_EXPEDIENTE_DEFINTIVO',
        modulo: 'ADMINISTRACION',
        detalle: `ELIMINACIÓN DEFINITIVA del expediente radicado: ${proceso.numero_radicado}. Justificación: ${justificacion}`,
        ip_adress: req.ip || '127.0.0.1'
      }
    });

    res.json({ message: 'Expediente jurídico y toda su información relacionada eliminados definitivamente del sistema con éxito.' });
  } catch (error) {
    console.error('Error deleteProcesoDefinitivo:', error);
    res.status(500).json({ error: 'Error interno del servidor al intentar realizar la eliminación definitiva.' });
  }
};
