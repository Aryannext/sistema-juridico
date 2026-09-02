const prisma = require('../../config/prisma');
const { triggerWebhook } = require('../../config/webhook');

exports.createCliente = async (req, res) => {
  try {
    const { tipo, nombre, razon_social, tipo_documento, numero_documento, nit, representante, telefono, email, direccion, fecha_nacimiento } = req.body;

    // Limitado al consultorio en sesión: una misma persona puede ser cliente de
    // dos oficinas distintas, y el mensaje de error no debe revelar que otro
    // consultorio ya la tiene registrada.
    const existingDoc = await prisma.cliente.findFirst({
      where: { numero_documento, tenant_id: req.tenant_id }
    });
    if (existingDoc) {
      return res.status(400).json({ error: 'Su consultorio ya tiene un cliente con ese número de documento' });
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

    // Disparar automatización en n8n sin bloquear la respuesta
    triggerWebhook('NUEVO_CLIENTE', { cliente, usuario_creador: req.user.nombre });

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
    console.error('Error en getClientes:', error);
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
    console.error('Error en getClienteById:', error);
    res.status(500).json({ error: 'Error obteniendo cliente' });
  }
};

// Campos que el usuario puede modificar. Todo lo demás que venga en el cuerpo
// se descarta. Antes se volcaba `req.body` entero en Prisma, de modo que enviar
// {"tenant_id": "<otro>"} movía el cliente al consultorio ajeno; también se
// podían reescribir `id_usuario` y `create_at`.
const CAMPOS_EDITABLES_CLIENTE = [
  'tipo', 'nombre', 'razon_social', 'tipo_documento', 'numero_documento',
  'nit', 'representante', 'telefono', 'email', 'direccion', 'fecha_nacimiento'
];

exports.updateCliente = async (req, res) => {
  try {
    const { id } = req.params;

    const updateData = {};
    for (const campo of CAMPOS_EDITABLES_CLIENTE) {
      if (req.body[campo] !== undefined) updateData[campo] = req.body[campo];
    }
    if (updateData.fecha_nacimiento) {
      updateData.fecha_nacimiento = new Date(updateData.fecha_nacimiento);
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No se envió ningún campo modificable' });
    }

    // El documento sigue siendo único dentro del consultorio: hay que verificar
    // que el nuevo valor no choque con otro cliente de la misma oficina.
    if (updateData.numero_documento) {
      const duplicado = await prisma.cliente.findFirst({
        where: {
          numero_documento: updateData.numero_documento,
          tenant_id: req.tenant_id,
          NOT: { id_cliente: id }
        }
      });
      if (duplicado) {
        return res.status(400).json({ error: 'Su consultorio ya tiene un cliente con ese número de documento' });
      }
    }

    const cliente = await prisma.cliente.update({
      where: { id_cliente: id, tenant_id: req.tenant_id },
      data: updateData
    });

    res.json({ message: 'Cliente actualizado', cliente });
  } catch (error) {
    // P2025: el cliente no existe o es de otro consultorio. No es un 500.
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    console.error('Error en updateCliente:', error);
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
