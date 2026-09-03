const prisma = require('../../config/prisma');
const { triggerWebhook } = require('../../config/webhook');
const atencion = require('./atencion');
const { validarResponsable } = require('./responsable');

// 1. Crear un expediente jurídico digital
exports.createProceso = async (req, res) => {
  try {
    const { numero_radicado, juzgado, tipo_proceso, clase_proceso, area_derecho, estado, fecha_radicado, id_cliente, id_abogado_resp } = req.body;

    // La comprobación se limita al consultorio en sesión a propósito. Buscar en
    // todo el sistema tenía dos consecuencias: impedía que la contraparte, que
    // litiga el mismo proceso con el mismo radicado desde otra oficina, lo
    // registrara; y el mensaje de error revelaba que un consultorio ajeno lleva
    // ese caso.
    const existingProceso = await prisma.proceso.findFirst({
      where: { numero_radicado, tenant_id: req.tenant_id }
    });
    if (existingProceso) {
      return res.status(400).json({ error: 'Su consultorio ya tiene registrado un expediente con ese número de radicado' });
    }

    // RN04: el responsable tiene que ser alguien que pueda responder de verdad.
    // Antes se guardaba lo que viniera en la petición: un usuario de otro
    // consultorio, uno inactivo o un cliente pasaban sin más, y el expediente
    // nacía cumpliendo la regla en la forma e incumpliéndola en el fondo.
    const comprobacion = await validarResponsable(prisma, id_abogado_resp, req.tenant_id);
    if (!comprobacion.valido) {
      return res.status(400).json({ error: comprobacion.error });
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

    // Sin el filtro por consultorio, un expediente ajeno superaba este 404 y el
    // fallo aparecía después como un 500 opaco en el update.
    const procesoOld = await prisma.proceso.findFirst({
      where: { id_proceso: id, tenant_id: req.tenant_id }
    });
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

/**
 * Cambiar el abogado responsable de un expediente — RN04, HU-08.
 *
 * **Por qué hacía falta crear esta operación en vez de limitarse a validarla.**
 * RN04 figuraba como parcial porque «no se valida el cambio de responsable».
 * En realidad no se validaba porque **no se podía cambiar**: ningún punto de la
 * API escribía `id_abogado_resp` después de crear el expediente.
 *
 * Eso no cumplía la regla, la esquivaba. Cuando un abogado deja el despacho,
 * sus expedientes se quedaban con su nombre encima para siempre: el campo
 * lleno, la regla satisfecha en la forma, y nadie vigilando esos términos —que
 * es literalmente el escenario del que RN04 nace—. La única salida era un
 * UPDATE a mano en la base de datos, sin validación y sin rastro.
 *
 * Así que la operación existe, y existe validada: mismo filtro que al crear
 * (consultorio, cuenta activa, rol que pueda responder), justificación escrita
 * y doble registro —bitácora del consultorio e historial del expediente—,
 * porque cambiar de responsable es de las decisiones que después hay que poder
 * explicar.
 */
exports.cambiarResponsable = async (req, res) => {
  try {
    const { id } = req.params;
    const { id_abogado_resp, justificacion } = req.body;

    if (!justificacion || String(justificacion).trim() === '') {
      return res.status(400).json({
        error: 'Debe explicar por escrito por qué cambia el abogado responsable.'
      });
    }

    const proceso = await prisma.proceso.findFirst({
      where: { id_proceso: id, tenant_id: req.tenant_id },
      include: { abogado_resp: { select: { id_usuario: true, nombre: true } } }
    });
    if (!proceso) return res.status(404).json({ error: 'Expediente no encontrado' });

    if (proceso.id_abogado_resp === id_abogado_resp) {
      return res.status(400).json({
        error: 'Ese abogado ya es el responsable de este expediente.'
      });
    }

    const comprobacion = await validarResponsable(prisma, id_abogado_resp, req.tenant_id);
    if (!comprobacion.valido) {
      return res.status(400).json({ error: comprobacion.error });
    }

    const nuevo = comprobacion.usuario;

    // El cambio y sus dos registros van juntos o no van: un expediente que
    // cambia de responsable sin que conste quién lo decidió es justo lo que
    // esta regla trata de impedir.
    await prisma.$transaction(async (tx) => {
      await tx.proceso.update({
        where: { id_proceso: id },
        data: { id_abogado_resp }
      });

      await tx.historialProceso.create({
        data: {
          tenant_id: req.tenant_id,
          id_proceso: id,
          campo_modificado: 'abogado_responsable',
          valor_anterior: proceso.abogado_resp?.nombre || proceso.id_abogado_resp,
          valor_nuevo: nuevo.nombre,
          accion: 'CAMBIO_RESPONSABLE',
          realizado_por: req.user.id_usuario
        }
      });

      await tx.bitacoraAuditoria.create({
        data: {
          tenant_id: req.tenant_id,
          id_usuario: req.user.id_usuario,
          accion: 'CAMBIAR_RESPONSABLE_EXPEDIENTE',
          modulo: 'PROCESOS',
          detalle:
            `Expediente ${proceso.numero_radicado}: responsable cambiado de ` +
            `${proceso.abogado_resp?.nombre || 'desconocido'} a ${nuevo.nombre}. ` +
            `Justificación: ${justificacion}`,
          ip_adress: req.ip || '127.0.0.1'
        }
      });
    });

    res.json({
      message: `${nuevo.nombre} es ahora el abogado responsable del expediente.`,
      responsable: { id_usuario: nuevo.id_usuario, nombre: nuevo.nombre, rol: nuevo.rol }
    });
  } catch (error) {
    console.error('Error en cambiarResponsable:', error);
    res.status(500).json({ error: 'Error cambiando el abogado responsable' });
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

    // RN04, misma idea que para el responsable: sumar al equipo a alguien que
    // no puede entrar al sistema es sumar un nombre, no una persona.
    if (!user.activo) {
      return res.status(400).json({
        error: `${user.nombre} tiene la cuenta inactiva y no puede asignarse al expediente.`
      });
    }

    // El portal del cliente es una vista restringida sobre SUS expedientes
    // (RN02.3). Un cliente dentro del equipo de trabajo entraría por la puerta
    // del despacho, que es la que el portal existe para no abrir.
    if (user.rol === 'CLIENTE') {
      return res.status(400).json({
        error: 'Un cliente no puede formar parte del equipo de trabajo de un expediente.'
      });
    }

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

    // RN04. Quitar a un colaborador del equipo es seguro —el responsable vive
    // en otro campo—, pero quitar al RESPONSABLE deja un expediente cuyo
    // titular ya no figura en su propio equipo: la regla se cumpliría en la
    // columna y no en lo que cualquiera lee en la pantalla.
    //
    // No se le desasigna en silencio ni se le sustituye por nadie: se pide
    // primero el relevo, que es una decisión con nombre y justificación.
    if (proceso.id_abogado_resp === id_usuario) {
      return res.status(400).json({
        error:
          'No puede desasignar al abogado responsable del expediente. ' +
          'Nombre antes a otro responsable y vuelva a intentarlo.'
      });
    }

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

    // Disparar Webhook a n8n
    triggerWebhook('ACTUALIZACION_PROCESO', { 
      proceso: updatedProceso, 
      estado_anterior: proceso.estado,
      justificacion,
      usuario_modificador: req.user.nombre 
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
      // Eliminar actuaciones procesales. Va DESPUÉS de los términos: estos
      // apuntan a la actuación de la que nacen, y aunque esa clave foránea es
      // ON DELETE SET NULL, borrar primero los términos evita dejar filas
      // intermedias. La de actuaciones hacia el proceso sí es ON DELETE
      // RESTRICT, así que sin esta línea el borrado del expediente falla.
      await tx.actuacion.deleteMany({ where: { id_proceso: id } });
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

/**
 * Expedientes que reclaman atención, para el panel principal — RF17.3, RF40.3.
 *
 * Los dos avisos existían en la ficha del expediente pero no en el panel, que
 * es donde los requisitos los piden. La detección de inactividad, además, solo
 * la veía el Administrador a través de `/reportes/stats`: un abogado no tenía
 * forma de enterarse de que uno de sus expedientes llevaba un mes parado.
 *
 * Respeta la misma visibilidad que el listado (RF04) reutilizando su filtro,
 * para que el panel no pueda mostrar expedientes que el listado oculta.
 */
exports.getProcesosAtencion = async (req, res) => {
  try {
    const procesos = await prisma.proceso.findMany({
      where: {
        ...atencion.filtroDeVisibilidad(req.user, req.tenant_id),
        estado: 'ACTIVO',
      },
      select: {
        id_proceso: true,
        numero_radicado: true,
        update_at: true,
        cliente: { select: { nombre: true } },
        abogado_resp: { select: { nombre: true } },
        partes: { select: { tipo: true } },
        historial: { orderBy: { created_at: 'desc' }, take: 1, select: { created_at: true } },
        documentos: { orderBy: { created_at: 'desc' }, take: 1, select: { created_at: true } },
        actuaciones: { orderBy: { fecha_registro: 'desc' }, take: 1, select: { fecha_registro: true } },
      },
    });

    const dias = atencion.DIAS_INACTIVIDAD_POR_DEFECTO;
    const limite = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);

    const inactivos = [];
    const incompletos = [];

    for (const p of procesos) {
      const resumen = {
        id_proceso: p.id_proceso,
        numero_radicado: p.numero_radicado,
        cliente: p.cliente.nombre,
        abogado: p.abogado_resp.nombre,
      };

      const movimiento = atencion.ultimoMovimiento(p);
      if (movimiento < limite) {
        inactivos.push({ ...resumen, dias_inactivo: atencion.diasDesde(movimiento) });
      }

      const falta = atencion.faltanPartes(p);
      if (falta.length > 0) incompletos.push({ ...resumen, falta });
    }

    // Lo más abandonado primero: es el orden en que conviene atenderlos.
    inactivos.sort((a, b) => b.dias_inactivo - a.dias_inactivo);

    res.json({ dias_umbral: dias, inactivos, incompletos });
  } catch (error) {
    console.error('Error obteniendo los expedientes que requieren atención:', error);
    res.status(500).json({ error: 'Error al calcular los avisos del panel' });
  }
};
