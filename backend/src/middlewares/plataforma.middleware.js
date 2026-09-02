const { verifyToken } = require('../utils/jwt');
const prisma = require('../config/prisma');

/**
 * Marca que distingue un token de plataforma de uno de consultorio.
 *
 * Los dos se firman con el mismo secreto, así que sin esta marca un token de
 * consultorio pasaría por aquí y viceversa. Es la pieza que sostiene la
 * separación entre ambos mundos, y por eso se comprueba en los dos sentidos:
 * aquí se exige, y en `auth.middleware.js` se rechaza.
 */
const TIPO_PLATAFORMA = 'PLATAFORMA';

const plataformaMiddleware = async (req, res, next) => {
  try {
    const cabecera = req.headers.authorization;
    if (!cabecera || !cabecera.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const decodificado = verifyToken(cabecera.split(' ')[1]);

    if (!decodificado || decodificado.tipo !== TIPO_PLATAFORMA || !decodificado.id_admin) {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }

    const admin = await prisma.adminPlataforma.findUnique({
      where: { id_admin: decodificado.id_admin },
      select: { id_admin: true, nombre: true, email: true, activo: true },
    });

    if (!admin || !admin.activo) {
      return res.status(401).json({ error: 'Administrador no encontrado o inactivo' });
    }

    req.admin = admin;

    // A propósito NO se define `req.tenant_id` ni `req.user`. Un administrador
    // de plataforma no pertenece a ningún consultorio, y sin esos campos
    // cualquier controlador de consultorio que se invocara por error filtraría
    // por `undefined` y no devolvería nada, en lugar de devolverlo todo.
    next();
  } catch (error) {
    console.error('Error en el middleware de plataforma:', error);
    res.status(500).json({ error: 'Error de autenticación' });
  }
};

module.exports = { plataformaMiddleware, TIPO_PLATAFORMA };
