const prisma = require('../config/prisma');

const auditMiddleware = (modulo) => {
  return async (req, res, next) => {
    // We want to capture the action after the response finishes, or right before.
    // However, it's safer to just log the attempt or hook into res.on('finish')
    
    res.on('finish', async () => {
      // Only log successful mutating actions
      if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method) && res.statusCode >= 200 && res.statusCode < 300) {
        
        let accion = req.method;
        if (req.method === 'POST') accion = 'CREAR';
        if (req.method === 'PUT' || req.method === 'PATCH') accion = 'EDITAR';
        if (req.method === 'DELETE') accion = 'ELIMINAR';

        try {
          if (req.user && req.tenant_id) {
            await prisma.bitacoraAuditoria.create({
              data: {
                tenant_id: req.tenant_id,
                id_usuario: req.user.id_usuario,
                accion: accion,
                modulo: modulo,
                detalle: `Acción ${accion} realizada en ${req.originalUrl}`,
                ip_adress: req.ip || '127.0.0.1'
              }
            });
          }
        } catch (error) {
          console.error('Error al registrar en bitácora de auditoría:', error);
        }
      }
    });

    next();
  };
};

module.exports = auditMiddleware;
