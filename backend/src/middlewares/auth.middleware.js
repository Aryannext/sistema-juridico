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

    // Un token de plataforma no sirve para entrar a un consultorio. Ambos se
    // firman con el mismo secreto, así que sin esta comprobación bastaría con
    // que un token de plataforma trajera un `id_usuario` para colarse aquí.
    // La comprobación simétrica está en plataforma.middleware.js.
    //
    // Va ANTES de mirar `id_usuario`: si fuera después, un token de plataforma
    // caería en el 401 genérico y quien lo usara no sabría por qué, cuando la
    // causa real es que se ha equivocado de sesión.
    if (decoded && decoded.tipo === 'PLATAFORMA') {
      return res.status(403).json({
        error: 'Esta sesión es de administración de la plataforma y no da acceso a los expedientes de ningún consultorio.'
      });
    }

    if (!decoded || !decoded.id_usuario) {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }

    const user = await prisma.usuario.findUnique({
      where: { id_usuario: decoded.id_usuario },
      include: { tenant: { select: { activo: true } } }
    });

    if (!user || !user.activo) {
      return res.status(401).json({ error: 'Usuario no encontrado o inactivo' });
    }

    // Suspensión del consultorio entero, independiente de la de cada usuario.
    // Es la palanca para cortar el acceso de una oficina completa —por impago
    // de la suscripción, por ejemplo— con un solo cambio, en vez de desactivar
    // a sus usuarios uno por uno. Antes este campo no se comprobaba en ningún
    // sitio: marcar un consultorio como inactivo no tenía ningún efecto.
    if (!user.tenant.activo) {
      return res.status(403).json({
        error: 'El acceso de su consultorio está suspendido. Contacte al administrador de la plataforma.',
        consultorioSuspendido: true
      });
    }

    // El objeto `tenant` solo se incluyó para esta comprobación; no debe
    // filtrarse al resto de la aplicación como si fuera parte del usuario.
    delete user.tenant;

    req.user = user;
    req.tenant_id = user.tenant_id;
    next();
  } catch (error) {
    console.error('Error en el middleware de autenticación:', error);
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
