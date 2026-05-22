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

    res.json(cliente);
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
