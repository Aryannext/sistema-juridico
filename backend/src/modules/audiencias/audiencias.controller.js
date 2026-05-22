const prisma = require('../../config/prisma');

// 1. Programar una nueva audiencia judicial
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

      // Crear recordatorios asociados
      // Por defecto, si no se especifican, creamos alertas de 120 minutos (2 horas) y 1440 minutos (24 horas) antes
      const alerts = recordatorios && Array.isArray(recordatorios) ? recordatorios : [120, 1440];
      
      const recordatoriosData = alerts.map(minutos => ({
        id_audiencia: audiencia.id_audiencia,
        minutos_antes: parseInt(minutos),
        canal: 'EMAIL', // Email por defecto
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

// 2. Obtener audiencias de un proceso específico
exports.getAudienciasProceso = async (req, res) => {
  try {
    const { id_proceso } = req.params;

    const proceso = await prisma.proceso.findFirst({
      where: { id_proceso, tenant_id: req.tenant_id }
    });

    if (!proceso) {
      return res.status(404).json({ error: 'Expediente no encontrado' });
    }

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

// 3. Listar agenda general de audiencias (calendario/timeline del consultorio)
exports.getAgendaTenant = async (req, res) => {
  try {
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

// 4. Editar o reprogramar una audiencia judicial
exports.updateAudiencia = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, tipo, fecha_hora, lugar, estado } = req.body;

    const existingAudiencia = await prisma.audiencia.findFirst({
      where: { id_audiencia: id, tenant_id: req.tenant_id }
    });

    if (!existingAudiencia) {
      return res.status(404).json({ error: 'Audiencia no encontrada o no pertenece a su consultorio' });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Si la fecha/hora es modificada, restablecemos los recordatorios para que se vuelvan a disparar
      const isFechaHoraModified = fecha_hora && new Date(fecha_hora).getTime() !== new Date(existingAudiencia.fecha_hora).getTime();

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

      if (isFechaHoraModified) {
        // Restablecer los recordatorios asociados a "no enviado" para que el cron job los recalcule
        await tx.recordatorioAudiencia.updateMany({
          where: { id_audiencia: id },
          data: { enviado: false, fecha_envio: null }
        });
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
