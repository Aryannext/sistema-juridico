const prisma = require('../../config/prisma');
const { hashPassword } = require('../../utils/bcrypt');

// Crear un nuevo colaborador (Abogado o Asistente)
exports.createUsuario = async (req, res) => {
  try {
    const { nombre, email, password, rol } = req.body;
    const { tenant_id } = req;

    if (!nombre || !email || !password || !rol) {
      return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }

    if (!['ABOGADO', 'ASISTENTE'].includes(rol)) {
      return res.status(400).json({ error: 'Rol inválido' });
    }

    const existingUser = await prisma.usuario.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'El correo electrónico ya está en uso' });
    }

    const hashedPassword = await hashPassword(password);

    const newUser = await prisma.usuario.create({
      data: {
        tenant_id,
        nombre,
        email,
        password_hash: hashedPassword,
        rol,
        activo: true
      }
    });

    await prisma.bitacoraAuditoria.create({
      data: {
        tenant_id,
        id_usuario: req.user.id_usuario,
        accion: 'CREAR_COLABORADOR',
        modulo: 'CONFIGURACION',
        detalle: `Colaborador creado: ${nombre} (${email}) con rol ${rol}`,
        ip_adress: req.ip || '127.0.0.1'
      }
    });

    res.status(201).json({
      message: 'Colaborador creado exitosamente',
      user: {
        id_usuario: newUser.id_usuario,
        nombre: newUser.nombre,
        email: newUser.email,
        rol: newUser.rol,
        activo: newUser.activo,
        create_at: newUser.create_at
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear el colaborador' });
  }
};

// Obtener bitácora de auditoría para el tenant
exports.getAuditoria = async (req, res) => {
  try {
    const { tenant_id } = req;
    
    // Obtener los logs de auditoría ordenados por fecha de creación desc
    const logs = await prisma.bitacoraAuditoria.findMany({
      where: { tenant_id },
      include: {
        usuario: {
          select: {
            nombre: true,
            email: true,
            rol: true
          }
        }
      },
      orderBy: {
        create_at: 'desc'
      }
    });
    
    res.json(logs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener la bitácora de auditoría' });
  }
};

// Obtener usuarios del tenant
exports.getUsuarios = async (req, res) => {
  try {
    const { tenant_id } = req;
    
    const usuarios = await prisma.usuario.findMany({
      where: { 
        tenant_id,
        rol: { not: 'CLIENTE' }
      },
      select: {
        id_usuario: true,
        nombre: true,
        email: true,
        rol: true,
        activo: true,
        dos_factores: true,
        create_at: true
      },
      orderBy: {
        create_at: 'desc'
      }
    });
    
    res.json(usuarios);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener los usuarios' });
  }
};

// Obtener permisos de un usuario específico
exports.getPermisos = async (req, res) => {
  try {
    const { tenant_id } = req;
    const { id_usuario } = req.params;
    
    // Validar que el usuario pertenezca al mismo tenant
    const targetUser = await prisma.usuario.findFirst({
      where: { id_usuario, tenant_id }
    });
    
    if (!targetUser) {
      return res.status(404).json({ error: 'Usuario no encontrado en este consultorio' });
    }
    
    const permisos = await prisma.permisoRol.findMany({
      where: { id_usuario }
    });
    
    res.json(permisos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener los permisos del usuario' });
  }
};

// Crear o actualizar permisos de un usuario
exports.updatePermisos = async (req, res) => {
  try {
    const { tenant_id } = req;
    const { id_usuario } = req.params;
    const { permisos } = req.body; // Array de permisos [{ modulo, puede_leer, puede_crear, puede_editar, puede_eliminar }]
    
    // Validar que el usuario pertenezca al mismo tenant
    const targetUser = await prisma.usuario.findFirst({
      where: { id_usuario, tenant_id }
    });
    
    if (!targetUser) {
      return res.status(404).json({ error: 'Usuario no encontrado en este consultorio' });
    }
    
    // Procesar cada permiso
    const upsertPromises = permisos.map(permiso => {
      // Buscamos si ya tiene un permiso para este módulo
      return prisma.permisoRol.findFirst({
        where: { id_usuario, modulo: permiso.modulo }
      }).then(existingPermiso => {
        if (existingPermiso) {
          // Actualizamos
          return prisma.permisoRol.update({
            where: { id_permiso: existingPermiso.id_permiso },
            data: {
              puede_leer: permiso.puede_leer ?? existingPermiso.puede_leer,
              puede_crear: permiso.puede_crear ?? existingPermiso.puede_crear,
              puede_editar: permiso.puede_editar ?? existingPermiso.puede_editar,
              puede_eliminar: permiso.puede_eliminar ?? existingPermiso.puede_eliminar
            }
          });
        } else {
          // Creamos uno nuevo
          return prisma.permisoRol.create({
            data: {
              id_usuario,
              modulo: permiso.modulo,
              puede_leer: permiso.puede_leer ?? false,
              puede_crear: permiso.puede_crear ?? false,
              puede_editar: permiso.puede_editar ?? false,
              puede_eliminar: permiso.puede_eliminar ?? false
            }
          });
        }
      });
    });
    
    await Promise.all(upsertPromises);
    
    // Registrar en bitácora de auditoría
    await prisma.bitacoraAuditoria.create({
      data: {
        tenant_id,
        id_usuario: req.user.id_usuario,
        accion: 'ACTUALIZAR_PERMISOS',
        modulo: 'CONFIGURACION',
        detalle: `Permisos del usuario ${targetUser.nombre} actualizados`,
        ip_adress: req.ip || '127.0.0.1'
      }
    });
    
    res.json({ message: 'Permisos actualizados exitosamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar los permisos del usuario' });
  }
};
