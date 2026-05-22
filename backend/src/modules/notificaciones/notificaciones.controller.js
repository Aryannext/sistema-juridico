const prisma = require('../../config/prisma');

// 1. Obtener notificaciones activas del usuario actual (leídas: false o gestionadas: false)
exports.getNotificacionesUsuario = async (req, res) => {
  try {
    const notificaciones = await prisma.notificacion.findMany({
      where: {
        tenant_id: req.tenant_id,
        id_usuario: req.user.id_usuario,
        leida: false
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    res.json(notificaciones);
  } catch (error) {
    console.error('Error en getNotificacionesUsuario:', error);
    res.status(500).json({ error: 'Error al obtener las notificaciones del usuario' });
  }
};

// 2. Gestionar / Cerrar / Marcar como leída una notificación (HU-30)
exports.gestionarNotificacion = async (req, res) => {
  try {
    const { id } = req.params;

    const notificacion = await prisma.notificacion.findFirst({
      where: {
        id_notificacion: id,
        tenant_id: req.tenant_id
      }
    });

    if (!notificacion) {
      return res.status(404).json({ error: 'Notificación no encontrada o no pertenece a su consultorio' });
    }

    // Regla de negocio HU-30: Cierre de alertas de prioridad alta (críticas)
    if (notificacion.prioridad === 'ALTA') {
      const esDestinatario = notificacion.id_usuario === req.user.id_usuario;
      const esAdmin = req.user.rol === 'ADMINISTRADOR';

      if (esDestinatario) {
        // El destinatario original puede cerrarla en cualquier momento
        const updated = await prisma.notificacion.update({
          where: { id_notificacion: id },
          data: {
            leida: true,
            gestionada: true
          }
        });
        return res.json({ message: 'Alerta crítica cerrada con éxito', notificacion: updated });
      } else if (esAdmin) {
        // Si el usuario es Admin, verificar si el destinatario está inactivo
        const destinatario = await prisma.usuario.findUnique({
          where: { id_usuario: notificacion.id_usuario },
          select: { activo: true }
        });

        if (destinatario && !destinatario.activo) {
          // Destinatario inactivo: Administrador puede cerrar la alerta
          const updated = await prisma.notificacion.update({
            where: { id_notificacion: id },
            data: {
              leida: true,
              gestionada: true
            }
          });
          return res.json({ message: 'Alerta crítica de usuario inactivo cerrada por Administrador', notificacion: updated });
        } else {
          // Destinatario activo: Denegar cierre por el administrador
          return res.status(403).json({
            error: 'No autorizado. Las alertas críticas de prioridad alta solo pueden ser cerradas por su destinatario. Un Administrador solo puede cerrarlas si el destinatario está inactivo.'
          });
        }
      } else {
        // Ni es destinatario ni es admin
        return res.status(403).json({ error: 'No autorizado para gestionar esta alerta crítica.' });
      }
    } else {
      // Prioridad MEDIA o BAJA: El destinatario original o cualquier administrador puede cerrarla
      const esDestinatario = notificacion.id_usuario === req.user.id_usuario;
      const esAdmin = req.user.rol === 'ADMINISTRADOR';

      if (esDestinatario || esAdmin) {
        const updated = await prisma.notificacion.update({
          where: { id_notificacion: id },
          data: {
            leida: true,
            gestionada: true
          }
        });
        return res.json({ message: 'Alerta gestionada con éxito', notificacion: updated });
      } else {
        return res.status(403).json({ error: 'No autorizado para gestionar esta notificación.' });
      }
    }
  } catch (error) {
    console.error('Error en gestionarNotificacion:', error);
    res.status(500).json({ error: 'Error al gestionar la notificación' });
  }
};
