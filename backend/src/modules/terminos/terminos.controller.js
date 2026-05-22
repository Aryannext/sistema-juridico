const prisma = require('../../config/prisma');

// 1. Crear un nuevo vencimiento de término judicial (HU-21, HU-22)
exports.createTermino = async (req, res) => {
  try {
    const { id_proceso, nombre, fecha_vencimiento, es_critico, recordatorios } = req.body;

    if (!id_proceso || !nombre || !fecha_vencimiento) {
      return res.status(400).json({ error: 'Faltan campos requeridos para crear el término judicial' });
    }

    // Verificar que el proceso pertenezca al tenant
    const proceso = await prisma.proceso.findFirst({
      where: { id_proceso, tenant_id: req.tenant_id }
    });

    if (!proceso) {
      return res.status(404).json({ error: 'Expediente no encontrado o no pertenece a su consultorio' });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Crear el término
      const termino = await tx.terminoJudicial.create({
        data: {
          tenant_id: req.tenant_id,
          id_proceso,
          nombre,
          fecha_vencimiento: new Date(fecha_vencimiento),
          es_critico: es_critico || false,
          estado: 'PENDIENTE',
          created_by: req.user.id_usuario
        }
      });

      // Configurar recordatorios (máximo 3) - HU-22
      let recordatoriosData = [];
      const now = new Date();

      if (recordatorios && Array.isArray(recordatorios) && recordatorios.length > 0) {
        recordatoriosData = recordatorios.slice(0, 3).map(r => {
          let sendDate;
          let canal = 'EMAIL';
          if (typeof r === 'object') {
            sendDate = new Date(r.fecha_hora_envio);
            canal = r.canal || 'EMAIL';
          } else {
            sendDate = new Date(r);
          }
          return {
            id_termino: termino.id_termino,
            fecha_hora_envio: sendDate,
            canal,
            enviado: false
          };
        });
      } else {
        // Valores predeterminados sugeridos: 5 días antes, 1 día antes, y el día del vencimiento
        const vDate = new Date(fecha_vencimiento);
        const defaults = [
          { date: new Date(vDate.getTime() - 5 * 24 * 60 * 60 * 1000), canal: 'EMAIL' },
          { date: new Date(vDate.getTime() - 1 * 24 * 60 * 60 * 1000), canal: 'EMAIL' },
          { date: vDate, canal: 'EMAIL' }
        ];

        defaults.forEach(item => {
          if (item.date > now) {
            recordatoriosData.push({
              id_termino: termino.id_termino,
              fecha_hora_envio: item.date,
              canal: item.canal,
              enviado: false
            });
          }
        });
      }

      if (recordatoriosData.length > 0) {
        await tx.recordatorioTermino.createMany({
          data: recordatoriosData
        });
      }

      // Crear notificaciones correspondientes (HU-21, HU-22)
      const destinatariosIds = new Set();
      
      // Abogado responsable
      if (proceso.id_abogado_resp) {
        destinatariosIds.add(proceso.id_abogado_resp);
      }

      // Colaboradores asignados al proceso
      const procesoAbogados = await tx.procesoAbogado.findMany({
        where: { id_proceso },
        select: { id_usuario: true }
      });
      procesoAbogados.forEach(pa => {
        destinatariosIds.add(pa.id_usuario);
      });

      // Administradores del tenant (si es crítico)
      if (es_critico || es_critico === 'true') {
        const admins = await tx.usuario.findMany({
          where: { tenant_id: req.tenant_id, rol: 'ADMINISTRADOR', activo: true },
          select: { id_usuario: true }
        });
        admins.forEach(admin => {
          destinatariosIds.add(admin.id_usuario);
        });
      }

      // Filtrar usuarios activos
      const activeUsers = await tx.usuario.findMany({
        where: {
          id_usuario: { in: Array.from(destinatariosIds) },
          activo: true
        },
        select: { id_usuario: true }
      });

      const notificationsData = activeUsers.map(user => ({
        tenant_id: req.tenant_id,
        id_usuario: user.id_usuario,
        titulo: `${es_critico ? '🚨 TÉRMINO CRÍTICO:' : '⚖️ Nuevo Término:'} ${nombre}`,
        mensaje: `Se ha registrado el término judicial "${nombre}" en el expediente ${proceso.numero_radicado}. Vence el ${new Date(fecha_vencimiento).toLocaleString('es-CO')}.`,
        prioridad: es_critico ? 'ALTA' : 'MEDIA',
        leida: false,
        gestionada: false,
        referencia_tipo: 'TERMINO',
        id_referencia: termino.id_termino
      }));

      if (notificationsData.length > 0) {
        await tx.notificacion.createMany({
          data: notificationsData
        });
      }

      return termino;
    });

    res.status(201).json({
      message: 'Término judicial programado con éxito y alertas configuradas',
      termino: result
    });
  } catch (error) {
    console.error('Error en createTermino:', error);
    res.status(500).json({ error: 'Error interno del servidor al crear el término' });
  }
};

