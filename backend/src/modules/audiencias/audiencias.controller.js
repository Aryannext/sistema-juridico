const prisma = require('../../config/prisma');

// Función interna para archivar automáticamente audiencias del pasado (HU-20)
const autoArchivePastHearings = async (tenant_id) => {
  try {
    const pastHearings = await prisma.audiencia.findMany({
      where: {
        tenant_id,
        estado: 'PROGRAMADA',
        fecha_hora: { lt: new Date() }
      }
    });

    if (pastHearings.length === 0) return;

    await prisma.$transaction(async (tx) => {
      // 1. Marcar estado como REALIZADA
      await tx.audiencia.updateMany({
        where: {
          id_audiencia: { in: pastHearings.map(h => h.id_audiencia) }
        },
        data: { estado: 'REALIZADA' }
      });

      // 2. Crear registros históricos en el historial del expediente
      const historyLogs = pastHearings.map(h => ({
        tenant_id,
        id_proceso: h.id_proceso,
        campo_modificado: 'ESTADO_AUDIENCIA_AUTO_ARCHIVADO',
        valor_anterior: 'PROGRAMADA',
        valor_nuevo: 'REALIZADA',
        accion: 'AUTO_ARCHIVADO_AUDIENCIA',
        realizado_por: h.created_by
      }));

      await tx.historialProceso.createMany({
        data: historyLogs
      });
    });
  } catch (error) {
    console.error('Error en autoArchivePastHearings:', error);
  }
};

// 1. Programar una nueva audiencia judicial (HU-17, HU-18)
exports.createAudiencia = async (req, res) => {
  try {
    const { id_proceso, nombre, tipo, fecha_hora, lugar, recordatorios } = req.body;

    if (!id_proceso || !nombre || !tipo || !fecha_hora || !lugar) {
      return res.status(400).json({ error: 'Faltan campos obligatorios para programar la audiencia' });
    }

    // Verificar que el proceso pertenezca al tenant
    const proceso = await prisma.proceso.findFirst({
      where: { id_proceso, tenant_id: req.tenant_id }
    });

    if (!proceso) {
      return res.status(404).json({ error: 'Expediente no encontrado o no pertenece a su consultorio' });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Crear la audiencia
      const audiencia = await tx.audiencia.create({
        data: {
          tenant_id: req.tenant_id,
          id_proceso,
          nombre,
          tipo,
          fecha_hora: new Date(fecha_hora),
          lugar,
          estado: 'PROGRAMADA',
          created_by: req.user.id_usuario
        }
      });

      // Configurar recordatorios (máximo 3)
      // Sugeridos por defecto si no vienen: 48 horas (2880m) [EMAIL], 24 horas (1440m) [EMAIL], 0 horas (0m) [PLATAFORMA]
      let alerts = [
        { minutos_antes: 2880, canal: 'EMAIL' },
        { minutos_antes: 1440, canal: 'EMAIL' },
        { minutos_antes: 0, canal: 'PLATAFORMA' }
      ];

      if (recordatorios && Array.isArray(recordatorios)) {
        alerts = recordatorios.slice(0, 3).map(alertItem => {
          if (typeof alertItem === 'object') {
            return {
              minutos_antes: parseInt(alertItem.minutos_antes ?? 0),
              canal: alertItem.canal ?? 'EMAIL'
            };
          } else {
            return {
              minutos_antes: parseInt(alertItem),
              canal: 'EMAIL'
            };
          }
        });
      }

      const recordatoriosData = alerts.map(alert => ({
        id_audiencia: audiencia.id_audiencia,
        minutos_antes: alert.minutos_antes,
        canal: alert.canal,
        enviado: false
      }));

      if (recordatoriosData.length > 0) {
        await tx.recordatorioAudiencia.createMany({
          data: recordatoriosData
        });
      }

      return audiencia;
    });

    res.status(201).json({
      message: 'Audiencia programada y recordatorios configurados con éxito',
      audiencia: result
    });
  } catch (error) {
    console.error('Error en createAudiencia:', error);
    res.status(500).json({ error: 'Error interno del servidor al programar la audiencia' });
  }
};

// 2. Obtener audiencias de un proceso específico (HU-17, HU-20)
exports.getAudienciasProceso = async (req, res) => {
  try {
    const { id_proceso } = req.params;

    const proceso = await prisma.proceso.findFirst({
      where: { id_proceso, tenant_id: req.tenant_id }
    });

    if (!proceso) {
      return res.status(404).json({ error: 'Expediente no encontrado' });
    }

    // Auto-archivar audiencias pasadas del tenant antes de retornar
    await autoArchivePastHearings(req.tenant_id);

    const audiencias = await prisma.audiencia.findMany({
      where: { id_proceso, tenant_id: req.tenant_id },
      include: {
        creador: { select: { nombre: true, email: true } },
        recordatorios: true
      },
      orderBy: { fecha_hora: 'asc' }
    });

    res.json(audiencias);
  } catch (error) {
    console.error('Error en getAudienciasProceso:', error);
    res.status(500).json({ error: 'Error al obtener las audiencias del expediente' });
  }
};

