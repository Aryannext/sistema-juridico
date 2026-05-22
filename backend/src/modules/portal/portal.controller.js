const prisma = require('../../config/prisma');

exports.getPortalDashboard = async (req, res) => {
  try {
    if (!req.user || req.user.rol !== 'CLIENTE') {
      return res.status(403).json({ error: 'Acceso exclusivo para clientes' });
    }

    const cliente = await prisma.cliente.findFirst({
      where: { email: req.user.email, tenant_id: req.tenant_id }
    });

    if (!cliente) {
      return res.status(404).json({ error: 'Perfil de cliente no asociado' });
    }

    const procesos = await prisma.proceso.findMany({
      where: { id_cliente: cliente.id_cliente, tenant_id: req.tenant_id },
      orderBy: { create_at: 'desc' }
    });

    const idsProcesos = procesos.map(p => p.id_proceso);

    // Get upcoming hearings
    const audiencias = await prisma.audiencia.findMany({
      where: {
        id_proceso: { in: idsProcesos },
        tenant_id: req.tenant_id,
        fecha_hora: { gte: new Date() }
      },
      orderBy: { fecha_hora: 'asc' },
      include: {
        proceso: {
          select: {
            numero_radicado: true,
            tipo_proceso: true
          }
        }
      }
    });

    // Get latest 10 historical process actions as novedades
    const novedades = await prisma.historialProceso.findMany({
      where: {
        id_proceso: { in: idsProcesos },
        tenant_id: req.tenant_id
      },
      orderBy: { created_at: 'desc' },
      take: 10,
      include: {
        proceso: {
          select: {
            id_proceso: true,
            numero_radicado: true
          }
        },
        usuario: {
          select: {
            nombre: true
          }
        }
      }
    });

    res.json({
      cliente,
      procesos,
      audiencias,
      novedades
    });

  } catch (error) {
    console.error('Error en getPortalDashboard:', error);
    res.status(500).json({ error: 'Error al cargar el panel de control del cliente' });
  }
};

exports.getPortalProcesoDetalle = async (req, res) => {
  try {
    if (!req.user || req.user.rol !== 'CLIENTE') {
      return res.status(403).json({ error: 'Acceso exclusivo para clientes' });
    }

    const { id } = req.params;

    const cliente = await prisma.cliente.findFirst({
      where: { email: req.user.email, tenant_id: req.tenant_id }
    });

    if (!cliente) {
      return res.status(404).json({ error: 'Perfil de cliente no asociado' });
    }

    const proceso = await prisma.proceso.findFirst({
      where: {
        id_proceso: id,
        id_cliente: cliente.id_cliente,
        tenant_id: req.tenant_id
      },
      include: {
        abogado_resp: {
          select: {
            nombre: true,
            email: true
          }
        }
      }
    });

    if (!proceso) {
      return res.status(404).json({ error: 'Expediente no encontrado o no asignado a este cliente' });
    }

    // Get shared documents only
    const documentos = await prisma.documento.findMany({
      where: {
        id_proceso: id,
        tenant_id: req.tenant_id,
        visibilidad: 'COMPARTIDO_CLIENTE',
        estado: 'ACTIVO'
      },
      include: {
        version_actual: {
          select: {
            id_version: true,
            numero_version: true,
            nombre_archivo: true,
            tamano_bytes: true,
            formato: true
          }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    // Get all hearings for this case
    const audiencias = await prisma.audiencia.findMany({
      where: {
        id_proceso: id,
        tenant_id: req.tenant_id
      },
      orderBy: { fecha_hora: 'desc' }
    });

    // Get all public history of this case
    const historial = await prisma.historialProceso.findMany({
      where: {
        id_proceso: id,
        tenant_id: req.tenant_id
      },
      orderBy: { created_at: 'desc' },
      include: {
        usuario: {
          select: {
            nombre: true
          }
        }
      }
    });

    res.json({
      proceso,
      documentos,
      audiencias,
      historial
    });

  } catch (error) {
    console.error('Error en getPortalProcesoDetalle:', error);
    res.status(500).json({ error: 'Error al obtener el detalle del expediente' });
  }
};
