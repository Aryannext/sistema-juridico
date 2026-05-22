const prisma = require('../../config/prisma');

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

    res.status(201).json({ message: 'Expediente creado exitosamente', proceso });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error creando el expediente' });
  }
};

exports.getProcesos = async (req, res) => {
  try {
    let whereClause = { tenant_id: req.tenant_id };

    // Si no es admin, solo ve los procesos donde es abogado responsable (o deberíamos chequear proceso_abogados)
    if (req.user.rol !== 'ADMINISTRADOR') {
      whereClause.id_abogado_resp = req.user.id_usuario;
    }

    const procesos = await prisma.proceso.findMany({
      where: whereClause,
      include: {
        cliente: { select: { nombre: true, razon_social: true } },
        abogado_resp: { select: { nombre: true } }
      },
      orderBy: { create_at: 'desc' }
    });

    res.json(procesos);
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo expedientes' });
  }
};

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
    res.status(500).json({ error: 'Error obteniendo expediente' });
  }
};

exports.updateProceso = async (req, res) => {
  try {
    const { id } = req.params;
    const { juzgado, clase_proceso, area_derecho, fecha_radicado } = req.body;

    const procesoOld = await prisma.proceso.findUnique({ where: { id_proceso: id } });

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
        accion: 'ACTUALIZACION_GENERAL',
        realizado_por: req.user.id_usuario
      }
    });

    res.json({ message: 'Expediente actualizado', proceso });
  } catch (error) {
    res.status(500).json({ error: 'Error actualizando expediente' });
  }
};
