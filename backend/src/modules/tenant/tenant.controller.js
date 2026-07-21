const prisma = require('../../config/prisma');
const r2Client = require('../../config/cloudflare');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { extname } = require('path');

exports.updatePerfil = async (req, res) => {
  try {
    const { tenant_id } = req;
    const { nombre, razon_social, nit, telefono, direccion, ciudad, horas_ocultar_notificaciones } = req.body;
    let logo_url = undefined;

    let horas = undefined;
    if (horas_ocultar_notificaciones !== undefined) {
      horas = parseInt(horas_ocultar_notificaciones, 10);
      if (isNaN(horas) || horas < 0) {
        return res.status(400).json({ error: 'Las horas de ocultamiento de notificaciones deben ser un número entero no negativo' });
      }
    }

    // Handle Logo upload to Cloudflare R2
    if (req.file) {
      const fileExt = extname(req.file.originalname);
      const fileName = `${tenant_id}-${Date.now()}${fileExt}`;
      const filePath = `logos-tenant/${fileName}`;

      const command = new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: filePath,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      });

      await r2Client.send(command);

      // Si R2_PUBLIC_DOMAIN está definido, se usa. Si no, se arma la URL base típica de R2
      const publicDomain = process.env.R2_PUBLIC_DOMAIN;
      if (publicDomain) {
        logo_url = `https://${publicDomain}/${filePath}`;
      } else {
        // Fallback genérico si no se configura un dominio público en .env
        logo_url = `https://${process.env.R2_BUCKET_NAME}.${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${filePath}`;
      }
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
        ...(logo_url && { logo_url }),
        ...(horas !== undefined && { horas_ocultar_notificaciones: horas })
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
