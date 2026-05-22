const prisma = require('../../config/prisma');
const supabase = require('../../config/supabase');
const { extname } = require('path');

exports.updatePerfil = async (req, res) => {
  try {
    const { tenant_id } = req;
    const { nombre, razon_social, nit, telefono, direccion, ciudad } = req.body;
    let logo_url = undefined;

    // Handle Logo upload to Supabase Storage
    if (req.file) {
      const fileExt = extname(req.file.originalname);
      const fileName = `${tenant_id}-${Date.now()}${fileExt}`;
      const filePath = `logos/${fileName}`;

      const { data, error } = await supabase.storage
        .from('logos-tenant')
        .upload(filePath, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: true
        });

      if (error) {
        throw error;
      }

      const { data: publicUrlData } = supabase.storage
        .from('logos-tenant')
        .getPublicUrl(filePath);

      logo_url = publicUrlData.publicUrl;
    }

    const updatedTenant = await prisma.tenant.update({
      where: { id_tenant: tenant_id },
      data: {
        ...(nombre && { nombre }),
        ...(razon_social && { razon_social }),
        ...(nit && { nit }),
        ...(telefono && { telefono }),
        ...(direccion && { direccion }),
        ...(ciudad && { ciudad }),
        ...(logo_url && { logo_url })
      }
    });

    // TODO: Add Audit Log entry (HU-03)
    await prisma.bitacoraAuditoria.create({
      data: {
        tenant_id,
        id_usuario: req.user.id_usuario,
        accion: 'UPDATE_PERFIL',
        modulo: 'TENANT',
        detalle: 'Perfil de consultorio actualizado',
        ip_adress: req.ip || '127.0.0.1'
      }
    });

    res.json({ message: 'Perfil actualizado exitosamente', tenant: updatedTenant });
  } catch (error) {
    console.error(error);
    if (error.message.includes('Formato de archivo')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Error actualizando el perfil del tenant' });
  }
};

exports.getPerfil = async (req, res) => {
  try {
    const { tenant_id } = req;
    const tenant = await prisma.tenant.findUnique({
      where: { id_tenant: tenant_id }
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Perfil de consultorio no encontrado' });
    }

    res.json(tenant);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error obteniendo el perfil del tenant' });
  }
};
