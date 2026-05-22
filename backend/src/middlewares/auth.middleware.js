const { verifyToken } = require('../utils/jwt');
const prisma = require('../config/prisma');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No autorizado. Token no provisto.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    if (!decoded || !decoded.id_usuario) {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }

    const user = await prisma.usuario.findUnique({
      where: { id_usuario: decoded.id_usuario }
    });

    if (!user || !user.activo) {
      return res.status(401).json({ error: 'Usuario no encontrado o inactivo' });
    }

    req.user = user;
    req.tenant_id = user.tenant_id;
    next();
  } catch (error) {
    res.status(500).json({ error: 'Error de autenticación' });
  }
};

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.rol)) {
      return res.status(403).json({ error: 'No tienes permisos para realizar esta acción' });
    }
    next();
  };
};

module.exports = { authMiddleware, requireRole };
