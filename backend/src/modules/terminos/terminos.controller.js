const prisma = require('../../config/prisma');

// 1. Crear un nuevo vencimiento de término judicial
exports.createTermino = async (req, res) => {
  try {
    const { id_proceso, nombre, fecha_vencimiento, es_critico } = req.body;

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

      // Crear alertas automáticas en RecordatorioTermino
      const alertDates = [];
      const vDate = new Date(fecha_vencimiento);

      // Alerta 1: Momento del vencimiento
      alertDates.push(vDate);

      // Alerta 2: 24 horas antes del vencimiento (solo si es crítico)
      if (es_critico) {
        const preDate = new Date(vDate.getTime() - 24 * 60 * 60 * 1000);
        // Solo agregar si la fecha 24h antes es posterior al momento actual
        if (preDate > new Date()) {
          alertDates.push(preDate);
        }
      }

      const recordatoriosData = alertDates.map(date => ({
        id_termino: termino.id_termino,
        fecha_hora_envio: date,
        canal: 'EMAIL',
        enviado: false
      }));

      if (recordatoriosData.length > 0) {
        await tx.recordatorioTermino.createMany({
          data: recordatoriosData
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

// 4. Gestionar/Completar un término judicial con justificación obligatoria
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

    const result = await prisma.$transaction(async (tx) => {
      // 1. Actualizar el término
      const updatedTermino = await tx.terminoJudicial.update({
        where: { id_termino: id },
        data: {
          estado,
          justificacion,
          gestionado_por: req.user.id_usuario,
          fecha_gestion: new Date()
        }
      });

      // 2. Silenciar recordatorios pendientes puesto que ya se resolvió/gestionó el término
      await tx.recordatorioTermino.updateMany({
        where: { id_termino: id, enviado: false },
        data: { enviado: true, fecha_envio_real: new Date() } // Se marcan como completados para no enviar spam
      });

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