// 3. Listar agenda general de audiencias (calendario/timeline del consultorio) (HU-17, HU-20)
exports.getAgendaTenant = async (req, res) => {
  try {
    // Auto-archivar audiencias pasadas del tenant antes de retornar
    await autoArchivePastHearings(req.tenant_id);

    let whereClause = { tenant_id: req.tenant_id };

    // Si es abogado o asistente (no administrador), solo ve audiencias de sus casos asignados o que él mismo creó
    if (req.user.rol !== 'ADMINISTRADOR') {
      whereClause = {
        tenant_id: req.tenant_id,
        OR: [
          { created_by: req.user.id_usuario },
          { proceso: { id_abogado_resp: req.user.id_usuario } },
          { proceso: { abogados: { some: { id_usuario: req.user.id_usuario } } } }
        ]
      };
    }

    const agenda = await prisma.audiencia.findMany({
      where: whereClause,
      include: {
        proceso: {
          select: {
            id_proceso: true,
            numero_radicado: true,
            tipo_proceso: true,
            cliente: { select: { nombre: true, razon_social: true } }
          }
        },
        creador: { select: { nombre: true } }
      },
      orderBy: { fecha_hora: 'asc' }
    });

    res.json(agenda);
  } catch (error) {
    console.error('Error en getAgendaTenant:', error);
    res.status(500).json({ error: 'Error al obtener la agenda de audiencias del consultorio' });
  }
};

// 4. Editar o reprogramar una audiencia judicial (HU-19)
exports.updateAudiencia = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, tipo, fecha_hora, lugar, estado, recordatorios } = req.body;

    const existingAudiencia = await prisma.audiencia.findFirst({
      where: { id_audiencia: id, tenant_id: req.tenant_id },
      include: {
        proceso: {
          select: {
            id_proceso: true,
            id_abogado_resp: true
          }
        }
      }
    });

    if (!existingAudiencia) {
      return res.status(404).json({ error: 'Audiencia no encontrada o no pertenece a su consultorio' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const isFechaHoraModified = fecha_hora && new Date(fecha_hora).getTime() !== new Date(existingAudiencia.fecha_hora).getTime();
      const isLugarModified = lugar && lugar !== existingAudiencia.lugar;

      // Si se reprograma (modificación de fecha u hora o lugar)
      if (isFechaHoraModified || isLugarModified) {
        const oldFechaStr = new Date(existingAudiencia.fecha_hora).toLocaleString();
        const newFechaStr = fecha_hora ? new Date(fecha_hora).toLocaleString() : oldFechaStr;
        const oldLugarStr = existingAudiencia.lugar;
        const newLugarStr = lugar || oldLugarStr;

        // 1. Guardar historial inmutable del cambio
        await tx.historialProceso.create({
          data: {
            tenant_id: req.tenant_id,
            id_proceso: existingAudiencia.id_proceso,
            campo_modificado: 'AUDIENCIA_REPROGRAMADA',
            valor_anterior: `Fecha/Hora: ${oldFechaStr} | Lugar: ${oldLugarStr}`,
            valor_nuevo: `Fecha/Hora: ${newFechaStr} | Lugar: ${newLugarStr}`,
            accion: 'REPROGRAMAR_AUDIENCIA',
            realizado_por: req.user.id_usuario
          }
        });

        // 2. Notificar al Abogado Responsable y Colaboradores Asignados
        const coDefensors = await tx.procesoAbogado.findMany({
          where: { id_proceso: existingAudiencia.id_proceso }
        });

        const userIdsToNotify = new Set([
          existingAudiencia.proceso.id_abogado_resp,
          ...coDefensors.map(cd => cd.id_usuario)
        ]);

        // Evitar auto-notificación
        userIdsToNotify.delete(req.user.id_usuario);

        const notifsData = Array.from(userIdsToNotify).map(userId => ({
          tenant_id: req.tenant_id,
          id_usuario: userId,
          titulo: 'Audiencia Reprogramada',
          mensaje: `La audiencia "${existingAudiencia.nombre}" del radicado ha sido reprogramada para el ${newFechaStr} en ${newLugarStr}.`,
          prioridad: 'ALTA',
          leida: false,
          gestionada: false,
          referencia_tipo: 'AUDIENCIA',
          id_referencia: existingAudiencia.id_audiencia
        }));

        if (notifsData.length > 0) {
          await tx.notificacion.createMany({
            data: notifsData
          });
        }
      }

      const updatedAudiencia = await tx.audiencia.update({
        where: { id_audiencia: id },
        data: {
          ...(nombre && { nombre }),
          ...(tipo && { tipo }),
          ...(fecha_hora && { fecha_hora: new Date(fecha_hora) }),
          ...(lugar && { lugar }),
          ...(estado && { estado })
        }
      });

      // Si la fecha/hora fue modificada, restablecer o insertar nuevos recordatorios
      if (isFechaHoraModified) {
        if (recordatorios && Array.isArray(recordatorios)) {
          // Si el cliente envía nuevos recordatorios estructurados, los reemplazamos
          await tx.recordatorioAudiencia.deleteMany({
            where: { id_audiencia: id }
          });

          const recordatoriosData = recordatorios.slice(0, 3).map(alert => ({
            id_audiencia: id,
            minutos_antes: typeof alert === 'object' ? parseInt(alert.minutos_antes ?? 0) : parseInt(alert),
            canal: typeof alert === 'object' ? (alert.canal ?? 'EMAIL') : 'EMAIL',
            enviado: false
          }));

          if (recordatoriosData.length > 0) {
            await tx.recordatorioAudiencia.createMany({
              data: recordatoriosData
            });
          }
        } else {
          // De lo contrario, simplemente reseteamos los recordatorios existentes para que el cron job los recalcule
          await tx.recordatorioAudiencia.updateMany({
            where: { id_audiencia: id },
            data: { enviado: false, fecha_envio: null }
          });
        }
      }

      return updatedAudiencia;
    });

    res.json({
      message: 'Audiencia actualizada con éxito',
      audiencia: result
    });
  } catch (error) {
    console.error('Error en updateAudiencia:', error);
    res.status(500).json({ error: 'Error al actualizar o reprogramar la audiencia' });
  }
};
