const prisma = require('../../config/prisma');

// 1. Obtener notificaciones activas del usuario actual (leídas: false o gestionadas: false, respetando horas_ocultar_notificaciones)
exports.getNotificacionesUsuario = async (req, res) => {
  try {
    // Get horas_ocultar_notificaciones from Tenant
    const tenant = await prisma.tenant.findUnique({
      where: { id_tenant: req.tenant_id },
      select: { horas_ocultar_notificaciones: true }
    });

    const horas = tenant ? tenant.horas_ocultar_notificaciones : 48;
    const limitDate = new Date(Date.now() - horas * 60 * 60 * 1000);

    const notificaciones = await prisma.notificacion.findMany({
      where: {
        tenant_id: req.tenant_id,
        id_usuario: req.user.id_usuario,
        OR: [
          { leida: false },
          {
            leida: true,
            updated_at: { gte: limitDate }
          }
        ]
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    // 2. Apply Dynamic Grouping Algorithm
    const groups = {};
    notificaciones.forEach(notif => {
      if (notif.referencia_tipo && notif.id_referencia) {
        const key = `${notif.referencia_tipo}_${notif.id_referencia}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(notif);
      }
    });

    const finalNotifications = [];
    const processedIds = new Set();

    for (const key in groups) {
      const list = groups[key];
      // Sort list ascending by created_at to detect windows
      list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

      let i = 0;
      while (i < list.length) {
        let j = i;
        const startTime = new Date(list[i].created_at).getTime();
        const tenMins = 10 * 60 * 1000;

        while (j < list.length && (new Date(list[j].created_at).getTime() - startTime) <= tenMins) {
          j++;
        }

        const countInWindow = j - i;
        if (countInWindow > 5) {
          const cluster = list.slice(i, j);
          cluster.forEach(n => processedIds.add(n.id_notificacion));

          const representative = cluster[cluster.length - 1]; // Latest one
          const virtualNotif = {
            id_notificacion: `grouped_${representative.id_notificacion}`,
            tenant_id: representative.tenant_id,
            id_usuario: representative.id_usuario,
            titulo: `Múltiples alertas (${countInWindow}) para ${representative.referencia_tipo}`,
            mensaje: `Se han generado ${countInWindow} alertas sobre la referencia de tipo ${representative.referencia_tipo} en un lapso de 10 minutos. Último mensaje: "${representative.mensaje}"`,
            prioridad: 'MEDIA',
            leida: cluster.every(c => c.leida),
            gestionada: cluster.every(c => c.gestionada),
            referencia_tipo: representative.referencia_tipo,
            id_referencia: representative.id_referencia,
            created_at: representative.created_at,
            updated_at: representative.updated_at,
            isGrouped: true,
            groupedIds: cluster.map(c => c.id_notificacion)
          };
          finalNotifications.push(virtualNotif);
          i = j;
        } else {
          i++;
        }
      }
    }

    notificaciones.forEach(notif => {
      if (!processedIds.has(notif.id_notificacion)) {
        finalNotifications.push(notif);
      }
    });

    finalNotifications.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json(finalNotifications);
  } catch (error) {
    console.error('Error en getNotificacionesUsuario:', error);
    res.status(500).json({ error: 'Error al obtener las notificaciones del usuario' });
  }
};

// 2. Gestionar / Cerrar / Marcar como leída una notificación (HU-30)
exports.gestionarNotificacion = async (req, res) => {
  try {
    const { id } = req.params;
    let idsToUpdate = [id];

    if (id.startsWith('grouped_')) {
      if (req.body.groupedIds && Array.isArray(req.body.groupedIds)) {
        idsToUpdate = req.body.groupedIds;
      } else {
        idsToUpdate = [id.replace('grouped_', '')];
      }
    }

    const updatedNotifs = [];
    for (const singleId of idsToUpdate) {
      const notificacion = await prisma.notificacion.findFirst({
        where: {
          id_notificacion: singleId,
          tenant_id: req.tenant_id
        }
      });

      if (!notificacion) continue;

      // Regla de negocio HU-30: Cierre de alertas de prioridad alta (críticas)
      if (notificacion.prioridad === 'ALTA') {
        const esDestinatario = notificacion.id_usuario === req.user.id_usuario;
        const esAdmin = req.user.rol === 'ADMINISTRADOR';

        if (esDestinatario) {
          const updated = await prisma.notificacion.update({
            where: { id_notificacion: singleId },
            data: {
              leida: true,
              gestionada: true
            }
          });
          updatedNotifs.push(updated);
        } else if (esAdmin) {
          const destinatario = await prisma.usuario.findUnique({
            where: { id_usuario: notificacion.id_usuario },
            select: { activo: true }
          });

          if (destinatario && !destinatario.activo) {
            const updated = await prisma.notificacion.update({
              where: { id_notificacion: singleId },
              data: {
                leida: true,
                gestionada: true
              }
            });
            updatedNotifs.push(updated);
          } else {
            return res.status(403).json({
              error: 'No autorizado. Las alertas críticas de prioridad alta solo pueden ser cerradas por su destinatario. Un Administrador solo puede cerrarlas si el destinatario está inactivo.'
            });
          }
        } else {
          return res.status(403).json({ error: 'No autorizado para gestionar esta alerta crítica.' });
        }
      } else {
        const esDestinatario = notificacion.id_usuario === req.user.id_usuario;
        const esAdmin = req.user.rol === 'ADMINISTRADOR';

        if (esDestinatario || esAdmin) {
          const updated = await prisma.notificacion.update({
            where: { id_notificacion: singleId },
            data: {
              leida: true,
              gestionada: true
            }
          });
          updatedNotifs.push(updated);
        } else {
          return res.status(403).json({ error: 'No autorizado para gestionar esta notificación.' });
        }
      }
    }

    res.json({ message: 'Alerta(s) gestionada(s) con éxito', actualizadas: updatedNotifs.length });
  } catch (error) {
    console.error('Error en gestionarNotificacion:', error);
    res.status(500).json({ error: 'Error al gestionar la notificación' });
  }
};