// 2. Obtener los términos asociados a un proceso
exports.getProcesoTerminos = async (req, res) => {
  try {
    const { id_proceso } = req.params;

    const proceso = await prisma.proceso.findFirst({
      where: { id_proceso, tenant_id: req.tenant_id }
    });

    if (!proceso) {
      return res.status(404).json({ error: 'Expediente no encontrado' });
    }

    const terminos = await prisma.terminoJudicial.findMany({
      where: { id_proceso, tenant_id: req.tenant_id },
      include: {
        usuario_creador: { select: { nombre: true } },
        usuario_gestion: { select: { nombre: true } }
      },
      orderBy: { fecha_vencimiento: 'asc' }
    });

    res.json(terminos);
  } catch (error) {
    console.error('Error en getProcesoTerminos:', error);
    res.status(500).json({ error: 'Error al obtener los términos del expediente' });
  }
};

// 3. Obtener alertas generales de vencimiento para el Dashboard del Tenant
exports.getAlertasVencimientos = async (req, res) => {
  try {
    let whereClause = {
      tenant_id: req.tenant_id,
      estado: 'PENDIENTE'
    };

    // Si no es admin, filtramos por los asignados al abogado
    if (req.user.rol !== 'ADMINISTRADOR') {
      whereClause = {
        tenant_id: req.tenant_id,
        estado: 'PENDIENTE',
        OR: [
          { created_by: req.user.id_usuario },
          { proceso: { id_abogado_resp: req.user.id_usuario } },
          { proceso: { abogados: { some: { id_usuario: req.user.id_usuario } } } }
        ]
      };
    }

    const vencimientos = await prisma.terminoJudicial.findMany({
      where: whereClause,
      include: {
        proceso: {
          select: {
            numero_radicado: true,
            tipo_proceso: true,
            cliente: { select: { nombre: true } }
          }
        }
      },
      orderBy: { fecha_vencimiento: 'asc' }
    });

    res.json(vencimientos);
  } catch (error) {
    console.error('Error en getAlertasVencimientos:', error);
    res.status(500).json({ error: 'Error al obtener alertas de vencimiento' });
  }
};

// 4. Gestionar/Completar un término judicial con justificación obligatoria (HU-23)
exports.gestionarTermino = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado, justificacion } = req.body;

    if (!estado || !justificacion || justificacion.trim() === '') {
      return res.status(400).json({ error: 'Debe proporcionar el estado de la gestión y una justificación detallada' });
    }

    // Validar estado válido
    const estadosValidos = ['CUMPLIDO', 'CUMPLIDO_TARDIO', 'INCUMPLIDO'];
    if (!estadosValidos.includes(estado)) {
      return res.status(400).json({ error: 'Estado de gestión inválido' });
    }

    const existingTermino = await prisma.terminoJudicial.findFirst({
      where: { id_termino: id, tenant_id: req.tenant_id }
    });

    if (!existingTermino) {
      return res.status(404).json({ error: 'Término judicial no encontrado o no pertenece a su consultorio' });
    }

    // HU-23: Si el término ya fue resuelto como tardío o incumplido, bloquear edición posterior a no-admins
    if (existingTermino.estado === 'CUMPLIDO_TARDIO' || existingTermino.estado === 'INCUMPLIDO') {
      if (req.user.rol !== 'ADMINISTRADOR') {
        return res.status(403).json({
          error: 'Acceso denegado. Solo el Administrador puede modificar la clasificación de un término resuelto tardíamente o incumplido.'
        });
      }
    }

    let finalEstado = estado;
    const now = new Date();
    const vencimiento = new Date(existingTermino.fecha_vencimiento);

    // Auto-clasificar como tardío si se gestiona tras la fecha de vencimiento y se marca como CUMPLIDO
    if (now > vencimiento && estado === 'CUMPLIDO') {
      finalEstado = 'CUMPLIDO_TARDIO';
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Actualizar el término
      const updatedTermino = await tx.terminoJudicial.update({
        where: { id_termino: id },
        data: {
          estado: finalEstado,
          justificacion,
          gestionado_por: req.user.id_usuario,
          fecha_gestion: now
        }
      });

      // 2. Silenciar recordatorios pendientes puesto que ya se resolvió/gestionó el término
      await tx.recordatorioTermino.updateMany({
        where: { id_termino: id, enviado: false },
        data: { enviado: true, fecha_envio_real: now }
      });

      // Si es una corrección/edición hecha por el Administrador sobre un estado tardío/incumplido existente, registramos auditoría explícita
      if (existingTermino.estado === 'CUMPLIDO_TARDIO' || existingTermino.estado === 'INCUMPLIDO') {
        await tx.bitacoraAuditoria.create({
          data: {
            tenant_id: req.tenant_id,
            id_usuario: req.user.id_usuario,
            accion: 'SOBREESCRITURA_TERMINO_TARDIO',
            modulo: 'TERMINO',
            detalle: `Administrador modificó término judicial "${existingTermino.nombre}" de estado ${existingTermino.estado} a ${finalEstado}. Justificación: ${justificacion}`,
            ip_adress: req.ip || '127.0.0.1'
          }
        });
      }

      return updatedTermino;
    });

    res.json({
      message: 'Término judicial gestionado y actualizado con éxito',
      termino: result
    });
  } catch (error) {
    console.error('Error en gestionarTermino:', error);
    res.status(500).json({ error: 'Error al gestionar el término judicial' });
  }
};
