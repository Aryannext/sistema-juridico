const prisma = require('../config/prisma');

const requirePermission = (modulo, accion) => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({ error: 'No autenticado' });
      }

      // Administradores tienen acceso total por defecto
      if (user.rol === 'ADMINISTRADOR') {
        return next();
      }

      // Clientes pueden leer documentos y expedientes (el controlador valida propiedad)
      if (user.rol === 'CLIENTE') {
        if ((modulo === 'DOCS' || modulo === 'PROCESOS' || modulo === 'PORTAL') && accion === 'LEER') {
          return next();
        }
      }

      const permiso = await prisma.permisoRol.findFirst({
        where: {
          id_usuario: user.id_usuario,
          modulo: modulo
        }
      });

      if (!permiso) {
        return res.status(403).json({ error: 'No tienes permisos para este módulo' });
      }

      let tienePermiso = false;
      switch (accion) {
        case 'LEER':
          tienePermiso = permiso.puede_leer;
          break;
        case 'CREAR':
          tienePermiso = permiso.puede_crear;
          break;
        case 'EDITAR':
          tienePermiso = permiso.puede_editar;
          break;
        case 'ELIMINAR':
          tienePermiso = permiso.puede_eliminar;
          break;
      }

      if (!tienePermiso) {
        return res.status(403).json({ error: `No tienes permisos para ${accion} en el módulo ${modulo}` });
      }

      next();
    } catch (error) {
      res.status(500).json({ error: 'Error verificando permisos' });
    }
  };
};

module.exports = requirePermission;
