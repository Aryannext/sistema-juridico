const prisma = require('../../config/prisma');

exports.createCliente = async (req, res) => {
  try {
    const { tipo, nombre, razon_social, tipo_documento, numero_documento, nit, representante, telefono, email, direccion, fecha_nacimiento } = req.body;

    const existingDoc = await prisma.cliente.findUnique({ where: { numero_documento } });
    if (existingDoc) {
      return res.status(400).json({ error: 'El número de documento ya está registrado' });
    }

    const cliente = await prisma.cliente.create({
      data: {
        tenant_id: req.tenant_id,
        id_usuario: req.user.id_usuario,
        tipo,
        nombre,
        razon_social,
        tipo_documento,
        numero_documento,
        nit,
        representante,
        telefono,
        email,
        direccion,
        fecha_nacimiento: fecha_nacimiento ? new Date(fecha_nacimiento) : null,
      }
    });

    res.status(201).json({ message: 'Cliente registrado exitosamente', cliente });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error registrando cliente' });
  }
};

exports.getClientes = async (req, res) => {
  try {
    const clientes = await prisma.cliente.findMany({
      where: { tenant_id: req.tenant_id },
      orderBy: { create_at: 'desc' }
    });
    res.json(clientes);
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo clientes' });
  }
};

exports.getClienteById = async (req, res) => {
  try {
    const { id } = req.params;
    const cliente = await prisma.cliente.findUnique({
      where: { id_cliente: id, tenant_id: req.tenant_id },
      include: {
        procesos: true // Incluye los procesos asociados (HU-06)
      }
    });

    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });

    // Verificar si el cliente ya tiene un usuario creado
    const userAccess = await prisma.usuario.findUnique({
      where: { email: cliente.email }
    });

    res.json({
      ...cliente,
      tiene_acceso_portal: !!userAccess
    });
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo cliente' });
  }
};

exports.updateCliente = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const cliente = await prisma.cliente.update({
      where: { id_cliente: id, tenant_id: req.tenant_id },
      data: updateData
    });

    res.json({ message: 'Cliente actualizado', cliente });
  } catch (error) {
    res.status(500).json({ error: 'Error actualizando cliente' });
  }
};

const { hashPassword } = require('../../utils/bcrypt');

exports.createPortalAccess = async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'La contraseña es requerida para habilitar el acceso al portal' });
    }

    const cliente = await prisma.cliente.findFirst({
      where: { id_cliente: id, tenant_id: req.tenant_id }
    });

    if (!cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    // Check if Usuario with this email already exists
    const existingUser = await prisma.usuario.findUnique({
      where: { email: cliente.email }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Ya existe un usuario registrado con el correo de este cliente' });
    }

    const hashedPassword = await hashPassword(password);

    // Create the Usuario record with rol: 'CLIENTE'
    const newUsuario = await prisma.usuario.create({
      data: {
        tenant_id: req.tenant_id,
        nombre: cliente.nombre,
        email: cliente.email,
        password_hash: hashedPassword,
        rol: 'CLIENTE',
        activo: true
      }
    });

    // Auditoria
    await prisma.bitacoraAuditoria.create({
      data: {
        tenant_id: req.tenant_id,
        id_usuario: req.user.id_usuario,
        accion: 'CREAR_ACCESO_PORTAL_CLIENTE',
        modulo: 'CLIENTES',
        detalle: `Acceso al portal habilitado para el cliente: ${cliente.nombre} (${cliente.email})`,
        ip_adress: req.ip || '127.0.0.1'
      }
    });

    res.status(201).json({
      message: 'Acceso al portal habilitado exitosamente',
      user: {
        id_usuario: newUsuario.id_usuario,
        email: newUsuario.email,
        nombre: newUsuario.nombre,
        rol: newUsuario.rol
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error habilitando acceso al portal del cliente' });
  }
};
